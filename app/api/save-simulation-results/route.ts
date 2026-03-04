import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { resultsByTopic } = await request.json(); // { "Topic A": { score: 2, total: 3 }, ... }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    for (const [topic, data] of Object.entries(resultsByTopic) as [string, any][]) {
        const percentage = (data.score / data.total) * 100;
        const isSuccess = percentage >= 80;

        const { data: mastery } = await supabase
            .from('topic_mastery')
            .select('*').eq('user_id', user.id).eq('topic', topic).single();

        let newInterval = 0;
        let newStatus = 'Learning';

        if (mastery) {
            if (isSuccess) {
                // Rule of Double
                newInterval = mastery.current_interval === 0 ? 30 : mastery.current_interval * 2;
                newStatus = newInterval >= 60 ? 'Mastered' : 'Reviewing';
            } else {
                // Handbrake
                newInterval = 3; 
                newStatus = 'Needs Focus';
            }
        } else {
            if (isSuccess) {
                newInterval = 30; newStatus = 'Reviewing';
            } else {
                newInterval = 3; newStatus = 'Needs Focus';
            }
        }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newInterval);

        await supabase.from('topic_mastery').upsert({
            user_id: user.id,
            topic: topic,
            current_interval: newInterval,
            status: newStatus,
            last_score: percentage,
            last_reviewed_at: new Date().toISOString(),
            next_review_date: nextDate.toISOString(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, topic' });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}