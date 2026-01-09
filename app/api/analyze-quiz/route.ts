import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  try {
    const { wrongQuestions, language } = await request.json();

    const prompt = `
      You are a helpful tutor. The user just failed a test.
      **Language:** ${language} (Write the report in this language).
      
      **Failed Questions:**
      ${JSON.stringify(wrongQuestions)}

      **Task:**
      1. Analyze why the user might have failed (patterns, specific missing concepts).
      2. Provide a concise "Study Report" with tips to memorize these specific facts.
      3. Be encouraging but direct about the knowledge gaps.
      4. Use Markdown formatting (bolding key terms).
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ report: result.response.text() });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}