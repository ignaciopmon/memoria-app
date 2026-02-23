// app/api/generate-test/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Prevenir timeout

function cleanAndParseJSON(text: string) {
    let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const firstOpen = cleanText.indexOf('[');
    const lastClose = cleanText.lastIndexOf(']');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        cleanText = cleanText.substring(firstOpen, lastClose + 1);
    }
    return JSON.parse(cleanText);
}

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

const MODELS = [
  "gemini-2.5-flash",
  "gemma-3-27b",
  "gemma-3-12b"
];

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

    let testData;
    let success = false;
    let lastError: any;

    // SISTEMA DE FALLBACK
    for (const modelName of MODELS) {
        try {
            console.log(`Generando Test en base a mazo con: ${modelName}`);
            
            const generationConfig = modelName.includes("gemini") 
                ? { responseMimeType: "application/json" } 
                : undefined;

            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig
            });
            
            const result = await model.generateContent(prompt);
            testData = cleanAndParseJSON(result.response.text());
            
            if (!Array.isArray(testData)) throw new Error("Invalid JSON structure");

            success = true;
            break;
        } catch (aiError: any) {
            console.warn(`Error generando Test con ${modelName}:`, aiError.message);
            lastError = aiError;
        }
    }

    if (!success || !testData) {
        return NextResponse.json({ error: `Fallo tras intentar todos los modelos AI.` }, { status: 500 });
    }
    
    return NextResponse.json(testData);

  } catch (error) {
    console.error("Error in generate-test:", error);
    const errorMessage = error instanceof Error ? error.message : "Server error.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}