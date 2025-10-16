// app/api/add-ai-cards/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface AddCardsBody {
  deckId: string;
  topic: string;
  cardType: 'qa' | 'vocabulary' | 'facts';
  cardCount: number;
  language: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("CRITICAL: GOOGLE_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error: The API Key is missing." },
      { status: 500 }
    );
  }

  try {
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
    }

    const { deckId, topic, cardType, cardCount, language, difficulty } = (await request.json()) as AddCardsBody;

    if (!deckId || !topic || !cardType || !cardCount || !language || !difficulty) {
        return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // --- LÓGICA ANTI-DUPLICACIÓN ---
    // 1. Obtener las tarjetas existentes en el mazo
    const { data: existingCards, error: existingCardsError } = await supabase
        .from('cards')
        .select('front, back')
        .eq('deck_id', deckId)
        .is('deleted_at', null);

    if (existingCardsError) {
        throw new Error("Could not fetch existing cards to prevent duplication.");
    }

    // 2. Convertir las tarjetas existentes a un formato simple para el prompt
    const existingCardsJson = JSON.stringify(existingCards.map(c => ({ front: c.front, back: c.back })));

    // --- Definiciones para el prompt ---
    const cardTypeInstructions = {
        qa: 'Each card must be a clear question in the "front" and a concise answer in the "back".',
        vocabulary: 'Each card must contain a term or word in the "front" and its definition or translation in the "back".',
        facts: 'Each card must present a key piece of information, with a prompt in the "front" (like a fill-in-the-blank or a name) and the corresponding fact in the "back".'
    }

    const difficultyInstructions = {
        easy: "The cards should cover the most basic and fundamental concepts. Ideal for a beginner.",
        medium: "The cards should cover a balance of core concepts and some detailed information. Assume intermediate knowledge.",
        hard: "The cards should focus on complex, nuanced, or advanced details of the topic. Ideal for an expert."
    }

    // --- CONSTRUCCIÓN DEL PROMPT ---
    const prompt = `
      You are an expert in creating educational content. Your task is to generate a set of **new** flashcards to be added to an existing deck.

      **Topic:** ${topic}
      **Language:** ${language}
      **Number of New Cards to Generate:** ${cardCount}
      **Card Type:** ${cardTypeInstructions[cardType]}
      **Difficulty Level:** ${difficultyInstructions[difficulty]}

      **Existing Cards in the Deck (DO NOT DUPLICATE):**
      ${existingCardsJson}

      **Instructions:**
      1.  Generate exactly ${cardCount} **NEW** flashcards based on the provided topic, card type, and difficulty.
      2.  **CRITICAL:** Do not generate any cards that are duplicates or too similar to the "Existing Cards in the Deck" list provided above.
      3.  The content must be accurate and relevant to the topic.
      4.  The entire output (both "front" and "back" of each card) must be in ${language}.
      5.  You MUST return the result exclusively in raw JSON format. Do not add any introductory text, concluding text, or markdown formatting like \`\`\`json. The output must be a raw JSON array of objects only.
      6.  Each object in the array must have this exact structure:
          {
            "front": "The content for the front of the card...",
            "back": "The content for the back of the card..."
          }
    `;
    
    // --- CORRECCIÓN AQUÍ ---
    // Cambiado de 'getGeneraTiveModel' a 'getGenerativeModel'
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    // --- FIN DE LA CORRECCIÓN ---

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    let generatedCards;
    try {
        const jsonString = text.replace(/```json\n?/, "").replace(/\n?```$/, "");
        generatedCards = JSON.parse(jsonString);
        if (!Array.isArray(generatedCards) || generatedCards.some(c => typeof c.front !== 'string' || typeof c.back !== 'string')) {
            throw new Error("Invalid JSON structure from AI.");
        }
    } catch (parseError) {
      console.error("Failed to parse JSON from AI response. Raw text was:", text, parseError);
      throw new Error("The AI returned an invalid response format. Please try again.");
    }
    
    // --- INSERCIÓN EN BASE DE DATOS ---
    // No creamos un mazo, usamos el deckId existente
    const cardsToInsert = generatedCards.map((card: {front: string, back: string}) => ({
        deck_id: deckId, // <-- Usamos el ID existente
        front: card.front,
        back: card.back,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString()
    }));

    const { error: cardsError } = await supabase
        .from('cards')
        .insert(cardsToInsert);
    
    if (cardsError) {
        console.error("Supabase error inserting cards:", cardsError);
        throw new Error("Could not save the generated cards to the database.");
    }

    return NextResponse.json({ success: true, addedCount: cardsToInsert.length });

  } catch (error) {
    console.error("Error in add-ai-cards API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}