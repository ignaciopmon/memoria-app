// app/api/generate-deck/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const pdfParse = require('pdf-parse');

export const dynamic = "force-dynamic";

// Helper function to parse page ranges (e.g., "1-3, 5, 7-")
function parsePageRange(rangeString: string | null | undefined, maxPages: number): number[] | null {
    if (!rangeString || rangeString.trim() === '') return null; // Return null if empty or null/undefined

    const pages: number[] = [];
    const ranges = rangeString.split(',');

    try {
        for (const range of ranges) {
            const trimmedRange = range.trim();
            if (trimmedRange.includes('-')) {
                const [startStr, endStr] = trimmedRange.split('-');
                const start = parseInt(startStr, 10);
                // Handle open-ended ranges like "7-"
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
        // Remove duplicates and sort
        return [...new Set(pages)].sort((a, b) => a - b);
    } catch (error) {
        console.error("Error parsing page range:", error);
        // Optionally, you could throw the error up or return null/empty array
        // depending on how you want to handle invalid ranges.
        // Returning null indicates an error in parsing.
        return null; // Indicate error parsing
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

    // Read FormData instead of JSON
    const formData = await request.formData();
    const deckName = formData.get('deckName') as string | null;
    const cardType = formData.get('cardType') as 'qa' | 'vocabulary' | 'facts' | null;
    const cardCountStr = formData.get('cardCount') as string | null;
    const language = formData.get('language') as string | null;
    const difficulty = formData.get('difficulty') as 'easy' | 'medium' | 'hard' | null;
    const generationSource = formData.get('generationSource') as 'topic' | 'pdf' | null;
    const topic = formData.get('topic') as string | null;
    const pdfFile = formData.get('pdfFile') as File | null;
    const pageRangeStr = formData.get('pageRange') as string | null; // Get page range string

    const cardCount = cardCountStr ? parseInt(cardCountStr, 10) : 0;

    // --- VALIDATIONS ---
    if (!deckName || !cardType || !cardCount || !language || !difficulty || !generationSource) {
      return NextResponse.json({ error: "Missing required fields in form data." }, { status: 400 });
    }
    if (generationSource === 'topic' && !topic) {
        return NextResponse.json({ error: "Topic description is required for topic-based generation." }, { status: 400 });
    }
    if (generationSource === 'pdf' && !pdfFile) {
        return NextResponse.json({ error: "PDF file is required for PDF-based generation." }, { status: 400 });
    }
    // --- END VALIDATIONS ---


    // --- PDF Processing Logic ---
    let pdfTextContent = "";
    let contextDescription = `Topic: ${topic}`; // Default context description

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
                    // Handle invalid page range input
                    return NextResponse.json({ error: "Invalid page range format provided. Use commas and hyphens, e.g., 1-3, 5, 7-10." }, { status: 400 });
                }
            }


            // Extract text based on pages
            if (targetPages) {
                // pdf-parse doesn't directly support extracting specific pages in one go easily.
                // We render all pages and then filter the text. This might be inefficient for large PDFs.
                // A more advanced approach might involve rendering pages individually if needed.
                const allPagesText = data.text.split(/\f/); // Split text by form feed character (\f), often used as page break
                pdfTextContent = targetPages
                                .map(pageNum => allPagesText[pageNum - 1]) // pageNum is 1-based, array index is 0-based
                                .filter(text => text) // Remove potentially undefined entries if page number is out of bounds
                                .join('\n\n---\n\n'); // Join page texts with a separator
                contextDescription = `Content extracted from PDF '${pdfFile.name}' (Pages: ${pageRangeStr})`;

            } else {
                pdfTextContent = data.text; // Use all text
                contextDescription = `Content extracted from PDF '${pdfFile.name}' (All Pages)`;
            }

            if (!pdfTextContent.trim()) {
                return NextResponse.json({ error: "Could not extract text from the specified PDF pages or the PDF is empty." }, { status: 400 });
            }

        } catch (pdfError) {
            console.error("Error processing PDF:", pdfError);
            return NextResponse.json({ error: "Failed to process the PDF file. It might be corrupted or password-protected." }, { status: 500 });
        }
    }
    // --- End PDF Processing Logic ---

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

    // --- Modified Prompt ---
    const prompt = `
      You are an expert in creating educational content. Your task is to generate a set of flashcards for a user based on the provided source.

      **Source Material:** ${generationSource === 'pdf' ? `\n${contextDescription}\n\n"""\n${pdfTextContent}\n"""` : topic}
      **Language:** ${language}
      **Number of Cards to Generate:** ${cardCount}
      **Card Type:** ${cardTypeInstructions[cardType]}
      **Difficulty Level:** ${difficultyInstructions[difficulty]}

      **Instructions:**
      1.  Analyze the "**Source Material**" provided above.
      2.  Generate exactly ${cardCount} flashcards based strictly on the content within the Source Material. Do not add external information.
      3.  Adhere to the specified "**Card Type**" and "**Difficulty Level**".
      4.  The content must be accurate and relevant to the Source Material.
      5.  The entire output (both "front" and "back" of each card) must be in ${language}.
      6.  You MUST return the result exclusively in raw JSON format. Do not add any introductory text, concluding text, or markdown formatting like \`\`\`json. The output must be a raw JSON array of objects only.
      7.  Each object in the array must have this exact structure:
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

    // --- DATABASE INSERTION ---
    const { data: newDeck, error: deckError } = await supabase
        .from('decks')
        .insert({
            user_id: user.id,
            name: deckName,
            description: `AI-generated from ${generationSource === 'pdf' ? `PDF: ${pdfFile?.name}` : `Topic: ${topic}`}`
        })
        .select('id')
        .single();

    if (deckError || !newDeck) {
        console.error("Supabase error creating deck:", deckError);
        throw new Error("Could not create the new deck in the database.");
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

    // Ensure we don't insert more cards than requested, even if AI generated extra
    const limitedCardsToInsert = cardsToInsert.slice(0, cardCount);

    const { error: cardsError } = await supabase
        .from('cards')
        .insert(limitedCardsToInsert); // Use the limited array

    if (cardsError) {
        console.error("Supabase error inserting cards:", cardsError);
        await supabase.from('decks').delete().eq('id', newDeck.id);
        throw new Error("Could not save the generated cards to the database.");
    }

    return NextResponse.json({ success: true, deckId: newDeck.id });

  } catch (error) {
    console.error("Error in generate-deck API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    // Provide more specific error message if it's about PDF parsing
    if (errorMessage.includes("PDF")) {
         return NextResponse.json({ error: errorMessage }, { status: 400 }); // Bad request for PDF issues
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}