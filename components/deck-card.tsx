// components/deck-card.tsx
"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Play, Sparkles, BarChart } from "lucide-react"
import Link from "next/link"
import { AITestDialog } from "./ai-test-dialog"
import { Badge } from "@/components/ui/badge"

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

  return (
    <Card 
      className={`group relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${isEditMode ? 'opacity-75 cursor-move border-dashed' : ''}`}
    >
      {/* Franja de color superior elegante */}
      <div 
        className="h-1.5 w-full transition-colors" 
        style={{ backgroundColor: deck.color || 'hsl(var(--primary))' }} 
      />

      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-1 text-lg">{deck.name}</CardTitle>
            {/* Contador simple si quieres algo minimalista arriba, o lo dejas abajo */}
        </div>
        <CardDescription className="line-clamp-2 h-10 text-sm leading-relaxed">
            {deck.description || "No description provided."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-end gap-4">
        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5">
             <BookOpen className="h-3.5 w-3.5" />
             <span>{deck.cardCount} cards</span>
          </div>
          {deck.cardCount > 0 && (
             <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal h-5">
                Active
             </Badge>
          )}
        </div>

        <div className="grid gap-2">
           {deck.cardCount > 0 ? (
            <>
                <div className="flex gap-2">
                    {/* Botón principal STUDY destacado */}
                    <Button asChild className="flex-1 shadow-sm font-semibold" disabled={isEditMode}>
                        <Link href={`/study/${deck.id}`} onClick={handleActionClick}>
                        <Play className="mr-2 h-4 w-4 fill-current" />
                        Study
                        </Link>
                    </Button>
                    {/* Botón Practice secundario */}
                    <Button asChild variant="secondary" className="px-3" disabled={isEditMode} title="Practice Mode">
                        <Link href={`/practice/${deck.id}`} onClick={handleActionClick}>
                            <BarChart className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
                
                {/* Botones de utilidad */}
                <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm" className="h-8 text-xs" disabled={isEditMode}>
                        <Link href={`/deck/${deck.id}`} onClick={handleActionClick}>Edit Cards</Link>
                    </Button>
                    <AITestDialog deckId={deck.id} deckName={deck.name}>
                        <Button variant="outline" size="sm" className="h-8 text-xs" disabled={isEditMode}>
                            <Sparkles className="mr-1.5 h-3 w-3 text-purple-500" />
                            AI Test
                        </Button>
                    </AITestDialog>
                </div>
            </>
           ) : (
             <Button asChild variant="outline" className="w-full border-dashed" disabled={isEditMode}>
                <Link href={`/deck/${deck.id}`} onClick={handleActionClick}>Add Cards</Link>
             </Button>
           )}
        </div>
      </CardContent>
    </Card>
  )
}