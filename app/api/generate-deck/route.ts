// app/api/generate-deck/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface GenerateDeckBody {
  deckName: string;
  topic: string;
  cardType: 'qa' | 'vocabulary' | 'facts';
  cardCount: number;
  language: string;
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

    const { deckName, topic, cardType, cardCount, language } = (await request.json()) as GenerateDeckBody;

    if (!deckName || !topic || !cardType || !cardCount || !language) {
        return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const cardTypeInstructions = {
        qa: 'Each card must be a clear question in the "front" and a concise answer in the "back".',
        vocabulary: 'Each card must contain a term or word in the "front" and its definition or translation in the "back".',
        facts: 'Each card must present a key piece of information, with a prompt in the "front" (like a fill-in-the-blank or a name) and the corresponding fact in the "back".'
    }

    const prompt = `
      You are an expert in creating educational content. Your task is to generate a set of flashcards for a user.

      **Topic:** ${topic}
      **Language:** ${language}
      **Number of Cards:** ${cardCount}
      **Card Type:** ${cardTypeInstructions[cardType]}

      **Instructions:**
      1.  Generate exactly ${cardCount} flashcards based on the provided topic and card type.
      2.  The content must be accurate and relevant to the topic.
      3.  The entire output (both "front" and "back" of each card) must be in ${language}.
      4.  You MUST return the result exclusively in raw JSON format. Do not add any introductory text, concluding text, or markdown formatting like \`\`\`json. The output must be a raw JSON array of objects only.
      5.  Each object in the array must have this exact structure:
          {
            "front": "The content for the front of the card...",
            "back": "The content for the back of the card..."
          }
    `;
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
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
    
    // --- DATABASE INSERTION ---
    // 1. Create the deck
    const { data: newDeck, error: deckError } = await supabase
        .from('decks')
        .insert({
            user_id: user.id,
            name: deckName,
            description: `AI-generated deck about: ${topic}`
        })
        .select('id')
        .single();
    
    if (deckError || !newDeck) {
        console.error("Supabase error creating deck:", deckError);
        throw new Error("Could not create the new deck in the database.");
    }

    // 2. Prepare and insert the cards
    const cardsToInsert = generatedCards.map((card: {front: string, back: string}) => ({
        deck_id: newDeck.id,
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
        // Attempt to delete the deck if cards fail to insert
        await supabase.from('decks').delete().eq('id', newDeck.id);
        throw new Error("Could not save the generated cards to the database.");
    }

    return NextResponse.json({ success: true, deckId: newDeck.id });

  } catch (error) {
    console.error("Error in generate-deck API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
