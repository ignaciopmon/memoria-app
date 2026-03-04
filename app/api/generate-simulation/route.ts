import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cleanAndParseJSON(text: string) {
    let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const firstOpen = cleanText.indexOf('[');
    const lastClose = cleanText.lastIndexOf(']');
    if (firstOpen !== -1 && lastClose !== -1) {
        cleanText = cleanText.substring(firstOpen, lastClose + 1);
    }
    return JSON.parse(cleanText);
}

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");
const MODELS = ["gemini-2.5-flash", "gemma-3-27b", "gemma-3-12b"];

export async function POST(request: Request) {
  if (!apiKey) return NextResponse.json({ error: "API Key missing" }, { status: 500 });

  try {
    const { topics, questionCount = 10, language = "English" } = await request.json();

    if (!topics || topics.length === 0) {
        return NextResponse.json({ error: "No topics provided" }, { status: 400 });
    }

    const promptText = `
      You are an expert exam generator creating an Infinite Mixed Simulation.
      **Topics to cover:** ${topics.join(" | ")}
      **Task:** Generate exactly ${questionCount} multiple-choice questions distributing them evenly across these topics.
      **Difficulty:** Hard (Simulation Level)
      **Language:** ${language} (Strictly output questions/answers in this language).

      **Output Format:** Raw JSON Array. No markdown.
      Structure:
      [
        {
          "topic": "The exact name of the topic from the list provided above this question belongs to",
          "question": "Question text here",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": "Option A"
        }
      ]
    `;

    let quizData;
    let success = false;

    for (const modelName of MODELS) {
        try {
            const generationConfig = modelName.includes("gemini") ? { responseMimeType: "application/json" } : undefined;
            const model = genAI.getGenerativeModel({ model: modelName, generationConfig });
            const result = await model.generateContent([promptText]);
            quizData = cleanAndParseJSON(result.response.text());
            if (!Array.isArray(quizData)) throw new Error("Invalid JSON");
            success = true;
            break;
        } catch (error) {
            console.warn(`Failed with ${modelName}`);
        }
    }

    if (!success || !quizData) throw new Error("All AI models failed");
    return NextResponse.json(quizData);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}