// app/api/generate-quiz/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Prevenir timeout

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

// Orden de modelos
const MODELS = [
  "gemini-2.5-flash",
  "gemma-3-27b",
  "gemma-3-12b"
];

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
    
    let avoidInstruction = "";
    if (avoidQuestionsJson) {
        const avoidList = JSON.parse(avoidQuestionsJson);
        if (avoidList.length > 0) {
            avoidInstruction = `**IMPORTANT:** Do NOT generate questions similar to these (the user already answered them): ${JSON.stringify(avoidList.slice(0, 20))}. Generate FRESH content.`;
        }
    }

    let promptParts: any[] = [];
    let sourceInstruction = "";

    if (pdfFile) {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        promptParts.push({
            inlineData: { data: base64Data, mimeType: "application/pdf" }
        });
        sourceInstruction = `Use the attached PDF document as the ONLY source material.`;
    } else {
        sourceInstruction = `Topic: ${topic}`;
    }

    const promptText = `
      You are a strict exam generator.
      **Source:** ${sourceInstruction}
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

    promptParts.unshift(promptText);

    let quizData;
    let success = false;
    let lastError: any;

    // SISTEMA DE FALLBACK
    for (const modelName of MODELS) {
        try {
            console.log(`Generando quiz con: ${modelName}`);
            
            const generationConfig = modelName.includes("gemini") 
                ? { responseMimeType: "application/json" } 
                : undefined;

            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig
            });
            
            const result = await model.generateContent(promptParts);
            quizData = cleanAndParseJSON(result.response.text());
            
            if (!Array.isArray(quizData)) throw new Error("Invalid JSON structure");

            success = true;
            break;
        } catch (aiError: any) {
            console.warn(`Error en quiz con ${modelName}:`, aiError.message);
            lastError = aiError;
        }
    }

    if (!success || !quizData) {
        return NextResponse.json({ error: `Falló la creación del test. Todos los modelos devolvieron error.` }, { status: 500 });
    }

    return NextResponse.json(quizData);

  } catch (error: any) {
    console.error("Quiz Gen Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}