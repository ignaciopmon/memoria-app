// components/deck-card.tsx
"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Play, Sparkles } from "lucide-react"
import Link from "next/link"
import { AITestDialog } from "./ai-test-dialog"

interface DeckCardProps {
  deck: {
    id: string
    name: string
    description: string | null
    cardCount: number
    color: string | null
  }
  isEditMode?: boolean
}

export function DeckCard({ deck, isEditMode = false }: DeckCardProps) {
  const handleActionClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isEditMode) {
      e.preventDefault()
    }
  }

  const cardStyle = deck.color ? { borderColor: deck.color, borderWidth: '2px' } : {};

  return (
    <Card 
      className={`flex flex-col transition-all ${isEditMode ? 'opacity-75 cursor-default' : ''}`}
      style={cardStyle}
    >
      <CardHeader className="pb-4">
        <CardTitle className="line-clamp-1">{deck.name}</CardTitle>
        <CardDescription className="line-clamp-2 h-10">{deck.description || "No description"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span>{deck.cardCount} cards</span>
        </div>

        <div className="flex flex-col gap-2">
           {/* Botón de IA movido aquí */}
          {deck.cardCount > 0 && (
             <AITestDialog deckId={deck.id} deckName={deck.name}>
                <Button variant="outline" disabled={isEditMode}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Test
                </Button>
              </AITestDialog>
          )}
          {deck.cardCount > 0 && (
            <div className="flex gap-2">
              <Button asChild className="flex-1" variant="outline" disabled={isEditMode}>
                <Link href={`/practice/${deck.id}`} onClick={handleActionClick}>Practice</Link>
              </Button>
              <Button asChild className="flex-1" disabled={isEditMode}>
                <Link href={`/study/${deck.id}`} onClick={handleActionClick}>
                  <Play className="mr-2 h-4 w-4" />
                  Study
                </Link>
              </Button>
            </div>
          )}
          <Button asChild className="w-full" variant={deck.cardCount > 0 ? "ghost" : "outline"} disabled={isEditMode}>
            <Link href={`/deck/${deck.id}`} onClick={handleActionClick}>View Cards</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}