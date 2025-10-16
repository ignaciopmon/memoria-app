// components/upcoming-list.tsx
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { format, formatDistanceToNow } from "date-fns"
import { Clock, Sparkles, Trash2, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface UpcomingCard {
  id: string
  front: string
  next_review_date: string
  ai_suggestion: { 
    reason: string
    previous_date?: string
  } | null
  deck: {
    id: string
    name: string
  } | null
}

interface GroupedCards {
  [deckId: string]: {
    deckName: string
    cards: UpcomingCard[]
  }
}

export function UpcomingList({ initialCards }: { initialCards: UpcomingCard[] }) {
  const router = useRouter()
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const groupedCards = useMemo(() => {
    return initialCards.reduce((acc, card) => {
      const deckId = card.deck?.id || 'unknown'
      const deckName = card.deck?.name || 'Unknown Deck'
      
      if (!acc[deckId]) {
        acc[deckId] = { deckName, cards: [] }
      }
      acc[deckId].cards.push(card)
      return acc
    }, {} as GroupedCards)
  }, [initialCards])

  const deckIds = Object.keys(groupedCards)

  const handleToggleSelect = (cardId: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    )
  }

  const handleSelectDeck = (deckId: string, select: boolean) => {
    const cardIdsInDeck = groupedCards[deckId].cards.map(c => c.id)
    setSelectedCardIds(prev => {
      const otherIds = prev.filter(id => !cardIdsInDeck.includes(id))
      return select ? [...otherIds, ...cardIdsInDeck] : otherIds
    })
  }
  
  const handleResetCards = async (cardIds: string[]) => {
    if (cardIds.length === 0) return
    setIsProcessing(true)
    try {
      const response = await fetch("/api/reset-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds }),
      })
      if (!response.ok) throw new Error("Failed to reset cards")
      setSelectedCardIds([])
      router.refresh()
    } catch (error) {
      console.error(error)
      alert("An error occurred. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  if (initialCards.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Clock className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">Nothing scheduled</h3>
          <p className="text-center text-sm text-muted-foreground">
            Study some cards to see them scheduled here for future review.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Scheduled Decks</h3>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm" 
                disabled={selectedCardIds.length === 0 || isProcessing}
              >
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Reset {selectedCardIds.length} Selected
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset {selectedCardIds.length} cards?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset the study progress for the selected cards, making them "new" again. They will appear in your next study session. This does not delete the cards.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleResetCards(selectedCardIds)}>
                  Confirm Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Accordion type="multiple" defaultValue={deckIds} className="w-full">
          {deckIds.map(deckId => {
            const group = groupedCards[deckId]
            const allInDeckSelected = group.cards.every(c => selectedCardIds.includes(c.id))

            return (
              <AccordionItem value={deckId} key={deckId}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`deck-${deckId}`}
                      checked={allInDeckSelected}
                      onCheckedChange={(checked) => handleSelectDeck(deckId, !!checked)}
                      onClick={(e) => e.stopPropagation()} // Evita que se cierre el acordeón
                    />
                    <label htmlFor={`deck-${deckId}`} className="font-semibold text-lg cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      {group.deckName}
                    </label>
                    <span className="text-sm text-muted-foreground">({group.cards.length} cards)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                       <Button variant="outline" size="sm" className="mb-2" disabled={isProcessing}>
                        <Trash2 className="mr-2 h-4 w-4" /> Reset All {group.cards.length} Cards in This Deck
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset all cards in "{group.deckName}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will reset the study progress for all {group.cards.length} upcoming cards in this deck. This does not delete them.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleResetCards(group.cards.map(c => c.id))}>
                          Confirm Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  {group.cards.map(card => {
                    const isSelected = selectedCardIds.includes(card.id)
                    return (
                      <Card 
                        key={card.id} 
                        className={cn(
                          card.ai_suggestion && "border-purple-500/50",
                          isSelected && "border-primary ring-1 ring-primary"
                        )}
                      >
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelect(card.id)}
                            />
                            {card.ai_suggestion ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Sparkles className="h-5 w-5 flex-shrink-0 text-purple-500" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1 p-1 text-sm max-w-xs">
                                    <p className="font-semibold">{card.ai_suggestion.reason}</p>
                                    {card.ai_suggestion.previous_date && (
                                      <p className="text-xs text-muted-foreground">
                                        Previous: {format(new Date(card.ai_suggestion.previous_date), "MMM d, yyyy")}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      Next: {format(new Date(card.next_review_date), "MMM d, yyyy")}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <div className="w-5 flex-shrink-0" /> // Espaciador
                            )}
                            <div className="overflow-hidden">
                              <p className="font-medium truncate">{card.front}</p>
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground flex-shrink-0 ml-4">
                            <p>Due in</p>
                            <p className="font-semibold text-foreground">
                              {formatDistanceToNow(new Date(card.next_review_date), { addSuffix: false })}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    </TooltipProvider>
  )
}