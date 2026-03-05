import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calculateExpansionCycleUpdate } from "@/lib/expansion-cycle";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Save the test result
    const { data, error } = await supabase
        .from('user_tests')
        .insert({
            user_id: user.id,
            ...body
        })
        .select()
        .single();

    if (error) throw error;

    // 2. Update Topic Mastery (Expansion Cycle)
    if (body.topic) {
        const { data: masteryData } = await supabase
            .from('topic_mastery')
            .select('*')
            .eq('user_id', user.id)
            .eq('topic', body.topic)
            .single();

        const update = calculateExpansionCycleUpdate({
          score: body.score,
          total: body.total_questions,
          currentInterval: masteryData?.current_interval,
          currentStatus: masteryData?.status,
        });

        if (!update) {
          return NextResponse.json({ success: true, testId: data.id });
        }

        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + update.newInterval);

        const { error: upsertError } = await supabase
            .from('topic_mastery')
            .upsert({
                user_id: user.id,
                topic: body.topic,
                current_interval: update.newInterval,
                status: update.newStatus,
                last_score: update.percentage,
                last_reviewed_at: new Date().toISOString(),
                next_review_date: nextReviewDate.toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, topic' });

        if (upsertError) console.error("Error upserting mastery:", upsertError);
    }

    return NextResponse.json({ success: true, testId: data.id });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
