import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { deckId, newDeckName, cards } = await request.json();
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let targetDeckId = deckId;

    // Si hay que crear mazo nuevo
    if (!targetDeckId && newDeckName) {
        const { data: newDeck, error: deckError } = await supabase
            .from('decks')
            .insert({
                user_id: user.id,
                name: newDeckName,
                description: "Created from AI Test errors"
            })
            .select('id')
            .single();
        
        if (deckError) throw deckError;
        targetDeckId = newDeck.id;
    }

    // Insertar cartas
    const cardsToInsert = cards.map((c: any) => ({
        deck_id: targetDeckId,
        front: c.question,
        back: c.correctAnswer,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString()
    }));

    const { error: cardsError } = await supabase.from('cards').insert(cardsToInsert);
    if (cardsError) throw cardsError;

    return NextResponse.json({ success: true, deckId: targetDeckId });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}