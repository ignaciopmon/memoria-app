// app/api/process-test-results/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server"; // Usamos el cliente de servidor para operaciones seguras
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// Tipos de datos que recibimos
interface TestResult {
  question: string;
  userAnswer: string | null;
  correctAnswer: string;
  sourceCardFront: string;
}

interface ProcessTestBody {
  results: TestResult[];
  language: string;
}

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("CRITICAL: GOOGLE_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error: The API Key is missing." },
      { status: 500 }
    );
  }

  try {
    // Usamos el cliente de Supabase del lado del servidor para poder realizar actualizaciones seguras
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
    }

    const { results, language } = (await request.json()) as ProcessTestBody;

    // Obtenemos los ajustes de intervalos del usuario para darle más contexto a la IA
    const { data: userSettings } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single();
    const settings = userSettings || { again_interval_minutes: 1, hard_interval_days: 1, good_interval_days: 3, easy_interval_days: 7 };

    for (const result of results) {
      if (result.userAnswer === null) continue; // No procesamos preguntas no respondidas

      const isCorrect = result.userAnswer === result.correctAnswer;
      
      const { data: card, error: cardError } = await supabase
        .from('cards')
        .select('id, next_review_date, interval, repetitions, ease_factor')
        .eq('front', result.sourceCardFront)
        .eq('user_id', user.id) // Aseguramos que solo modificamos tarjetas del usuario
        .single();

      if (cardError || !card) continue;

      const prompt = `
        You are an expert AI tutor using a spaced repetition system. A user has answered a test question related to a flashcard. Based on their performance and their personal settings, decide the next review date for this card.

        **User's Personal Settings:**
        - "Again" (forgotten): review in ${settings.again_interval_minutes} minutes.
        - "Hard": review in ${settings.hard_interval_days} days.
        - "Good": review in ${settings.good_interval_days} days.

        **Card's Current Status:**
        - Card Content: "${result.sourceCardFront}"
        - Current scheduled review date: ${card.next_review_date}
        - User's answer to the test question was: ${isCorrect ? "CORRECT" : "INCORRECT"}.

        **Your Task:**
        1.  **If the answer was INCORRECT:** You MUST reschedule the card for an earlier review. A short interval (like the user's "Again" or "Hard" setting) is appropriate. The card needs reinforcement.
        2.  **If the answer was CORRECT:** You MUST postpone the card's review to a later date. If the current review date was already far in the future, you can push it even further. This shows mastery.
        3.  Your response MUST be ONLY a raw JSON object with two fields:
            - "new_review_date": A new review date in UTC ISO 8601 format ('YYYY-MM-DDTHH:mm:ss.sssZ').
            - "reason": A very brief explanation in '${language}' for the change.

        **Example for an INCORRECT answer:**
        {
          "new_review_date": "${new Date(Date.now() + settings.again_interval_minutes * 60000).toISOString()}",
          "reason": "Repaso adelantado por fallo en el test."
        }

        **Example for a CORRECT answer:**
        {
          "new_review_date": "${new Date(Date.now() + 10 * 24 * 60 * 60000).toISOString()}",
          "reason": "Repaso pospuesto por acierto en el test."
        }
      `;

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const aiResult = await model.generateContent(prompt);
      const aiResponseText = aiResult.response.text().replace(/^```json\n/, "").replace(/\n```$/, "");
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