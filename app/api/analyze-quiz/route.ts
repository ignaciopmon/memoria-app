// app/api/analyze-quiz/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  try {
    const { wrongQuestions, language, difficulty } = await request.json();

    let difficultyNote = "";
    if (difficulty === "hard") difficultyNote = "Explain profound nuances and advanced concepts.";
    else if (difficulty === "easy") difficultyNote = "Use simple, everyday analogies.";

    const prompt = `
      You are an expert, direct exam analyzer.
      
      **Context:**
      - Language: ${language} (Strictly output the entire response in this language).
      - Mistakes: ${JSON.stringify(wrongQuestions)}
      - Level: ${difficultyNote}

      **Your Goal:** Explain the user's mistakes concisely and brilliantly. 
      **STRICTLY NO INTROS, NO OUTROS. DO NOT wrap the output in JSON. Just return pure Markdown text.**

      **Structure Per Mistake:**
      Write a header with an Emoji related to the question.
      Then write 2 short paragraphs:
      - Paragraph 1: Acknowledge what they answered and gently explain what that concept actually is.
      - Paragraph 2: Explain why the correct answer is the right one, highlighting the key difference.
      Finally, add a blockquote with a "💡 Tip:" or memory hook to remember it forever.

      **FORMATTING RULES:**
      - Use standard Markdown.
      - Use double line breaks (\\n\\n) to separate paragraphs.
      - Add a horizontal rule (---) between different mistakes.

      **Example Output Format:**

      ### ⚖️ Masa vs. Peso

      Seleccionaste **Peso**, que es la medida de la fuerza gravitatoria que actúa sobre un objeto. Sin embargo, la pregunta se refería a la cantidad de materia fundamental de un objeto.

      La respuesta correcta es **Masa** porque es una propiedad intrínseca que se mantiene igual en todo el universo. Es normal confundir una fuerza que cambia con la gravedad (Peso) con una propiedad física constante (Masa).

      > 💡 **Truco mental:** Tu **Masa** es de lo que estás hecho (no la pierdes al ir a la Luna). Tu **Peso** es cuánto tira de ti el planeta (sí cambia en la Luna).

      ---

      (Continuar con la siguiente...)
    `;

    // IMPORTANTE: Hemos quitado el responseMimeType: "application/json" 
    // porque necesitamos texto puro (Markdown) para renderizarlo correctamente.
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ report: result.response.text() });

  } catch (error: any) {
    console.error("Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}