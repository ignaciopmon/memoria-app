// app/upcoming/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Brain, ArrowLeft, CalendarDays } from "lucide-react"
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
      ai_suggestion,
      deck:decks!inner (id, name)
    `)
    .is("deleted_at", null)
    .is("decks.deleted_at", null) 
    .gt("next_review_date", today)
    .order("next_review_date", { ascending: true })
    .limit(100)

  if (error) {
    console.error("Error fetching upcoming cards:", error)
  }

  // Aseguramos que 'deck' sea tratado como un objeto único para calmar a TypeScript
  const formattedCards = (cards as any[])?.map(card => ({
    ...card,
    deck: Array.isArray(card.deck) ? card.deck[0] : card.deck
  })) || [];

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Navbar Minimalista */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
         <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Brain className="h-6 w-6 text-primary" />
           <span className="text-xl font-bold select-none">Memoria</span>
         </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Cabecera con patrón sutil */}
        <div className="relative border-b bg-background pt-12 pb-10 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          <div className="container relative z-10 mx-auto max-w-4xl px-4">
            <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground hover:text-foreground">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <div className="flex items-center gap-4 mb-2">
              <div className="rounded-xl bg-primary/10 p-3 ring-1 ring-primary/20">
                <CalendarDays className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight">Upcoming Reviews</h1>
            </div>
            <p className="text-lg text-muted-foreground mt-2 max-w-xl">
              Plan your study sessions. Here are the cards scheduled for the near future based on your learning algorithm.
            </p>
          </div>
        </div>

        {/* Contenedor de la lista */}
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <UpcomingList initialCards={formattedCards} />
        </div>
      </main>
    </div>
  )
}