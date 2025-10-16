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

    // Seleccionar un subconjunto aleatorio de tarjetas si hay más de las solicitadas
    const shuffledCards = [...cards].sort(() => 0.5 - Math.random());
    const selectedCards = shuffledCards.slice(0, questionCount);

    const prompt = `
      You are an expert assistant designed to create study tests. Your task is to generate a ${selectedCards.length}-question multiple-choice quiz in ${language} based on the following list of flashcards.

      ${context ? `Additional context about the topic: "${context}"` : ''}

      Instructions:
      1. Generate exactly ${selectedCards.length} multiple-choice questions, one for each card provided.
      2. Each question must have 4 options (A, B, C, D), with only one being correct.
      3. The questions must be clear, direct, and based on the "front" (question) and "back" (answer) information from each card.
      4. The entire test content (questions, options) must be in ${language}.
      5. For each question, you MUST include a "sourceCardFront" field containing the exact "front" text of the original card you used to create the question. This is crucial for linking the results back.
      6. You MUST return the result exclusively in raw JSON format. Do not add any introductory text, concluding text, or markdown formatting like \`\`\`json. The output must be a raw JSON array of objects only. Each object must have this exact structure:
          {
            "question": "The question text...",
            "options": { "A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D" },
            "answer": "A",
            "sourceCardFront": "The exact front text of the source card"
          }

      Here is the list of flashcards to use:
      ${JSON.stringify(selectedCards)}
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // console.log("Raw AI Response:", text);

    let testData;
    try {
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : text;
      testData = JSON.parse(jsonString);

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