import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

    // 2. Update Topic Mastery (Expansion Cycle / Double Rule)
    if (body.topic) {
        const { data: masteryData } = await supabase
            .from('topic_mastery')
            .select('*')
            .eq('user_id', user.id)
            .eq('topic', body.topic)
            .single();

        const score = body.score || 0;
        const total = body.total_questions || 1;
        const percentage = (score / total) * 100;
        const isSuccess = percentage >= 80; 

        let newInterval = 0;
        let newStatus = 'Learning';

        if (masteryData) {
            if (isSuccess) {
                // Rule of double: Success moves interval forward (30 -> 60 -> 120)
                newInterval = masteryData.current_interval === 0 ? 30 : masteryData.current_interval * 2;
                newStatus = newInterval >= 60 ? 'Mastered' : 'Reviewing';
            } else {
                // Handbrake: User failed, reset to a short focus review
                newInterval = 3; 
                newStatus = 'Needs Focus';
            }
        } else {
            // First time taking a test on this topic
            if (isSuccess) {
                newInterval = 30; // Success -> R30
                newStatus = 'Reviewing';
            } else {
                newInterval = 3; // Initial fail -> Handbrake
                newStatus = 'Needs Focus';
            }
        }

        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

        const { error: upsertError } = await supabase
            .from('topic_mastery')
            .upsert({
                user_id: user.id,
                topic: body.topic,
                current_interval: newInterval,
                status: newStatus,
                last_score: percentage,
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