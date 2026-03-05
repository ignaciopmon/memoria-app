import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calculateExpansionCycleUpdate } from "@/lib/expansion-cycle";

export async function POST(request: Request) {
  try {
    const { resultsByTopic } = await request.json(); // { "Topic A": { score: 2, total: 3 }, ... }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    for (const [topic, data] of Object.entries(resultsByTopic) as [string, any][]) {
        const { data: mastery } = await supabase
            .from('topic_mastery')
            .select('*').eq('user_id', user.id).eq('topic', topic).single();

        const update = calculateExpansionCycleUpdate({
          score: data.score,
          total: data.total,
          currentInterval: mastery?.current_interval,
          currentStatus: mastery?.status,
        });

        if (!update) {
          continue;
        }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + update.newInterval);

        await supabase.from('topic_mastery').upsert({
            user_id: user.id,
            topic: topic,
            current_interval: update.newInterval,
            status: update.newStatus,
            last_score: update.percentage,
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
