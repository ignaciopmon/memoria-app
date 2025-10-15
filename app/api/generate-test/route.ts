// app/api/generate-test/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Card = {
  front: string;
  back: string;
  last_rating: number | null;
};

interface GenerateTestBody {
  cards: Card[];
  language: string;
  context?: string;
  questionCount: number;
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
    const { cards, language, context, questionCount } = (await request.json()) as GenerateTestBody;

    if (!cards || cards.length === 0) {
      return NextResponse.json({ error: "No cards were provided to generate the test." }, { status: 400 });
    }

    const prompt = `
      You are an expert assistant designed to create study tests. Your task is to generate a ${questionCount}-question multiple-choice quiz in ${language} based on the following list of flashcards.

      ${context ? `Additional context about the topic: "${context}"` : ''}

      Instructions:
      1. Generate exactly ${questionCount} multiple-choice questions.
      2. Each question must have 4 options (A, B, C, D), with only one being correct.
      3. **Prioritize** creating questions from the cards the user finds most difficult. Cards with a 'difficulty' of 'very hard' or 'hard' are the most important.
      4. The questions must be clear, direct, and based on the "front" (question) and "back" (answer) information from each card.
      5. The entire test content (questions, options) must be in ${language}.
      6. For each question, you MUST include a "sourceCardFront" field containing the exact "front" text of the original card you used to create the question. This is crucial for linking the results back.
      7. You MUST return the result exclusively in JSON format, without any extra text, formatting, or markdown like \`\`\`json. The output must be a raw JSON array of objects. Each object must have this exact structure:
          {
            "question": "The question text...",
            "options": { "A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D" },
            "answer": "A",
            "sourceCardFront": "The exact front text of the source card"
          }

      Here is the list of flashcards:
      ${JSON.stringify(
        cards.map((c) => ({
          front: c.front,
          back: c.back,
          difficulty:
            c.last_rating === 1
              ? "very hard"
              : c.last_rating === 2
              ? "hard"
              : "normal",
        }))
      )}
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("Raw AI Response:", text);

    let testData;
    try {
      testData = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse JSON from AI response. Raw text was:", text, parseError);
      throw new Error("The AI returned an invalid response format. Please try again.");
    }
    
    return NextResponse.json(testData);

  } catch (error) {
    console.error("Error in generate-test API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}