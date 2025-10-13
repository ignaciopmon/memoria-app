// app/practice/[id]/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { PracticeSession } from "@/components/practice-session"

export default async function PracticePage({ params }: { params: { id: string } }) {
  const { id } = params
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

  // Obtenemos TODAS las tarjetas del mazo, sin importar la fecha de revisión
  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .eq("deck_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  return <PracticeSession deck={deck} initialCards={cards || []} />
}