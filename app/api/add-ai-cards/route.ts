import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import pdfParse from "@cyber2024/pdf-parse-fixed";

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

function parsePageRange(rangeString: string | null | undefined, maxPages: number): number[] | null {
    if (!rangeString || rangeString.trim() === '') return null;
    const pages: number[] = [];
    const ranges = rangeString.split(',');
    try {
        for (const range of ranges) {
            const trimmedRange = range.trim();
            if (trimmedRange.includes('-')) {
                const [startStr, endStr] = trimmedRange.split('-');
                const start = parseInt(startStr, 10);
                const end = endStr.trim() === '' ? maxPages : parseInt(endStr, 10);
                if (isNaN(start) || isNaN(end) || start < 1 || start > end || end > maxPages) throw new Error(`Invalid range`);
                for (let i = start; i <= end; i++) pages.push(i);
            } else {
                const page = parseInt(trimmedRange, 10);
                if (isNaN(page) || page < 1 || page > maxPages) throw new Error(`Invalid page`);
                pages.push(page);
            }
        }
        return [...new Set(pages)].sort((a, b) => a - b);
    } catch (error) {
        return null;
    }
}

const apiKey = process.env.GOOGLE_API_KEY;

export async function POST(request: Request) {
  if (!apiKey) {
    return NextResponse.json({ error: "API Key missing." }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
    }

    const formData = await request.formData();
    const deckId = formData.get('deckId') as string | null;
    const cardType = formData.get('cardType') as 'qa' | 'vocabulary' | 'facts' | null;
    const cardCountStr = formData.get('cardCount') as string | null;
    const language = formData.get('language') as string | null;
    const difficulty = formData.get('difficulty') as 'easy' | 'medium' | 'hard' | null;
    const generationSource = formData.get('generationSource') as 'topic' | 'pdf' | null;
    const topic = formData.get('topic') as string | null;
    const pdfFile = formData.get('pdfFile') as File | null;
    const pageRangeStr = formData.get('pageRange') as string | null;

    const cardCount = cardCountStr ? parseInt(cardCountStr, 10) : 0;

    if (!deckId || !cardType || !cardCount || !language || !difficulty || !generationSource) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    let pdfTextContent = "";
    let sourceDescription = `Topic: ${topic}`;

    if (generationSource === 'pdf' && pdfFile) {
        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const data = await pdfParse(buffer);
            const totalPages = data.numpages;
            let targetPages: number[] | null = null;

            if (pageRangeStr && pageRangeStr.trim() !== '') {
                targetPages = parsePageRange(pageRangeStr, totalPages);
                 if (targetPages === null) return NextResponse.json({ error: "Invalid page range." }, { status: 400 });
            }

            if (targetPages) {
                const allPagesText = data.text.split(/\f/);
                pdfTextContent = targetPages.map((pageNum: number) => allPagesText[pageNum - 1]).filter((text: string) => text).join('\n\n---\n\n');
                sourceDescription = `Content from PDF '${pdfFile.name}' (Pages: ${pageRangeStr})`;
            } else {
                pdfTextContent = data.text;
                sourceDescription = `Content from PDF '${pdfFile.name}' (All Pages)`;
            }
             if (!pdfTextContent.trim()) return NextResponse.json({ error: "Empty PDF content." }, { status: 400 });
        } catch (pdfError: any) {
            return NextResponse.json({ error: "Failed to process PDF." }, { status: 500 });
        }
    }

    const { data: existingCards } = await supabase
        .from('cards')
        .select('front, back')
        .eq('deck_id', deckId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(15);

    const existingCardsJson = JSON.stringify(existingCards?.map(c => ({ front: c.front, back: c.back })) || []);

    const sourceMaterial = generationSource === 'pdf' ? `\n${sourceDescription}\n\n"""\n${pdfTextContent}\n"""` : topic;
    const prompt = `
      You are an expert in creating educational content.
      **Source Material:** ${sourceMaterial}
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

    let generatedCards;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        generatedCards = cleanAndParseJSON(text);
    } catch (aiError: any) {
        console.error("AI Error:", aiError);
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

    if (cardsToInsert.length === 0) {
        return NextResponse.json({ success: true, addedCount: 0, message: "No new cards generated." });
    }

    const { error: cardsError } = await supabase.from('cards').insert(cardsToInsert);

    if (cardsError) {
        return NextResponse.json({ error: "Database error saving cards." }, { status: 500 });
    }

    return NextResponse.json({ success: true, addedCount: cardsToInsert.length });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server error." }, { status: 500 });
  }
}