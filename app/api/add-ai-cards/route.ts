// app/api/add-ai-cards/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const pdfParse = require('pdf-parse');

export const dynamic = "force-dynamic";

// Helper function to parse page ranges (same as in generate-deck)
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
                if (isNaN(start) || isNaN(end) || start < 1 || start > end || end > maxPages) throw new Error(`Invalid range: ${trimmedRange}`);
                for (let i = start; i <= end; i++) pages.push(i);
            } else {
                const page = parseInt(trimmedRange, 10);
                if (isNaN(page) || page < 1 || page > maxPages) throw new Error(`Invalid page number: ${trimmedRange}`);
                pages.push(page);
            }
        }
        return [...new Set(pages)].sort((a, b) => a - b);
    } catch (error) {
        console.error("Error parsing page range:", error);
        return null; // Indicate error
    }
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

    // Read FormData
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

     // --- VALIDATIONS ---
    if (!deckId || !cardType || !cardCount || !language || !difficulty || !generationSource) {
      return NextResponse.json({ error: "Missing required fields in form data." }, { status: 400 });
    }
    if (generationSource === 'topic' && !topic) {
        return NextResponse.json({ error: "Topic description is required for topic-based generation." }, { status: 400 });
    }
    if (generationSource === 'pdf' && !pdfFile) {
        return NextResponse.json({ error: "PDF file is required for PDF-based generation." }, { status: 400 });
    }
    // --- END VALIDATIONS ---


    // --- PDF Processing Logic (Similar to generate-deck) ---
    let pdfTextContent = "";
    let sourceDescription = `Topic: ${topic}`; // Default

    if (generationSource === 'pdf' && pdfFile) {
        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const data = await pdfParse(buffer); // <-- USO CORREGIDO
            const totalPages = data.numpages;
            let targetPages: number[] | null = null;

            if (pageRangeStr && pageRangeStr.trim() !== '') {
                targetPages = parsePageRange(pageRangeStr, totalPages);
                 if (targetPages === null) {
                    return NextResponse.json({ error: "Invalid page range format provided. Use commas and hyphens, e.g., 1-3, 5, 7-10." }, { status: 400 });
                }
            }


            if (targetPages) {
                const allPagesText = data.text.split(/\f/);
                pdfTextContent = targetPages
                                .map(pageNum => allPagesText[pageNum - 1])
                                .filter(text => text)
                                .join('\n\n---\n\n');
                sourceDescription = `Content from PDF '${pdfFile.name}' (Pages: ${pageRangeStr})`;
            } else {
                pdfTextContent = data.text;
                sourceDescription = `Content from PDF '${pdfFile.name}' (All Pages)`;
            }
             if (!pdfTextContent.trim()) {
                return NextResponse.json({ error: "Could not extract text from the specified PDF pages or the PDF is empty." }, { status: 400 });
            }
        } catch (pdfError) {
            console.error("Error processing PDF:", pdfError);
            return NextResponse.json({ error: "Failed to process the PDF file." }, { status: 500 });
        }
    }
    // --- End PDF Processing Logic ---


    // --- Fetch existing cards (unchanged) ---
    const { data: existingCards, error: existingCardsError } = await supabase
        .from('cards')
        .select('front, back')
        .eq('deck_id', deckId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(15);

    if (existingCardsError) {
        throw new Error("Could not fetch existing cards to prevent duplication.");
    }
    const existingCardsJson = JSON.stringify(existingCards.map(c => ({ front: c.front, back: c.back })));
    // --- End Fetch existing cards ---


    // --- Prompt definitions (unchanged) ---
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
    // --- End Prompt definitions ---


    // --- Modified Prompt ---
    const prompt = `
      You are an expert in creating educational content. Your task is to generate a set of **new** flashcards to be added to an existing deck, based on the provided source material.

      **Source Material:** ${generationSource === 'pdf' ? `\n${sourceDescription}\n\n"""\n${pdfTextContent}\n"""` : topic}
      **Language:** ${language}
      **Number of New Cards to Generate:** ${cardCount}
      **Card Type:** ${cardTypeInstructions[cardType]}
      **Difficulty Level:** ${difficultyInstructions[difficulty]}

      **Existing Card Examples (Analyze these for style, format, tone, and content to avoid):**
      ${existingCardsJson}

      **Instructions:**
      1.  Analyze the "**Source Material**" provided above.
      2.  Analyze the "**Existing Card Examples**" to understand their style (e.g., short questions, detailed definitions, fill-in-the-blank, tone, format) and content.
      3.  Generate exactly ${cardCount} **NEW** flashcards based strictly on the content within the Source Material, adhering to the specified card type and difficulty.
      4.  The new cards should **match the style, format, and tone** of the existing cards as closely as possible.
      5.  **CRITICAL:** Do not generate any cards that are duplicates or substantively very similar to the content listed in "Existing Card Examples".
      6.  The content must be accurate and relevant to the Source Material.
      7.  The entire output (both "front" and "back" of each card) must be in ${language}.
      8.  You MUST return the result exclusively in raw JSON format. Do not add any introductory text, concluding text, or markdown formatting like \`\`\`json. The output must be a raw JSON array of objects only.
      9.  Each object in the array must have this exact structure:
          {
            "front": "The content for the front of the card...",
            "back": "The content for the back of the card..."
          }
    `;
    // --- End Modified Prompt ---

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using a potentially more capable model
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let generatedCards;
     try {
        // Attempt to clean potential markdown and parse JSON
        const jsonString = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        generatedCards = JSON.parse(jsonString);
        if (!Array.isArray(generatedCards) || generatedCards.some(c => typeof c.front !== 'string' || typeof c.back !== 'string')) {
            throw new Error("Invalid JSON structure from AI.");
        }
    } catch (parseError) {
      console.error("Failed to parse JSON from AI response. Raw text was:", text, parseError);
      // Try to extract JSON array even if there's surrounding text
      const jsonMatch = text.match(/\[\s*\{[\s\S]*?\}\s*]/);
       if (jsonMatch) {
            try {
                generatedCards = JSON.parse(jsonMatch[0]);
                 if (!Array.isArray(generatedCards) || generatedCards.some(c => typeof c.front !== 'string' || typeof c.back !== 'string')) {
                    throw new Error("Invalid JSON structure within extracted array.");
                 }
                 console.warn("Successfully parsed JSON array found within potentially malformed AI response.");
            } catch (nestedParseError) {
                 console.error("Failed even trying to parse extracted JSON array:", nestedParseError);
                 throw new Error("The AI returned an invalid response format that could not be automatically corrected. Please try again.");
            }
       } else {
            throw new Error("The AI returned an invalid response format. Please try again.");
       }
    }

    // --- DATABASE INSERTION (Ensure limit) ---
    const cardsToInsert = generatedCards.map((card: {front: string, back: string}) => ({
        deck_id: deckId, // Use the existing deckId
        front: card.front,
        back: card.back,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString()
    }));

    // Ensure we don't insert more cards than requested
    const limitedCardsToInsert = cardsToInsert.slice(0, cardCount);

    if (limitedCardsToInsert.length === 0) {
        // It's possible the AI generated nothing new, or only duplicates it identified.
        // Return success but indicate zero cards were added.
        console.warn("AI generated 0 valid new cards after filtering duplicates/similar content or based on source material.")
        return NextResponse.json({ success: true, addedCount: 0, message: "No new unique cards could be generated based on the provided context and existing cards." });
    }


    const { error: cardsError } = await supabase
        .from('cards')
        .insert(limitedCardsToInsert); // Use the limited array

    if (cardsError) {
        console.error("Supabase error inserting cards:", cardsError);
        throw new Error("Could not save the generated cards to the database.");
    }

    return NextResponse.json({ success: true, addedCount: limitedCardsToInsert.length });

  } catch (error) {
    console.error("Error in add-ai-cards API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
     // Provide more specific error message if it's about PDF parsing
    if (errorMessage.includes("PDF")) {
         return NextResponse.json({ error: errorMessage }, { status: 400 }); // Bad request for PDF issues
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}