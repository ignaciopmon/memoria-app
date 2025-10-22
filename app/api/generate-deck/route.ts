// app/api/generate-deck/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
// Use require for pdf-parse for better compatibility in Node.js environments
const pdfParse = require('pdf-parse');

export const dynamic = "force-dynamic";

// Helper function to parse page ranges (e.g., "1-3, 5, 7-")
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
        return null; // Indicate error parsing
    }
}

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("CRITICAL: GOOGLE_API_KEY is not set in environment variables.");
}

// export const maxDuration = 60; // Uncomment if on a Vercel Pro plan

export async function POST(request: Request) {
  console.log("generate-deck API route started.");
  if (!apiKey) {
    console.error("API key missing in generate-deck.");
    return NextResponse.json(
      { error: "Server configuration error: The API Key is missing." },
      { status: 500 }
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey); // Moved instantiation here

  try {
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
       console.error("Authentication failed in generate-deck.");
      return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
    }
    console.log("User authenticated.");

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
    console.log("Form data received:", { deckName, cardType, cardCountStr, language, difficulty, generationSource, topic: topic?.substring(0, 50) + '...', pdfFileName: pdfFile?.name, pageRangeStr });


    const cardCount = cardCountStr ? parseInt(cardCountStr, 10) : 0;

    // --- VALIDATIONS ---
    if (!deckName || !cardType || !cardCount || !language || !difficulty || !generationSource) {
      console.error("Validation failed: Missing required fields.");
      return NextResponse.json({ error: "Missing required fields in form data." }, { status: 400 });
    }
    if (generationSource === 'topic' && (!topic || !topic.trim())) {
        console.error("Validation failed: Topic required but missing/empty.");
        return NextResponse.json({ error: "Topic description is required for topic-based generation." }, { status: 400 });
    }
    if (generationSource === 'pdf' && !pdfFile) {
        console.error("Validation failed: PDF required but missing.");
        return NextResponse.json({ error: "PDF file is required for PDF-based generation." }, { status: 400 });
    }
     console.log("Initial validations passed.");
    // --- END VALIDATIONS ---


    // --- PDF Processing Logic ---
    let pdfTextContent = "";
    let contextDescription = `Topic: ${topic}`;

    if (generationSource === 'pdf' && pdfFile) {
        console.log("Starting PDF processing...");
        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            console.log(`PDF buffer size: ${buffer.length} bytes`);
            const data = await pdfParse(buffer);
            console.log(`PDF parsed: ${data.numpages} pages.`);

            const totalPages = data.numpages;
            let targetPages: number[] | null = null;

            if (pageRangeStr && pageRangeStr.trim() !== '') {
                targetPages = parsePageRange(pageRangeStr, totalPages);
                if (targetPages === null) {
                    console.error("PDF page range parsing failed.");
                    return NextResponse.json({ error: "Invalid page range format provided. Use commas and hyphens, e.g., 1-3, 5, 7-10." }, { status: 400 });
                }
                 console.log(`Target pages parsed: ${targetPages.join(', ')}`);
            } else {
                 console.log("No specific page range provided, using all pages.");
            }

            if (targetPages) {
                const allPagesText = data.text.split(/\f/);
                 console.log(`Total text chunks (split by page break): ${allPagesText.length}`);
                pdfTextContent = targetPages
                                .map(pageNum => allPagesText[pageNum - 1])
                                .filter(text => text)
                                .join('\n\n---\n\n');
                contextDescription = `Content extracted from PDF '${pdfFile.name}' (Pages: ${pageRangeStr})`;

            } else {
                pdfTextContent = data.text;
                contextDescription = `Content extracted from PDF '${pdfFile.name}' (All Pages)`;
            }

             console.log(`Extracted PDF text length: ${pdfTextContent.length} characters.`);
            if (!pdfTextContent.trim()) {
                 console.error("PDF text content is empty after processing.");
                return NextResponse.json({ error: "Could not extract text from the specified PDF pages or the PDF is empty." }, { status: 400 });
            }
             console.log("PDF processing successful.");

        } catch (pdfError: any) {
            console.error("Error during PDF processing:", pdfError);
            const message = pdfError.message?.includes('password')
                ? "Failed to process PDF: The file might be password-protected."
                : "Failed to process the PDF file. It might be corrupted.";
            return NextResponse.json({ error: message }, { status: 500 });
        }
    }
    // --- End PDF Processing Logic ---

    const cardTypeInstructions = { /* ... (keep as before) ... */ };
    const difficultyInstructions = { /* ... (keep as before) ... */ };

    // --- Prompt definition (keep as before) ---
    const sourceMaterial = generationSource === 'pdf' ? `\n${contextDescription}\n\n"""\n${pdfTextContent}\n"""` : topic;
    const prompt = `
      You are an expert in creating educational content. Your task is to generate a set of flashcards for a user based on the provided source.

      **Source Material:** ${sourceMaterial}
      **Language:** ${language}
      **Number of Cards to Generate:** ${cardCount}
      **Card Type:** ${cardTypeInstructions[cardType!]}
      **Difficulty Level:** ${difficultyInstructions[difficulty!]}

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
    // --- End Prompt definition ---

    console.log("Generating AI prompt...");

    let generatedCards;
    let text = '';

    try {
        console.log("Calling AI model...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Or "gemini-pro"
        const result = await model.generateContent(prompt);
        const response = await result.response;
        text = response.text();
        console.log("Raw AI Response Text:", text);

        if (!text || !text.trim()) {
            throw new Error("AI returned an empty response.");
        }

        // --- More Robust JSON Extraction ---
        let jsonString = text.trim();

        // 1. Try finding JSON within markdown ```json ... ```
        const markdownMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
        if (markdownMatch && markdownMatch[1]) {
            jsonString = markdownMatch[1].trim();
            console.log("Extracted JSON from markdown block.");
        } else {
             // 2. Try finding a JSON array `[...]` anywhere in the string
            const arrayMatch = jsonString.match(/(\[\s*\{[\s\S]*?\}\s*])/);
            if (arrayMatch && arrayMatch[0]) {
                jsonString = arrayMatch[0].trim();
                 console.log("Extracted JSON array using regex match.");
            } else {
                 console.log("No clear JSON structure found via regex, attempting direct parse.");
                // If neither works, assume the whole string might be JSON (or fail)
            }
        }

        // 3. Check if the result looks like JSON before parsing
        if (!jsonString.startsWith('[') || !jsonString.endsWith(']')) {
             console.error("Cleaned text does not appear to be a JSON array:", jsonString);
             throw new Error("AI response did not contain a valid JSON array structure.");
        }

        // 4. Attempt to parse
        generatedCards = JSON.parse(jsonString);

        if (!Array.isArray(generatedCards) || generatedCards.some(c => typeof c.front !== 'string' || typeof c.back !== 'string')) {
             console.error("Parsed JSON has invalid structure:", generatedCards);
            throw new Error("Invalid JSON structure received from AI after parsing.");
        }
        console.log(`Successfully parsed ${generatedCards.length} cards from AI response.`);
        // --- End JSON Extraction ---

    } catch (aiError: any) {
        console.error("Error during AI call or JSON parsing:", aiError);
        console.error("Raw AI Text when error occurred:", text); // Log text again on error
        // Provide a clearer error message
        const message = aiError.message?.includes("JSON")
            ? "Failed to process the AI's response. It returned an invalid format. Please try again or check the source content."
            : "An error occurred while generating content with the AI.";
        return NextResponse.json({ error: message }, { status: 500 });
    }

    // --- DATABASE INSERTION ---
     console.log("Attempting to insert deck into database...");
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
        console.error("Supabase error creating deck:", deckError);
        throw new Error("Could not create the new deck in the database."); // Will be caught below
    }
     console.log(`Deck created successfully with ID: ${newDeck.id}`);

    const cardsToInsert = generatedCards.map((card: {front: string, back: string}) => ({
        deck_id: newDeck.id,
        front: card.front,
        back: card.back,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString()
    }));

    const limitedCardsToInsert = cardsToInsert.slice(0, cardCount);
     console.log(`Attempting to insert ${limitedCardsToInsert.length} cards into database...`);

    const { error: cardsError } = await supabase
        .from('cards')
        .insert(limitedCardsToInsert);

    if (cardsError) {
        console.error("Supabase error inserting cards:", cardsError);
         console.log(`Rolling back deck creation (ID: ${newDeck.id}) due to card insertion error.`);
        await supabase.from('decks').delete().eq('id', newDeck.id); // Rollback deck
        throw new Error("Could not save the generated cards to the database after deck creation."); // Will be caught below
    }
     console.log("Cards inserted successfully.");

     console.log("generate-deck API route finished successfully.");
    return NextResponse.json({ success: true, deckId: newDeck.id });

  } catch (error: any) {
    console.error("!!! Critical Error in generate-deck API route:", error); // Log clearly it's the final catch
    const errorMessage = error.message || "An unknown server error occurred during deck generation.";
    const statusCode = error.message?.includes("database") ? 500 : 400; // Guess status based on likely cause

    // Ensure this ALWAYS returns valid JSON
    return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
    );
  }
}