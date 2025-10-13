// app/trash/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Brain, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { TrashList } from "@/components/trash-list"

export default async function TrashPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch deleted decks
  const { data: deletedDecks } = await supabase
    .from("decks")
    .select(`id, name, deleted_at`)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })

  // Fetch deleted cards
  const { data: deletedCards } = await supabase
    .from("cards")
    .select(`id, front, deleted_at, deck:decks(name)`)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            <span className="text-xl font-bold">Memoria</span>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Trash</h1>
            <p className="text-muted-foreground">Restore or permanently delete items.</p>
          </div>
          <TrashList 
            initialDecks={deletedDecks || []} 
            initialCards={deletedCards || []} 
          />
        </div>
      </main>
    </div>
  )
}