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
      return NextResponse.json({ error: "No cards were provided." }, { status: 400 });
    }

    const shuffledCards = [...cards].sort(() => 0.5 - Math.random());
    const selectedCards = shuffledCards.slice(0, questionCount);

    const prompt = `
      You are an expert assistant designed to create study tests.
      Task: Generate a ${selectedCards.length}-question multiple-choice quiz in ${language}.
      Context: ${context || 'General Study'}

      Instructions:
      1. One question per card provided below.
      2. 4 options (A, B, C, D), only one correct.
      3. Return ONLY raw JSON array.
      4. Format: [{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "answer": "A", "sourceCardFront": "..."}]

      Cards:
      ${JSON.stringify(selectedCards)}
    `;

    // UPDATED MODEL TO gemini-2.0-flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    let testData;
    try {
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : text;
      testData = JSON.parse(jsonString);
    } catch (parseError) {
      throw new Error("AI response format invalid.");
    }
    
    return NextResponse.json(testData);

  } catch (error) {
    console.error("Error in generate-test:", error);
    const errorMessage = error instanceof Error ? error.message : "Server error.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}