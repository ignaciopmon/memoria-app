// components/upcoming-list.tsx
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { formatDistanceToNow } from "date-fns"
import { Clock, Sparkles } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface UpcomingCard {
  id: string
  front: string
  next_review_date: string
  ai_suggestion: { reason: string } | null
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
          <Card key={card.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {card.ai_suggestion && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Sparkles className="h-5 w-5 text-purple-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{card.ai_suggestion.reason}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <div>
                  <p className="font-medium">{card.front}</p>
                  <p className="text-sm text-muted-foreground">
                    In deck: <strong>{card.deck?.name || 'Unknown'}</strong>
                  </p>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Due in</p>
                <p className="font-semibold">
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