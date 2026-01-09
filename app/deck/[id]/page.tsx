// app/deck/[id]/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Brain, Plus, LayoutGrid, FileText } from "lucide-react"
import Link from "next/link"
import { CreateCardDialog } from "@/components/create-card-dialog"
import { CardItem } from "@/components/card-item"
import { ImportMenu } from "@/components/import-menu"
import { AddAiCardsDialog } from "@/components/add-ai-cards-dialog" 
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default async function DeckPage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: deck } = await supabase.from("decks").select("*").eq("id", id).single()
  if (!deck) notFound()

  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .eq("deck_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
         <Link href="/dashboard" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Memoria</span>
         </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          
          {/* NAVEGACIÓN MEJORADA (BREADCRUMBS) */}
          <div className="mb-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{deck.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* CABECERA DEL MAZO */}
          <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{deck.name}</h1>
                {deck.description && <p className="text-muted-foreground mt-1">{deck.description}</p>}
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <LayoutGrid className="h-4 w-4" />
                    <span>{cards?.length || 0} cards</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <ImportMenu deckId={id} />
                <AddAiCardsDialog deckId={deck.id} deckName={deck.name} />
                <CreateCardDialog deckId={id} />
              </div>
          </div>

          {/* LISTA DE TARJETAS */}
          {!cards || cards.length === 0 ? (
            <Card className="border-dashed bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <div className="rounded-full bg-background p-4 mb-4 shadow-sm">
                    <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">This deck is empty</h3>
                <p className="mb-6 text-muted-foreground max-w-sm">
                  Get started by creating your first card manually or import data from a file.
                </p>
                <div className="flex gap-3">
                  <CreateCardDialog deckId={id} />
                  <AddAiCardsDialog deckId={deck.id} deckName={deck.name} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {cards.map((card) => {
                const createdAt = new Date(card.created_at);
                const isNew = createdAt > tenMinutesAgo;
                return <CardItem key={card.id} card={card} isNew={isNew} />;
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}