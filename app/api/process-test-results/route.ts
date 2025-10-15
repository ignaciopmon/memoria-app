// app/api/process-test-results/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Tipos de datos que recibimos
interface TestResult {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  sourceCardFront: string;
}

interface ProcessTestBody {
  results: TestResult[];
  language: string;
}

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  if (!apiKey) {
    return NextResponse.json({ error: "Server configuration error: Missing API Key." }, { status: 500 });
  }

  try {
    const supabase = await createClient();
    const { results, language } = (await request.json()) as ProcessTestBody;

    // Filtramos solo las tarjetas que necesitan una decisión de la IA (las que el usuario respondió)
    const cardsToProcess = results.filter(r => r.userAnswer);

    for (const result of cardsToProcess) {
      const isCorrect = result.userAnswer === result.correctAnswer;
      
      const { data: card, error: cardError } = await supabase
        .from('cards')
        .select('id, next_review_date, interval, repetitions, ease_factor')
        .eq('front', result.sourceCardFront)
        .single();

      if (cardError || !card) continue;

      const prompt = `
        Eres un tutor de IA experto en repetición espaciada. Un usuario ha respondido a una pregunta sobre una tarjeta de estudio. Tu tarea es decidir la nueva fecha de revisión para esta tarjeta.

        Contexto:
        - Tarjeta (pregunta): "${result.sourceCardFront}"
        - Fecha de revisión actual: ${card.next_review_date}
        - El usuario ha respondido ${isCorrect ? "CORRECTAMENTE" : "INCORRECTAMENTE"} a la pregunta del test.

        Instrucciones:
        1.  Si la respuesta fue INCORRECTA: Debes ADELANTAR la fecha de revisión para que el usuario la repase pronto. Un buen intervalo sería entre 1 y 3 días a partir de hoy.
        2.  Si la respuesta fue CORRECTA: Debes ALEJAR la fecha de revisión. Un buen intervalo sería entre 7 y 14 días a partir de hoy, o incluso más si el intervalo actual ya era grande.
        3.  Tu respuesta DEBE ser únicamente un objeto JSON con dos claves: "new_review_date" (en formato 'YYYY-MM-DDTHH:mm:ss.sssZ') y "reason" (una explicación muy breve en ${language} de por qué has cambiado la fecha).

        Ejemplo de respuesta si fue incorrecta:
        {
          "new_review_date": "2025-10-16T12:00:00.000Z",
          "reason": "Repaso adelantado por fallo en el test de IA."
        }

        Ejemplo de respuesta si fue correcta:
        {
          "new_review_date": "2025-10-25T12:00:00.000Z",
          "reason": "Repaso pospuesto por acierto en el test de IA."
        }
      `;

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const aiResult = await model.generateContent(prompt);
      const aiResponseText = aiResult.response.text();
      const aiSuggestion = JSON.parse(aiResponseText);

      // Actualizamos la tarjeta en la base de datos con la nueva fecha y la sugerencia de la IA
      await supabase
        .from('cards')
        .update({ 
          next_review_date: aiSuggestion.new_review_date,
          ai_suggestion: { reason: aiSuggestion.reason, previous_date: card.next_review_date }
        })
        .eq('id', card.id);
    }

    return NextResponse.json({ success: true, message: "Card reviews updated by AI." });

  } catch (error) {
    console.error("Error processing test results:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}