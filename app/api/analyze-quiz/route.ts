import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  try {
    const { wrongQuestions, language } = await request.json();

    const prompt = `
      You are an expert tutor. The user failed a test.
      **Language:** ${language} (Write strictly in this language).
      
      **Failed Questions:**
      ${JSON.stringify(wrongQuestions)}

      **Task:**
      Create a structured study report using Markdown.
      
      **Structure Required:**
      1. Start with an encouraging title (use ##).
      2. Analyze the main knowledge gaps (use normal paragraphs with **bold** concepts).
      3. Provide a list of "Key Facts to Remember" (use bullet points -).
      4. End with a quick study tip.

      **IMPORTANT FORMATTING RULES:**
      - Use **double line breaks** between every paragraph.
      - Do not simply list the questions again. Synthesize the missing knowledge.
      - Keep it concise but helpful.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ report: result.response.text() });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}