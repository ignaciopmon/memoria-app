// app/api/process-test-results/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calculateNextReview, type UserSettings, type Rating, type CardSRS } from "@/lib/srs"; // IMPORTADO

export const dynamic = "force-dynamic";

// --- ELIMINADA LÓGICA SRS DUPLICADA (ahora viene de lib/srs) ---

interface TestResult {
  question: string;
  userAnswer: string | null;
  correctAnswer: string;
  sourceCardFront: string;
}

interface ProcessTestBody {
  results: TestResult[];
}

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error: The API Key is missing." },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
    }

    const { results } = (await request.json()) as ProcessTestBody;

    const { data: userSettingsData } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single();
    const settings: UserSettings = userSettingsData || { again_interval_minutes: 1, hard_interval_days: 1, good_interval_days: 3, easy_interval_days: 7 };

    if (userSettingsData && userSettingsData.enable_ai_suggestions === false) {
        return NextResponse.json({ success: true, message: "AI suggestions are disabled by the user." });
    }

    // Helper para limpiar JSON rebelde (reutilizamos la lógica del otro archivo si es necesario, pero aquí el prompt suele ser corto)
    function cleanAndParseJSON(text: string) {
        let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        const firstOpen = cleanText.indexOf('{');
        const lastClose = cleanText.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            cleanText = cleanText.substring(firstOpen, lastClose + 1);
        }
        return JSON.parse(cleanText);
    }

    for (const result of results) {
      if (result.userAnswer === null) continue;

      const isCorrect = result.userAnswer === result.correctAnswer;

      const { data: card, error: cardError } = await supabase
        .from('cards')
        .select(`
          id, ease_factor, interval, repetitions, last_rating, next_review_date,
          deck:decks!inner(user_id)
        `)
        .eq('front', result.sourceCardFront)
        .eq('decks.user_id', user.id)
        .single();

      if (cardError || !card) {
        continue;
      }
      
      const prompt = `
        You are an expert AI tutor using a Spaced Repetition System (SRS). A user answered a test question.
        
        **Performance:** User answered: ${isCorrect ? "CORRECT" : "INCORRECT"}.
        
        **Card Status:**
        - Content: "${result.sourceCardFront}"
        - Interval: ${card.interval} days
        - Repetitions: ${card.repetitions}

        **Task:** Rate the card (1=Again, 2=Hard, 3=Good, 4=Easy, null=No Change).
        
        Return ONLY valid JSON:
        {
          "rating": <1|2|3|4|null>,
          "reason": "<Short explanation in English>"
        }
      `;

      // Modelo actualizado a gemini-2.5-flash-lite
      const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: { responseMimeType: "application/json" } // Obliga a devolver JSON válido siempre
});
      
      let aiSuggestion;
      try {
        const aiResult = await model.generateContent(prompt);
        const aiResponseText = aiResult.response.text();
        aiSuggestion = cleanAndParseJSON(aiResponseText);
        
        if (![1, 2, 3, 4, null].includes(aiSuggestion.rating)) {
          throw new Error('Invalid rating');
        }
      } catch (e) {
        console.error("AI Error:", e);
        continue; // Skip card on error
      }
      
      if (aiSuggestion.rating === null) {
        await supabase
          .from('cards')
          .update({ 
            ai_suggestion: { 
              reason: aiSuggestion.reason,
              previous_date: card.next_review_date
            }
          })
          .eq('id', card.id);
        continue;
      }

      // Convert Supabase DB object to Interface CardSRS
      const cardForCalc: CardSRS = {
          ease_factor: card.ease_factor,
          interval: card.interval,
          repetitions: card.repetitions,
          last_rating: card.last_rating
      };

      // USAMOS LA LÓGICA CENTRALIZADA
      const newSrsData = calculateNextReview(cardForCalc, aiSuggestion.rating as Rating, settings);
      
      await supabase
        .from('cards')
        .update({ 
          ...newSrsData,
          ai_suggestion: { 
            reason: aiSuggestion.reason,
            previous_date: card.next_review_date
          }
        })
        .eq('id', card.id);
        
      await supabase
        .from("card_reviews")
        .insert({ card_id: card.id, rating: aiSuggestion.rating });
    }

    return NextResponse.json({ success: true, message: "Card reviews updated by AI." });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}