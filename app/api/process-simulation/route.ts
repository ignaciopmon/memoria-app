import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  calculateExpansionCycleUpdate,
  type ExpansionStatus,
} from "@/lib/expansion-cycle";

type DeckResultInput = {
  score: number;
  total: number;
};

export async function POST(request: Request) {
  try {
    const { resultsByDeck } = (await request.json()) as {
      resultsByDeck: Record<string, DeckResultInput>;
    };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outcomes: Array<{
      deckId: string;
      score: number;
      total: number;
      percentage: number;
      passed: boolean;
      previousInterval: number;
      previousStatus: ExpansionStatus;
      newInterval: number;
      newStatus: ExpansionStatus;
      nextReviewDate: string;
    }> = [];

    for (const [deckId, result] of Object.entries(resultsByDeck || {})) {
      const { data: mastery } = await supabase
        .from("deck_mastery")
        .select("*")
        .eq("user_id", user.id)
        .eq("deck_id", deckId)
        .single();

      const update = calculateExpansionCycleUpdate({
        score: result?.score,
        total: result?.total,
        currentInterval: mastery?.current_interval,
        currentStatus: mastery?.status,
      });

      if (!update) {
        continue;
      }

      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + update.newInterval);

      await supabase.from("deck_mastery").upsert(
        {
          deck_id: deckId,
          user_id: user.id,
          current_interval: update.newInterval,
          status: update.newStatus,
          last_score: update.percentage,
          last_reviewed_at: new Date().toISOString(),
          next_review_date: nextReviewDate.toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "deck_id" },
      );

      outcomes.push({
        deckId,
        score: update.score,
        total: update.total,
        percentage: update.percentage,
        passed: update.passed,
        previousInterval: update.previousInterval,
        previousStatus: update.previousStatus,
        newInterval: update.newInterval,
        newStatus: update.newStatus,
        nextReviewDate: nextReviewDate.toISOString(),
      });
    }

    return NextResponse.json({ success: true, outcomes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
