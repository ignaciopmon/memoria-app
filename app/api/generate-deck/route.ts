import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const apiKey = process.env.GOOGLE_API_KEY;

export async function POST(request: Request) {
  if (!apiKey) {
    return NextResponse.json({ error: "API Key missing." }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "User not authenticated." }, { status: 401 });

    const formData = await request.formData();
    const deckName = formData.get('deckName') as string | null;
    const cardType = formData.get('cardType') as 'qa' | 'vocabulary' | 'facts' | null;
    const cardCountStr = formData.get('cardCount') as string | null;
    const language = formData.get('language') as string | null;
    const difficulty = formData.get('difficulty') as 'easy' | 'medium' | 'hard' | null;
    const generationSource = formData.get('generationSource') as 'topic' | 'pdf' | null;
    const topic = formData.get('topic') as string | null;
    const pdfFile = formData.get('pdfFile') as File | null;
    const pageRangeStr = formData.get('pageRange') as string | null;

    const cardCount = cardCountStr ? parseInt(cardCountStr, 10) : 0;

    if (!deckName || !cardType || !cardCount || !language || !difficulty || !generationSource) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const cardTypeInstructions = {
        qa: 'Each card must be a clear question in the "front" and a concise answer in the "back".',
        vocabulary: 'Each card must contain a term or word in the "front" and its definition or translation in the "back".',
        facts: 'Each card must present a key piece of information, with a prompt in the "front" (like a fill-in-the-blank or a name) and the corresponding fact in the "back".'
    };
    
    const difficultyInstructions = {
        easy: "Cover basic and fundamental concepts. Ideal for a beginner.",
        medium: "Cover a balance of core concepts and some detailed information.",
        hard: "Focus on complex, nuanced, or advanced details. Ideal for an expert."
    };

    let promptParts: any[] = [];
    let sourceInstruction = "";

    if (generationSource === 'pdf' && pdfFile) {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        
        promptParts.push({
            inlineData: {
                data: base64Data,
                mimeType: "application/pdf"
            }
        });

        sourceInstruction = `Use the attached PDF document as the ONLY source material.`;
        if (pageRangeStr && pageRangeStr.trim() !== '') {
            sourceInstruction += `\n**CRITICAL REQUIREMENT:** ONLY extract information from pages ${pageRangeStr} of the PDF. Completely ignore the rest.`;
        }
    } else {
        sourceInstruction = `Use the following topic as the source material:\n"""\n${topic}\n"""`;
    }

    const promptText = `
      You are an expert in creating educational content.
      **Source Material:** ${sourceInstruction}
      **Language:** ${language}
      **Number of Cards:** ${cardCount}
      **Type:** ${cardTypeInstructions[cardType!]}
      **Difficulty:** ${difficultyInstructions[difficulty!]}

      **Instructions:**
      1. Generate exactly ${cardCount} flashcards based strictly on the Source Material.
      2. Output (front/back) must be in ${language}.
      3. Return ONLY a raw JSON array.
      4. Structure: [{"front": "...", "back": "..."}]
    `;

    promptParts.unshift(promptText);

    let generatedCards;
    try {
        // Configuramos la IA para que devuelva un JSON nativo garantizado
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(promptParts);
        generatedCards = JSON.parse(result.response.text());

        if (!Array.isArray(generatedCards)) throw new Error("Invalid JSON structure.");
    } catch (aiError: any) {
        return NextResponse.json({ error: "Failed to generate content with AI." }, { status: 500 });
    }

    const { data: newDeck, error: deckError } = await supabase
        .from('decks')
        .insert({
            user_id: user.id,
            name: deckName,
            description: `AI-generated from ${generationSource === 'pdf' ? `PDF` : `Topic`}`
        }).select('id').single();

    if (deckError || !newDeck) return NextResponse.json({ error: "DB Error." }, { status: 500 });

    const cardsToInsert = generatedCards.map((card: {front: string, back: string}) => ({
        deck_id: newDeck.id,
        front: card.front,
        back: card.back,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString()
    }));

    const { error: cardsError } = await supabase.from('cards').insert(cardsToInsert.slice(0, cardCount));

    if (cardsError) {
        await supabase.from('decks').delete().eq('id', newDeck.id);
        return NextResponse.json({ error: "Could not save cards." }, { status: 500 });
    }

    return NextResponse.json({ success: true, deckId: newDeck.id });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 });
  }
}