import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
// Use the fixed fork
const pdfParse = require('@cyber2024/pdf-parse-fixed');

export const dynamic = "force-dynamic";

// Helper para limpiar JSON
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

export async function POST(request: Request) {
  if (!apiKey) return NextResponse.json({ error: "API Key missing" }, { status: 500 });

  try {
    const formData = await request.formData();
    const topic = formData.get('topic') as string | null;
    const questionCount = formData.get('questionCount') as string;
    const difficulty = formData.get('difficulty') as string;
    const language = formData.get('language') as string;
    const pdfFile = formData.get('pdfFile') as File | null;

    let sourceMaterial = "";
    
    if (pdfFile) {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const data = await pdfParse(buffer);
        sourceMaterial = `Content from PDF: ${data.text.slice(0, 30000)}`; // Limitamos caracteres para no saturar
    } else {
        sourceMaterial = `Topic: ${topic}`;
    }

    const prompt = `
      You are a strict exam generator.
      **Source:** ${sourceMaterial}
      **Task:** Generate exactly ${questionCount} multiple-choice questions.
      **Difficulty:** ${difficulty}
      **Language:** ${language} (Strictly output questions/answers in this language).

      **Output Format:** Raw JSON Array. No markdown.
      Structure:
      [
        {
          "question": "Question text here",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": "Option A" (Must match exactly one of the options)
        }
      ]
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const quizData = cleanAndParseJSON(text);

    return NextResponse.json(quizData);

  } catch (error: any) {
    console.error("Quiz Gen Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}