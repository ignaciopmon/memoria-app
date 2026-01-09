import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  try {
    // Recibimos la dificultad aquí
    const { wrongQuestions, language, difficulty } = await request.json();

    // Definimos la personalidad según la dificultad
    let toneInstruction = "";
    if (difficulty === "hard") {
        toneInstruction = "Tone: Rigorous, academic, and detailed. Focus on nuances, exceptions, and deep connections. Treat the user as an advanced student.";
    } else if (difficulty === "easy") {
        toneInstruction = "Tone: Gentle, encouraging, and simple. Focus on the absolute basics and mnemonics. Treat the user as a beginner.";
    } else {
        toneInstruction = "Tone: Balanced, clear, and efficient. Focus on standard concepts.";
    }

    const prompt = `
      You are an elite study coach. The user just failed a ${difficulty} difficulty test.
      
      **Context:**
      - Language: ${language} (Write STRICTLY in this language).
      - Mistakes: ${JSON.stringify(wrongQuestions)}
      - ${toneInstruction}

      **Formatting Rules (CRITICAL):**
      1. Use **Bold** for key terms.
      2. Use Emojis for section headers.
      3. **MANDATORY:** Use double line breaks (\n\n) between EVERY single paragraph or list item to ensure good readability. Do not output big blocks of text.

      **Required Structure:**

      ## 🧐 Diagnosis
      (A short paragraph explaining the *pattern* of their mistakes. Why did they fail? Be specific.)

      ## 🧠 Knowledge Fixes
      (Go through the concepts they missed. Don't just give the answer. Explain the *logic* or *trick* to remember it forever.)
      
      *List each concept like this, with a blank line between them:*
      
      - **[Concept Name]**: Explanation...
      
      - **[Concept Name]**: Explanation...

      ## 🚀 Action Plan
      (One concrete thing they should do right now, tailored to the ${difficulty} level).
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ report: result.response.text() });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}