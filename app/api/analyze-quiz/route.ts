import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  try {
    const { wrongQuestions, language, difficulty } = await request.json();

    // Instrucciones de tono basadas en la dificultad, pero siempre DETALLADAS
    let toneInstruction = "Role: You are a passionate, expert University Professor who loves to explain things in depth.";
    if (difficulty === "hard") {
        toneInstruction += " Treat the user as an advanced student. Dive deep into theoretical nuances, exceptions, and complex relationships.";
    } else if (difficulty === "easy") {
        toneInstruction += " Use clear analogies and step-by-step logic, but DO NOT be brief. Explain the foundation of the concept fully.";
    } else {
        toneInstruction += " Be academic, thorough, and rigourous.";
    }

    const prompt = `
      ${toneInstruction}
      
      **Context:**
      - Language: ${language} (Write STRICTLY in this language).
      - Mistakes: ${JSON.stringify(wrongQuestions)}

      **Your Goal:** Provide a **MASSIVE, COMPREHENSIVE, and DETAILED** analysis of the user's errors. 
      **DO NOT BE BRIEF.** The user wants to understand *everything* about these specific concepts to ensure they never fail again.
      
      For each mistake, you must:
      1. **Explain the Concept:** Define what the term or concept actually is in detail.
      2. **Debunk the Error:** Explain exactly *why* the user's specific answer was wrong (what is the common confusion?).
      3. **Verify the Truth:** Explain *why* the correct answer is the right one.
      4. **Mastery Hook:** Provide a mnemonic, etymology, or deep logic to lock this into memory.

      **Formatting Rules (CRITICAL for Readability):**
      1. Use **Bold** for key terms and headers.
      2. Use Emojis to structure the sections.
      3. **MANDATORY:** Use **DOUBLE LINE BREAKS** (\n\n) between EVERY single paragraph, list item, or section. The text must look spacious and easy to read.

      **Required Report Structure:**

      ## 🧐 Comprehensive Diagnosis
      (A detailed paragraph analyzing the user's performance. Identify the *type* of thinking error they are making. Are they mixing up dates? Misunderstanding definitions? rushing?)

      ## 🧠 Deep Dive & Corrections
      (Iterate through every mistake. This section should be long and educational.)
      
      *Format each mistake clearly like this:*
      
      ### ❌ Mistake: [Question Topic/Concept]
      
      **The Theory:**
      [Detailed explanation of the concept from scratch...]
      
      **Why your answer was wrong:**
      [Analyze the specific wrong option the user chose. Why is it a trap?]
      
      **The Correct Logic:**
      [Walk through the logic to arrive at the correct answer.]
      
      **💡 Professor's Tip:**
      [A mental hook or mnemonic to remember it.]
      
      *(Insert triple line break here)*

      ## 📚 Final Study Recommendation
      (Conclude with a specific, high-impact study task based on this analysis).
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ report: result.response.text() });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}