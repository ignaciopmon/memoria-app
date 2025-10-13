import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Brain, BookOpen } from "lucide-react"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { DeckCard } from "@/components/deck-card"
import Link from "next/link" // <--- ¡AQUÍ ESTÁ LA LÍNEA QUE FALTABA!

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch user's decks
  const { data: decks, error } = await supabase
    .from("decks")
    .select(
      `
      *,
      cards:cards(count)
    `,
    )
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching decks:", error)
  }

  const decksWithCount = decks?.map((deck) => ({
    ...deck,
    cardCount: deck.cards?.[0]?.count || 0,
  }))

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            <span className="text-xl font-bold">Memoria</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings">Settings</Link>
            </Button>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Decks</h1>
              <p className="text-muted-foreground">Manage your study flashcard decks</p>
            </div>
            <CreateDeckDialog />
          </div>

          {!decksWithCount || decksWithCount.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">You don't have any decks yet</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  Create your first deck to start studying
                </p>
                <CreateDeckDialog />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {decksWithCount.map((deck) => (
                <DeckCard key={deck.id} deck={deck} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}