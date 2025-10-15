// app/api/generate-test/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Asegurarnos de que esta ruta solo se ejecute en el servidor
export const dynamic = "force-dynamic";

// Tipos para los datos que esperamos
type Card = {
  front: string;
  back: string;
  last_rating: number | null;
};

// 1. Inicializamos el cliente de la IA de Google
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

// 2. Definimos la función que gestionará las peticiones POST
export async function POST(request: Request) {
  try {
    const { cards } = (await request.json()) as { cards: Card[] };

    if (!cards || cards.length === 0) {
      return NextResponse.json({ error: "No cards provided" }, { status: 400 });
    }

    // 3. Creamos el "prompt": las instrucciones para la IA
    const prompt = `
      Eres un asistente experto en crear tests de estudio. Tu tarea es generar un cuestionario de 5 preguntas en formato JSON basado en la siguiente lista de tarjetas (flashcards).

      Instrucciones:
      1.  Genera exactamente 5 preguntas de opción múltiple.
      2.  Cada pregunta debe tener 4 opciones (A, B, C, D), donde solo una es la correcta.
      3.  **Prioriza** la creación de preguntas basadas en las tarjetas que el usuario ha encontrado más difíciles. Las tarjetas con 'last_rating' de 1 o 2 son las más difíciles. Las que tienen 'last_rating' de 3 o 4 son más fáciles. Las que tienen 'null' son nuevas.
      4.  Las preguntas deben ser claras y directas, basadas en la información "front" (pregunta) y "back" (respuesta) de cada tarjeta.
      5.  Devuelve el resultado exclusivamente en formato JSON, sin añadir ningún texto o formato adicional antes o después del JSON. La estructura debe ser un array de objetos, donde cada objeto representa una pregunta con la siguiente forma:
          {
            "question": "Texto de la pregunta...",
            "options": {
              "A": "Opción A",
              "B": "Opción B",
              "C": "Opción C",
              "D": "Opción D"
            },
            "answer": "A" // Letra de la opción correcta
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

    // 4. Llamamos al modelo de IA
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 5. Limpiamos y parseamos la respuesta JSON
    // A veces, la IA puede devolver el JSON dentro de un bloque de código markdown.
    const cleanedText = text.replace(/^```json\n/, "").replace(/\n```$/, "");
    const testData = JSON.parse(cleanedText);

    return NextResponse.json(testData);
  } catch (error) {
    console.error("Error generating test:", error);
    return NextResponse.json(
      { error: "Failed to generate test. Please try again." },
      { status: 500 }
    );
  }
}