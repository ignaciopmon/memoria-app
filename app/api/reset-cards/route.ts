// app/api/reset-cards/route.ts

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
    }

    const { cardIds } = (await request.json()) as { cardIds: string[] };

    if (!cardIds || cardIds.length === 0) {
      return NextResponse.json({ error: "No card IDs provided." }, { status: 400 });
    }
    
    // Resetea las tarjetas a su estado "nuevo"
    const { error } = await supabase
      .from('cards')
      .update({ 
        next_review_date: new Date().toISOString(),
        interval: 0,
        repetitions: 0,
        ease_factor: 2.5,
        last_rating: null,
        ai_suggestion: null // Limpia la sugerencia de la IA
      })
      .in('id', cardIds);
      // La RLS se asegura de que el usuario solo pueda modificar
      // tarjetas que le pertenecen (comprobando el user_id en la tabla decks)

    if (error) {
      console.error("Error resetting cards:", error.message);
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, message: `${cardIds.length} cards reset.` });

  } catch (error) {
    console.error("Error in reset-cards API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}