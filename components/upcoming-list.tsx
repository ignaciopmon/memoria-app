// components/upcoming-list.tsx
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { format, formatDistanceToNow } from "date-fns"
import { Clock, Sparkles } from "lucide-react"
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
    previous_date?: string // Añadimos la fecha previa opcional
  } | null
  deck: {
    id: string
    name: string
  } | null
}

export function UpcomingList({ initialCards }: { initialCards: UpcomingCard[] }) {
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
    <div className="space-y-4">
      <TooltipProvider>
        {initialCards.map(card => (
          <Card key={card.id} className={cn(card.ai_suggestion && "border-purple-500/50")}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 overflow-hidden">
                {card.ai_suggestion ? (
                  <Tooltip>
                    <TooltipTrigger>
                      <Sparkles className="h-5 w-5 flex-shrink-0 text-purple-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1 p-1 text-sm">
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
                  <div className="w-5 flex-shrink-0" /> // Espaciador para alinear
                )}
                <div className="overflow-hidden">
                  <p className="font-medium truncate">{card.front}</p>
                  <p className="text-sm text-muted-foreground">
                    In deck: <strong>{card.deck?.name || 'Unknown'}</strong>
                  </p>
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
        ))}
      </TooltipProvider>
    </div>
  )
}