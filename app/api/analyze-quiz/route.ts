import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  try {
    const { wrongQuestions, language, difficulty } = await request.json();

    let difficultyNote = "";
    if (difficulty === "hard") difficultyNote = "Explain profound nuances.";
    else if (difficulty === "easy") difficultyNote = "Use simple analogies.";

    const prompt = `
      You are a direct, no-nonsense exam analyzer.
      
      **Context:**
      - Language: ${language} (Strictly output in this language).
      - Mistakes: ${JSON.stringify(wrongQuestions)}
      - Level: ${difficultyNote}

      **Your Goal:** Explain mistakes concisely but thoroughly. 
      **STRICTLY NO INTROS, NO OUTROS, NO HELLO, NO "HERE IS YOUR REPORT". Start directly with the first mistake.**

      **Structure Per Mistake:**
      1. **Header:** Use "### " followed by an Emoji and the Question Concept.
      2. **The Analysis (The most important part):** Write ONE or TWO solid paragraphs that combine:
         - What the user's wrong answer actually refers to (contextualize their error).
         - Why it is incorrect in this context.
         - Why the correct answer is the right one.
      3. **The Trick:** A distinct, short bold line with logic hook.

      **FORMATTING RULES (READ CAREFULLY):**
      - **CRITICAL:** You MUST use double line breaks (\\n\\n) to separate paragraphs. Single line breaks are ignored by the renderer.
      - **CRITICAL:** Add a horizontal rule (---) between each mistake item to visually separate them.
      - Do not use sub-headers like "Why you were wrong:" or "Correct Answer:". Just write the explanation naturally.

      **Example Output Format:**

      ### ⚖️ Mass vs. Weight

      You selected **Weight**, which is the measure of the gravitational pull acting on an object. However, the question asked for the fundamental measurement of the amount of "stuff" or matter an object contains.

      The correct answer is **Mass** because it is an intrinsic property that stays the same everywhere in the universe. You likely confused a force that changes with gravity (Weight) with a physical property that is constant (Mass).

      **💡 Logic Hook:** Your **Mass** is the "stuff" you are made of. You don't lose "stuff" just by traveling to the Moon, but you do lose **Weight** because the Moon isn't pulling on your "stuff" as hard as Earth does.

      ---
    \\n\n
      ### 📅 French Revolution Date

      (Next analysis...)
    `;

    const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: { responseMimeType: "application/json" } // Obliga a devolver JSON válido siempre
});
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ report: result.response.text() });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}