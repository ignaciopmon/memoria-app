// app/upcoming/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Brain, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { UpcomingList } from "@/components/upcoming-list"

export default async function UpcomingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const today = new Date().toISOString()
  const { data: cards, error } = await supabase
    .from("cards")
    .select(`
      id,
      front,
      next_review_date,
      deck:decks (id, name)
    `)
    .gt("next_review_date", today)
    .is("deleted_at", null)
    .order("next_review_date", { ascending: true })
    .limit(100)

  if (error) {
    console.error("Error fetching upcoming cards:", error)
  }

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
            <h1 className="text-3xl font-bold">Upcoming Reviews</h1>
            <p className="text-muted-foreground">Cards scheduled for review in the near future.</p>
          </div>
          <UpcomingList initialCards={cards || []} />
        </div>
      </main>
    </div>
  )
}