import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { deckName, description, cards } = await request.json();

    // 1. Crear el Mazo
    const { data: newDeck, error: deckError } = await supabase
        .from('decks')
        .insert({
            user_id: user.id,
            name: deckName,
            description: description
        }).select('id').single();

    if (deckError || !newDeck) throw new Error("Database error creating deck.");

    // 2. Preparar tarjetas
    const cardsToInsert = cards.map((card: any) => ({
        deck_id: newDeck.id,
        front: card.front,
        back: card.back,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString()
    }));

    // 3. Insertar tarjetas
    const { error: cardsError } = await supabase.from('cards').insert(cardsToInsert);

    if (cardsError) {
        await supabase.from('decks').delete().eq('id', newDeck.id); // Rollback
        throw new Error("Could not save cards.");
    }

    return NextResponse.json({ success: true, deckId: newDeck.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}