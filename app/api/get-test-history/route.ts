import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
// Elimina la importación de cookies

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Llama a createClient() sin argumentos
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
        .from('user_tests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}