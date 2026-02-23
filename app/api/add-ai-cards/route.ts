import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function cleanAndParseJSON(text: string) {
    let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const firstOpen = cleanText.indexOf('[');
    const lastClose = cleanText.lastIndexOf(']');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        cleanText = cleanText.substring(firstOpen, lastClose + 1);
    }
    return JSON.parse(cleanText);
}

const apiKey = process.env.GOOGLE_API_KEY;

export async function POST(request: Request) {
  if (!apiKey) return NextResponse.json({ error: "API Key missing." }, { status: 500 });
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "User not authenticated." }, { status: 401 });

    const formData = await request.formData();
    const deckId = formData.get('deckId') as string | null;
    const cardType = formData.get('cardType') as string | null;
    const cardCountStr = formData.get('cardCount') as string | null;
    const language = formData.get('language') as string | null;
    const difficulty = formData.get('difficulty') as string | null;
    const generationSource = formData.get('generationSource') as string | null;
    const topic = formData.get('topic') as string | null;
    const pdfFile = formData.get('pdfFile') as File | null;
    const pageRangeStr = formData.get('pageRange') as string | null;

    const cardCount = cardCountStr ? parseInt(cardCountStr, 10) : 0;

    if (!deckId || !cardCount || !generationSource) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const { data: existingCards } = await supabase
        .from('cards')
        .select('front, back')
        .eq('deck_id', deckId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(15);
    const existingCardsJson = JSON.stringify(existingCards?.map(c => ({ front: c.front, back: c.back })) || []);

    let promptParts: any[] = [];
    let sourceInstruction = "";

    if (generationSource === 'pdf' && pdfFile) {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        
        promptParts.push({
            inlineData: { data: base64Data, mimeType: "application/pdf" }
        });

        sourceInstruction = `Use the attached PDF document as the ONLY source material.`;
        if (pageRangeStr && pageRangeStr.trim() !== '') {
            sourceInstruction += `\n**CRITICAL REQUIREMENT:** ONLY extract information from pages ${pageRangeStr} of the PDF.`;
        }
    } else {
        sourceInstruction = `Use the following topic as the source material:\n"""\n${topic}\n"""`;
    }

    const promptText = `
      You are an expert in creating educational content.
      **Source Material:** ${sourceInstruction}
      **Language:** ${language}
      **New Cards Needed:** ${cardCount}
      **Type:** ${cardType}
      **Difficulty:** ${difficulty}
      **Existing Cards (Avoid duplicates):** ${existingCardsJson}

      **Instructions:**
      1. Generate ${cardCount} **NEW** cards based on Source Material.
      2. Match the style of Existing Cards but DO NOT duplicate content.
      3. Return ONLY a raw JSON array: [{"front": "...", "back": "..."}]
    `;

    promptParts.unshift(promptText);

    let generatedCards;
    try {
        const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: { responseMimeType: "application/json" } // Obliga a devolver JSON válido siempre
});
        const result = await model.generateContent(promptParts);
        generatedCards = cleanAndParseJSON(result.response.text());
    } catch (aiError: any) {
        return NextResponse.json({ error: "AI generation failed." }, { status: 500 });
    }

    const cardsToInsert = generatedCards.slice(0, cardCount).map((card: {front: string, back: string}) => ({
        deck_id: deckId,
        front: card.front,
        back: card.back,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString()
    }));

    if (cardsToInsert.length === 0) return NextResponse.json({ success: true, addedCount: 0 });

    const { error: cardsError } = await supabase.from('cards').insert(cardsToInsert);
    if (cardsError) return NextResponse.json({ error: "Database error." }, { status: 500 });

    return NextResponse.json({ success: true, addedCount: cardsToInsert.length });
  } catch (error: any) {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}