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

  // Color del mazo o color primario por defecto
  const deckColor = deck.color || 'hsl(var(--primary))';

  return (
    <Card 
      className={`group relative flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 ${isEditMode ? 'opacity-75 cursor-move border-dashed' : ''}`}
    >
      {/* Fondo sutil tipo resplandor (glow) radial en la parte superior derecha */}
      <div 
        className="absolute -top-24 -right-24 h-48 w-48 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40"
        style={{ backgroundColor: deckColor }}
      />

      {/* Línea superior fina y elegante */}
      <div 
        className="absolute top-0 left-0 w-full h-1 opacity-80" 
        style={{ backgroundColor: deckColor }} 
      />

      <CardHeader className="pb-3 pt-6 relative z-10">
        <div className="flex items-start justify-between gap-4">
            <CardTitle className="line-clamp-1 text-xl font-bold tracking-tight">
              {deck.name}
            </CardTitle>
            {deck.cardCount > 0 && (
              <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-semibold bg-muted/80 backdrop-blur-sm border-none text-muted-foreground group-hover:text-foreground transition-colors">
                 {deck.cardCount} CARDS
              </Badge>
            )}
        </div>
        <CardDescription className="line-clamp-2 h-10 text-sm leading-relaxed mt-1">
            {deck.description || "No description provided."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-end gap-5 relative z-10 pt-2">
        <div className="grid gap-2.5">
           {deck.cardCount > 0 ? (
            <>
                <div className="flex gap-2">
                    {/* Botón principal STUDY destacado */}
                    <Button asChild className="flex-1 shadow-md hover:shadow-lg transition-all group-hover:bg-primary/90 font-semibold" disabled={isEditMode}>
                        <Link href={`/study/${deck.id}`} onClick={handleActionClick}>
                        <Play className="mr-2 h-4 w-4 fill-current" />
                        Study Now
                        </Link>
                    </Button>
                    {/* Botón Practice secundario */}
                    <Button asChild variant="secondary" className="px-3 bg-secondary/50 hover:bg-secondary border border-secondary" disabled={isEditMode} title="Practice Mode">
                        <Link href={`/practice/${deck.id}`} onClick={handleActionClick}>
                            <BarChart className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
                
                {/* Botones de utilidad */}
                <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm" className="h-9 text-xs border-muted-foreground/20 hover:bg-muted/50 transition-colors" disabled={isEditMode}>
                        <Link href={`/deck/${deck.id}`} onClick={handleActionClick}>Edit Deck</Link>
                    </Button>
                    <AITestDialog deckId={deck.id} deckName={deck.name}>
                        <Button variant="outline" size="sm" className="h-9 text-xs border-muted-foreground/20 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-500/30 transition-colors" disabled={isEditMode}>
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                            AI Test
                        </Button>
                    </AITestDialog>
                </div>
            </>
           ) : (
             <Button asChild variant="outline" className="w-full h-11 border-dashed border-2 hover:bg-primary/5 hover:text-primary hover:border-primary/50 transition-colors" disabled={isEditMode}>
                <Link href={`/deck/${deck.id}`} onClick={handleActionClick}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Add First Cards
                </Link>
             </Button>
           )}
        </div>
      </CardContent>
    </Card>
  )
}