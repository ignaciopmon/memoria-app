// components/upcoming-list.tsx
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { format, formatDistanceToNow } from "date-fns"
import { Clock, Sparkles, Trash2, Loader2, CalendarCheck, Folder, RotateCcw, LayoutList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
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

  // --- EMPTY STATE ---
  if (initialCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in zoom-in duration-500">
        <div className="relative mb-8">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-background border shadow-xl">
                <CalendarCheck className="h-10 w-10 text-primary" />
            </div>
        </div>
        <h3 className="mb-3 text-2xl font-bold tracking-tight">Your schedule is clear!</h3>
        <p className="text-muted-foreground max-w-md mb-8">
          You don't have any cards scheduled for the future right now. Keep studying your active decks to see them appear here.
        </p>
        <Button onClick={() => router.push('/dashboard')} size="lg" className="rounded-full px-8 shadow-md">
            Go to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        
        {/* ACTION BAR SUPERIOR */}
        <div className={cn(
            "flex items-center justify-between p-4 rounded-xl border transition-all duration-300 shadow-sm",
            selectedCardIds.length > 0 ? "bg-primary/5 border-primary/30" : "bg-background"
        )}>
          <div className="flex items-center gap-3">
             <div className={cn("p-2 rounded-lg", selectedCardIds.length > 0 ? "bg-primary/10" : "bg-muted")}>
                <LayoutList className={cn("h-5 w-5", selectedCardIds.length > 0 ? "text-primary" : "text-muted-foreground")} />
             </div>
             <div>
                <h3 className="font-semibold text-foreground">
                    {selectedCardIds.length > 0 ? `${selectedCardIds.length} Cards Selected` : "Schedule Overview"}
                </h3>
                <p className="text-sm text-muted-foreground hidden sm:block">
                    {selectedCardIds.length > 0 ? "Choose an action for the selected cards." : `You have ${initialCards.length} cards scheduled.`}
                </p>
             </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant={selectedCardIds.length > 0 ? "default" : "secondary"}
                size="sm" 
                disabled={selectedCardIds.length === 0 || isProcessing}
                className={cn("transition-all", selectedCardIds.length > 0 && "shadow-md")}
              >
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                Reset Selected
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

        {/* LISTA DE ACORDEONES */}
        <Accordion type="multiple" defaultValue={deckIds} className="w-full space-y-4">
          {deckIds.map(deckId => {
            const group = groupedCards[deckId]
            const allInDeckSelected = group.cards.length > 0 && group.cards.every(c => selectedCardIds.includes(c.id))
            const someInDeckSelected = group.cards.some(c => selectedCardIds.includes(c.id))

            return (
              <AccordionItem value={deckId} key={deckId} className="border bg-background rounded-xl shadow-sm overflow-hidden px-2">
                
                {/* CABECERA DEL ACORDEÓN (MAZO) */}
                <AccordionTrigger className="hover:no-underline px-4 py-4 data-[state=open]:border-b">
                  <div className="flex flex-1 items-center gap-4 pr-4">
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                        id={`deck-${deckId}`}
                        checked={allInDeckSelected ? true : someInDeckSelected ? "indeterminate" : false}
                        onCheckedChange={(checked) => handleSelectDeck(deckId, !!checked)}
                        className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
                        />
                    </div>
                    
                    <div className="flex flex-1 items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Folder className="h-5 w-5 text-muted-foreground/70" />
                            <label htmlFor={`deck-${deckId}`} className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors">
                            {group.deckName}
                            </label>
                        </div>
                        <Badge variant="secondary" className="font-normal text-xs bg-muted text-muted-foreground">
                            {group.cards.length} cards
                        </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                
                {/* CONTENIDO DEL ACORDEÓN (TARJETAS) */}
                <AccordionContent className="pt-4 pb-4 px-2 space-y-2 bg-muted/10">
                  
                  <div className="flex justify-end px-2 mb-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" disabled={isProcessing}>
                            <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset entire deck
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset all cards in "{group.deckName}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will reset the study progress for all {group.cards.length} upcoming cards in this deck.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleResetCards(group.cards.map(c => c.id))} className="bg-destructive text-white hover:bg-destructive/90">
                              Confirm Reset
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  </div>
                  
                  {/* LAS TARJETAS */}
                  {group.cards.map(card => {
                    const isSelected = selectedCardIds.includes(card.id)
                    const isAI = !!card.ai_suggestion;

                    return (
                      <div 
                        key={card.id} 
                        className={cn(
                          "group flex items-center justify-between p-3 sm:p-4 rounded-lg border bg-background transition-all hover:shadow-md cursor-pointer",
                          isAI && "border-purple-200 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-900/10",
                          isSelected && "border-primary ring-1 ring-primary bg-primary/5"
                        )}
                        onClick={() => handleToggleSelect(card.id)}
                      >
                        <div className="flex items-center gap-4 overflow-hidden flex-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelect(card.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          
                          {/* Contenido de la tarjeta */}
                          <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                             <p className="font-medium truncate text-[15px] group-hover:text-primary transition-colors">
                                {card.front}
                             </p>
                             
                             {/* Fila de metadatos */}
                             <div className="flex items-center gap-3 mt-1.5">
                                {isAI ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-full w-fit">
                                          <Sparkles className="h-3 w-3" />
                                          <span className="font-medium truncate max-w-[150px] sm:max-w-[300px]">
                                              {card.ai_suggestion?.reason}
                                          </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <div className="space-y-1 p-1 text-sm">
                                        <p className="font-semibold text-purple-300 flex items-center gap-2">
                                            <Sparkles className="h-4 w-4"/> AI Rescheduled
                                        </p>
                                        <p className="text-muted-foreground mt-2 border-t border-muted/20 pt-2">{card.ai_suggestion?.reason}</p>
                                        {card.ai_suggestion?.previous_date && (
                                          <p className="text-xs text-muted-foreground mt-2">
                                            Original Date: {format(new Date(card.ai_suggestion.previous_date), "MMM d, yyyy")}
                                          </p>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" /> Standard Schedule
                                  </div>
                                )}
                             </div>
                          </div>
                        </div>

                        {/* Fecha */}
                        <div className="flex flex-col items-end flex-shrink-0 ml-4 pl-4 border-l">
                          <span className="text-xs text-muted-foreground mb-0.5 uppercase font-medium tracking-wider">Due in</span>
                          <Badge variant={isAI ? "default" : "outline"} className={cn(
                              "font-semibold text-sm rounded-md",
                              isAI && "bg-purple-600 hover:bg-purple-700 text-white border-transparent"
                          )}>
                            {formatDistanceToNow(new Date(card.next_review_date), { addSuffix: false })}
                          </Badge>
                        </div>
                      </div>
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