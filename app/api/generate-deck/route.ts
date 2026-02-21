import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

                if (isNaN(start) || isNaN(end) || start < 1 || start > end || end > maxPages) {
                    throw new Error(`Invalid range: ${trimmedRange}`);
                }
                for (let i = start; i <= end; i++) {
                    pages.push(i);
                }
            } else {
                const page = parseInt(trimmedRange, 10);
                if (isNaN(page) || page < 1 || page > maxPages) {
                    throw new Error(`Invalid page number: ${trimmedRange}`);
                }
                pages.push(page);
            }
        }
        return [...new Set(pages)].sort((a, b) => a - b);
    } catch (error) {
        console.error("Error parsing page range:", error);
        return null;
    }
}

const apiKey = process.env.GOOGLE_API_KEY;

export async function POST(request: Request) {
  if (!apiKey) {
    console.error("API key missing in generate-deck.");
    return NextResponse.json(
      { error: "Server configuration error: The API Key is missing." },
      { status: 500 }
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
    }

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
      return NextResponse.json({ error: "Missing required fields in form data." }, { status: 400 });
    }
    if (generationSource === 'topic' && (!topic || !topic.trim())) {
        return NextResponse.json({ error: "Topic description is required for topic-based generation." }, { status: 400 });
    }
    if (generationSource === 'pdf' && !pdfFile) {
        return NextResponse.json({ error: "PDF file is required for PDF-based generation." }, { status: 400 });
    }

    let pdfTextContent = "";
    let contextDescription = `Topic: ${topic}`;

    if (generationSource === 'pdf' && pdfFile) {
        try {
            // HACK: Ocultamos el require a Webpack usando eval
            const pdfParse = eval('require')('@cyber2024/pdf-parse-fixed');

            const arrayBuffer = await pdfFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const data = await pdfParse(buffer);

            const totalPages = data.numpages;
            let targetPages: number[] | null = null;

            if (pageRangeStr && pageRangeStr.trim() !== '') {
                targetPages = parsePageRange(pageRangeStr, totalPages);
                if (targetPages === null) {
                    return NextResponse.json({ error: "Invalid page range format provided." }, { status: 400 });
                }
            }

            if (targetPages) {
                const allPagesText = data.text.split(/\f/);
                pdfTextContent = targetPages
                                .map((pageNum: number) => allPagesText[pageNum - 1])
                                .filter((text: string) => text)
                                .join('\n\n---\n\n');
                contextDescription = `Content extracted from PDF '${pdfFile.name}' (Pages: ${pageRangeStr})`;
            } else {
                pdfTextContent = data.text;
                contextDescription = `Content extracted from PDF '${pdfFile.name}' (All Pages)`;
            }

            if (!pdfTextContent.trim()) {
                return NextResponse.json({ error: "Could not extract text from the PDF." }, { status: 400 });
            }

        } catch (pdfError: any) {
            console.error("Error during PDF processing:", pdfError);
            return NextResponse.json({ error: "Failed to process the PDF file." }, { status: 500 });
        }
    }

    const cardTypeInstructions = {
        qa: 'Each card must be a clear question in the "front" and a concise answer in the "back".',
        vocabulary: 'Each card must contain a term or word in the "front" and its definition or translation in the "back".',
        facts: 'Each card must present a key piece of information, with a prompt in the "front" (like a fill-in-the-blank or a name) and the corresponding fact in the "back".'
    };
    const difficultyInstructions = {
        easy: "The cards should cover the most basic and fundamental concepts. Ideal for a beginner.",
        medium: "The cards should cover a balance of core concepts and some detailed information.",
        hard: "The cards should focus on complex, nuanced, or advanced details of the topic. Ideal for an expert."
    };

    const sourceMaterial = generationSource === 'pdf' ? `\n${contextDescription}\n\n"""\n${pdfTextContent}\n"""` : topic;
    const prompt = `
      You are an expert in creating educational content.
      **Source Material:** ${sourceMaterial}
      **Language:** ${language}
      **Number of Cards:** ${cardCount}
      **Type:** ${cardTypeInstructions[cardType!]}
      **Difficulty:** ${difficultyInstructions[difficulty!]}

      **Instructions:**
      1. Generate exactly ${cardCount} flashcards based strictly on the Source Material.
      2. Output (front/back) must be in ${language}.
      3. Return ONLY a raw JSON array. No markdown, no 'json' tags.
      4. Structure: [{"front": "...", "back": "..."}]
    `;

    let generatedCards;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        generatedCards = cleanAndParseJSON(text);

        if (!Array.isArray(generatedCards)) {
            throw new Error("Invalid JSON structure.");
        }

    } catch (aiError: any) {
        console.error("AI Error:", aiError);
        return NextResponse.json({ error: "Failed to generate content with AI. " + aiError.message }, { status: 500 });
    }

    const { data: newDeck, error: deckError } = await supabase
        .from('decks')
        .insert({
            user_id: user.id,
            name: deckName,
            description: `AI-generated from ${generationSource === 'pdf' ? `PDF: ${pdfFile?.name}` : `Topic`}`
        })
        .select('id')
        .single();

    if (deckError || !newDeck) {
        return NextResponse.json({ error: "Could not create the new deck in database." }, { status: 500 });
    }

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
        .insert(cardsToInsert.slice(0, cardCount));

    if (cardsError) {
        await supabase.from('decks').delete().eq('id', newDeck.id);
        return NextResponse.json({ error: "Could not save cards to database." }, { status: 500 });
    }

    return NextResponse.json({ success: true, deckId: newDeck.id });

  } catch (error: any) {
    console.error("Critical Error:", error);
    return NextResponse.json({ error: error.message || "Unknown server error." }, { status: 500 });
  }
}