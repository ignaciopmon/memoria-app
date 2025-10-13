// components/practice-session.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Brain, ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, Shuffle } from "lucide-react"
import Link from "next/link"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface PracticeSessionProps {
  deck: {
    id: string
    name: string
  }
  initialCards: Array<{
    id: string
    front: string
    back: string
  }>
}

// Función para barajar un array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export function PracticeSession({ deck, initialCards }: PracticeSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isShuffled, setIsShuffled] = useState(false)

  const cards = useMemo(() => {
    return isShuffled ? shuffleArray(initialCards) : initialCards;
  }, [isShuffled, initialCards]);

  const currentCard = cards[currentIndex]

  useEffect(() => {
    setCurrentIndex(0);
  }, [isShuffled]);


  if (initialCards.length === 0) {
    return (
        <main className="flex flex-1 items-center justify-center">
          <div className="container mx-auto max-w-2xl px-4 text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
            <h1 className="mb-2 text-3xl font-bold">This deck is empty!</h1>
            <p className="mb-6 text-muted-foreground">Add some cards to start practicing.</p>
            <Button asChild>
              <Link href={`/deck/${deck.id}`}>Back to Deck</Link>
            </Button>
          </div>
        </main>
    )
  }

  const goToNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setShowAnswer(false)
    }
  }

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      setShowAnswer(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/deck/${deck.id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
                <h1 className="text-xl font-bold">Practice: {deck.name}</h1>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Card {currentIndex + 1} / {cards.length}
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <div className="container mx-auto max-w-3xl px-4 flex flex-col items-center">
            <div className="flex items-center space-x-2 mb-4">
                <Switch id="shuffle-mode" checked={isShuffled} onCheckedChange={setIsShuffled} />
                <Label htmlFor="shuffle-mode" className="flex items-center gap-2">
                    <Shuffle className="h-4 w-4" />
                    Shuffle Mode
                </Label>
            </div>

          <Card className="mb-6 w-full">
            <CardContent className="p-8 min-h-[250px] flex flex-col justify-center">
              <div className="text-center">
                <p className="mb-2 text-xs font-medium text-muted-foreground">FRONT</p>
                <h2 className="text-balance text-2xl font-semibold">{currentCard.front}</h2>
              </div>

              {showAnswer && (
                <div className="border-t pt-6 text-center mt-6">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">BACK</p>
                  <p className="text-balance text-xl text-muted-foreground">{currentCard.back}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {!showAnswer ? (
            <div className="flex justify-center">
              <Button size="lg" onClick={() => setShowAnswer(true)} className="min-w-48">
                Show Answer
              </Button>
            </div>
          ) : (
            <div className="flex w-full justify-center items-center gap-4">
              <Button size="lg" variant="outline" onClick={goToPrevious} disabled={currentIndex === 0}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button size="lg" onClick={goToNext} disabled={currentIndex === cards.length - 1}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}