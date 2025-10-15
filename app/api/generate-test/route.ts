// app/api/generate-test/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Card = {
  front: string;
  back: string;
  last_rating: number | null;
};

interface GenerateTestBody {
  cards: Card[];
  language: string;
  context?: string;
}

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("GOOGLE_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error: Missing API Key." },
      { status: 500 }
    );
  }

  try {
    const { cards, language, context } = (await request.json()) as GenerateTestBody;

    if (!cards || cards.length === 0) {
      return NextResponse.json({ error: "No cards provided" }, { status: 400 });
    }

    const prompt = `
      Eres un asistente experto en crear tests de estudio. Tu tarea es generar un cuestionario de 10 preguntas en el idioma '${language}' basado en la siguiente lista de tarjetas (flashcards).

      ${context ? `Contexto adicional sobre el tema: "${context}"` : ''}

      Instrucciones:
      1.  Genera exactamente 10 preguntas de opción múltiple.
      2.  Cada pregunta debe tener 4 opciones (A, B, C, D), donde solo una es la correcta.
      3.  **Prioriza** la creación de preguntas basadas en las tarjetas que el usuario ha encontrado más difíciles. Las tarjetas con 'difficulty' 'very hard' o 'hard' son las más importantes.
      4.  Las preguntas deben ser claras y directas, basadas en la información "front" (pregunta) y "back" (respuesta) de cada tarjeta.
      5.  Todo el contenido del test (preguntas, opciones) debe estar en '${language}'.
      6.  Devuelve el resultado exclusivamente en formato JSON, sin añadir ningún texto o formato adicional antes o después del JSON. La estructura debe ser un array de objetos, donde cada objeto representa una pregunta con la siguiente forma:
          {
            "question": "Texto de la pregunta...",
            "options": {
              "A": "Opción A",
              "B": "Opción B",
              "C": "Opción C",
              "D": "Opción D"
            },
            "answer": "A"
          }

      Aquí está la lista de tarjetas:
      ${JSON.stringify(
        cards.map((c) => ({
          front: c.front,
          back: c.back,
          difficulty:
            c.last_rating === 1
              ? "very hard"
              : c.last_rating === 2
              ? "hard"
              : "normal",
        }))
      )}
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // O 'gemini-pro' si el otro falla
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("Raw AI Response:", text);

    let testData;
    try {
      const cleanedText = text.replace(/^```json\n/, "").replace(/\n```$/, "");
      testData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse JSON from AI response:", parseError);
      throw new Error("The AI returned an invalid response format. Please try again.");
    }
    
    return NextResponse.json(testData);

  } catch (error) {
    console.error("Error in generate-test API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}