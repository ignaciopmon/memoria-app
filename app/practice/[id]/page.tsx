// app/practice/[id]/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { PracticeSession } from "@/components/practice-session"

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: deck } = await supabase.from("decks").select("id, name").eq("id", id).single()
  if (!deck) {
    notFound()
  }

  // Obtenemos TODAS las tarjetas
  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .eq("deck_id", id)
    .is("deleted_at", null)

  // --- MEJORA: BARAJADO ALEATORIO ---
  // Para practicar, es mejor que el orden no sea predecible
  const shuffledCards = cards ? [...cards].sort(() => Math.random() - 0.5) : [];

  return <PracticeSession deck={deck} initialCards={shuffledCards} />
}