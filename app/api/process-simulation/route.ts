import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { resultsByDeck } = await request.json(); 
    // Format expected: { "deck-uuid-1": { score: 8, total: 10 }, "deck-uuid-2": { score: 2, total: 5 } }
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    for (const [deckId, data] of Object.entries(resultsByDeck) as [string, any][]) {
        // We consider "success" if the user rated cards "Good" or "Easy" (3 or 4) frequently
        const percentage = (data.score / data.total) * 100;
        const isSuccess = percentage >= 80;

        const { data: mastery } = await supabase
            .from('deck_mastery')
            .select('*').eq('user_id', user.id).eq('deck_id', deckId).single();

        let newInterval = 0;
        let newStatus = 'Learning';

        if (mastery) {
            if (isSuccess) {
                // Regla del Doble: R30 -> R60 -> R120
                newInterval = mastery.current_interval === 0 ? 30 : mastery.current_interval * 2;
                newStatus = newInterval >= 60 ? 'Mastered' : 'Reviewing';
            } else {
                // Freno de mano: Fallaste la expansión, vuelve a repaso intenso
                newInterval = 3; 
                newStatus = 'Needs Focus';
            }
        } else {
            // Primera vez que entra al ciclo de expansión
            newInterval = isSuccess ? 30 : 3;
            newStatus = isSuccess ? 'Reviewing' : 'Needs Focus';
        }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newInterval);

        await supabase.from('deck_mastery').upsert({
            deck_id: deckId,
            user_id: user.id,
            current_interval: newInterval,
            status: newStatus,
            last_score: Math.round(percentage),
            last_reviewed_at: new Date().toISOString(),
            next_review_date: nextDate.toISOString(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'deck_id' });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}