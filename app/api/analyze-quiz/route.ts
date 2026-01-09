import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  try {
    const { wrongQuestions, language } = await request.json();

    // Instrucciones de "Entrenador de Estudio" para la IA
    const prompt = `
      You are an elite study coach (a friendly, encouraging mentor). The user just made mistakes on a test.
      
      **Context:**
      - Language: ${language} (Write STRICTLY in this language).
      - Mistakes: ${JSON.stringify(wrongQuestions)}

      **Your Goal:** Don't just list the answers. Explain the *logic* so they never forget it again. Be concise but highly effective.

      **Strict Formatting Rules:**
      1. Use Emojis for section headers.
      2. Use **Bold** for key concepts.
      3. **CRITICAL:** Use DOUBLE LINE BREAKS (\n\n) between every single paragraph or list item. The text must breathe.

      **Required Structure:**

      ## 🧐 Diagnosis
      (A 2-sentence encouraging summary of why they might have failed. E.g., "You mixed up dates," or "You need to review the core concepts of X.")

      ## 🧠 Mental Fixes
      (Go through the mistakes. Do NOT just give the answer. Give a logic, a trick, or a connection to remember it.)
      - **[Concept Name]**: Explain the correct fact clearly.
      
      ## 🚀 Next Step
      (One single, powerful action they can take right now to master this topic).
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ report: result.response.text() });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}