import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Brain, ArrowLeft, Plus } from "lucide-react"
import Link from "next/link"
import { CreateCardDialog } from "@/components/create-card-dialog"
import { CardItem } from "@/components/card-item"
import { ImportMenu } from "@/components/import-menu"

export default async function DeckPage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: deck } = await supabase.from("decks").select("*").eq("id", id).single()
  if (!deck) {
    notFound()
  }

  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .eq("deck_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

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
          <div className="mb-6">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{deck.name}</h1>
                {deck.description && <p className="text-muted-foreground">{deck.description}</p>}
                <p className="mt-2 text-sm text-muted-foreground">{cards?.length || 0} cards</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ImportMenu deckId={id} />
                <CreateCardDialog deckId={id} />
              </div>
            </div>
          </div>

          {!cards || cards.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Plus className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No cards yet</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  Create your first card or import from a file.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <ImportMenu deckId={id} />
                  <CreateCardDialog deckId={id} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {cards.map((card) => (
                <CardItem key={card.id} card={card} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}