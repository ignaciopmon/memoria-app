// app/api/process-test-results/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// --- INICIO DE LA LÓGICA DE CÁLCULO DE SRS ---
// Adaptada desde 'components/study-session.tsx' para el backend.

interface CardSRS {
  ease_factor: number;
  interval: number;
  repetitions: number;
  last_rating: number | null;
}

interface UserSettings {
  again_interval_minutes: number;
  hard_interval_days: number;
  good_interval_days: number;
  easy_interval_days: number;
}

type Rating = 1 | 2 | 3 | 4;

const calculateNextReview = (card: CardSRS, rating: Rating, settings: UserSettings) => {
  let { ease_factor, interval, repetitions, last_rating } = card;

  const now = new Date();
  let nextReviewDate = new Date();

  if (rating < 3) {
    repetitions = 0;
    if (rating === 1) {
      interval = 0;
      nextReviewDate.setMinutes(now.getMinutes() + settings.again_interval_minutes);
    } else {
      if (last_rating === 2) {
        interval = Math.max(1, Math.ceil(interval * 0.5));
      } else {
        interval = settings.hard_interval_days;
      }
    }
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      interval = settings.good_interval_days;
    } else if (repetitions === 2) {
      interval = settings.easy_interval_days;
    } else {
      interval = Math.ceil(interval * ease_factor);
    }
  }

  ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)));

  if (rating > 1) {
    nextReviewDate.setDate(now.getDate() + interval);
  }

  return { ease_factor, interval, repetitions, next_review_date: nextReviewDate.toISOString(), last_rating: rating };
};

// --- FIN DE LA LÓGICA DE CÁLCULO DE SRS ---

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
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
    }

    const { results, language } = (await request.json()) as ProcessTestBody;

    const { data: userSettingsData } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single();
    const settings: UserSettings = userSettingsData || { again_interval_minutes: 1, hard_interval_days: 1, good_interval_days: 3, easy_interval_days: 7 };

    for (const result of results) {
      if (result.userAnswer === null) continue;

      const isCorrect = result.userAnswer === result.correctAnswer;

      // Consulta corregida para encontrar la tarjeta y verificar la propiedad a través del mazo
      const { data: card, error: cardError } = await supabase
        .from('cards')
        .select(`
          id, ease_factor, interval, repetitions, last_rating,
          deck:decks!inner(user_id)
        `)
        .eq('front', result.sourceCardFront)
        .eq('decks.user_id', user.id)
        .single();

      if (cardError || !card) {
        console.warn(`Card not found or user not owner for front: "${result.sourceCardFront}"`);
        continue;
      }
      
      const prompt = `
        You are an expert AI tutor using a Spaced Repetition System (SRS). A user answered a test question. Your task is to act as the user and rate their own performance on this flashcard.

        **Performance:**
        - Card Content: "${result.sourceCardFront}"
        - The user's answer was: ${isCorrect ? "CORRECT" : "INCORRECT"}.

        **Your Task:**
        - If the answer was INCORRECT, you MUST decide between rating it as "Again" (1) or "Hard" (2). "Again" is for complete failure to recall. "Hard" is for recalling with difficulty.
        - If the answer was CORRECT, you MUST decide between rating it as "Good" (3) or "Easy" (4). "Good" is for correct recall with some effort. "Easy" is for effortless, instant recall.
        
        You MUST return ONLY a raw JSON object with this exact structure:
        {
          "rating": <A number: 1, 2, 3, or 4>,
          "reason": "<A very brief explanation for your choice in '${language}'>"
        }

        Example for INCORRECT: { "rating": 1, "reason": "Fallo en el test, necesita repaso inmediato." }
        Example for CORRECT: { "rating": 3, "reason": "Acierto en el test, buen recuerdo." }
      `;

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const aiResult = await model.generateContent(prompt);
      const aiResponseText = aiResult.response.text().replace(/```json\n?/, "").replace(/\n?```$/, "");
      
      let aiSuggestion;
      try {
        aiSuggestion = JSON.parse(aiResponseText);
        if (![1, 2, 3, 4].includes(aiSuggestion.rating)) {
          throw new Error('Invalid rating from AI');
        }
      } catch (e) {
        console.error("Failed to parse or validate AI rating response:", aiResponseText);
        continue; // Skip this card if AI response is invalid
      }
      
      const newSrsData = calculateNextReview(card, aiSuggestion.rating as Rating, settings);
      
      await supabase
        .from('cards')
        .update({ 
          ...newSrsData,
          ai_suggestion: { reason: aiSuggestion.reason }
        })
        .eq('id', card.id);
        
      await supabase
        .from("card_reviews")
        .insert({ card_id: card.id, rating: aiSuggestion.rating });
    }

    return NextResponse.json({ success: true, message: "Card reviews updated by AI." });

  } catch (error) {
    console.error("Error in process-test-results API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}