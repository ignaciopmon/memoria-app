import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
    const avoidQuestionsJson = formData.get('avoidQuestions') as string | null;
    
    let sourceMaterial = "";
    
    if (pdfFile) {
        // EL REQUIRE AQUÍ ADENTRO, FUERA DEL ALCANCE DE VERCEL BUILD
        const pdfParse = require('@cyber2024/pdf-parse-fixed');
        const arrayBuffer = await pdfFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const data = await pdfParse(buffer);
        sourceMaterial = `Content from PDF: ${data.text.slice(0, 30000)}`;
    } else {
        sourceMaterial = `Topic: ${topic}`;
    }

    let avoidInstruction = "";
    if (avoidQuestionsJson) {
        const avoidList = JSON.parse(avoidQuestionsJson);
        if (avoidList.length > 0) {
            avoidInstruction = `**IMPORTANT:** Do NOT generate questions similar to these (the user already answered them): ${JSON.stringify(avoidList.slice(0, 20))}. Generate FRESH content.`;
        }
    }

    const prompt = `
      You are a strict exam generator.
      **Source:** ${sourceMaterial}
      **Task:** Generate exactly ${questionCount} multiple-choice questions.
      **Difficulty:** ${difficulty}
      **Language:** ${language} (Strictly output questions/answers in this language).
      ${avoidInstruction}

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