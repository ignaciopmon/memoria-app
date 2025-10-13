import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { StudySession } from "@/components/study-session"

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch deck details
  const { data: deck, error: deckError } = await supabase.from("decks").select("*").eq("id", id).single()

  if (deckError || !deck) {
    notFound()
  }

  // Fetch cards that are due for review
  const now = new Date().toISOString()
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("*")
    .eq("deck_id", id)
    .is("deleted_at", null) // <-- AÑADE ESTA LÍNEA
    .lte("next_review_date", now)
    .order("next_review_date", { ascending: true })

  if (cardsError) {
    console.error("[v0] Error fetching cards:", cardsError)
  }

  return <StudySession deck={deck} initialCards={cards || []} />
}