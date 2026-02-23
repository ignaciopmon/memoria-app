"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, Shuffle } from "lucide-react"
import Link from "next/link"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ImageViewerDialog } from "./image-viewer-dialog"

interface PracticeSessionProps {
  deck: { id: string; name: string }
  initialCards: Array<{ 
    id: string; 
    front: string; 
    back: string;
    front_image_url: string | null;
    back_image_url: string | null;
    is_typing_enabled?: boolean; // NUEVO: lo marcamos opcional por compatibilidad con tarjetas viejas
  }>
}

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
  const [userAnswer, setUserAnswer] = useState("")

  const cards = useMemo(() => {
    return isShuffled ? shuffleArray(initialCards) : initialCards;
  }, [isShuffled, initialCards]);

  const currentCard = cards[currentIndex]

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
    
    if (event.key === ' ') {
        event.preventDefault();
        setShowAnswer(prev => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setUserAnswer("");
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
      setUserAnswer("")
    }
  }

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      setShowAnswer(false)
      setUserAnswer("")
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

      <main className="flex flex-1 items-center justify-center py-6">
        <div className="container mx-auto max-w-3xl px-4 flex flex-col items-center">
            <div className="flex items-center space-x-2 mb-4">
                <Switch id="shuffle-mode" checked={isShuffled} onCheckedChange={setIsShuffled} />
                <Label htmlFor="shuffle-mode" className="flex items-center gap-2">
                    <Shuffle className="h-4 w-4" />
                    Shuffle Mode
                </Label>
            </div>

          <Card className="mb-6 w-full shadow-md">
            <CardContent className="flex min-h-[250px] flex-col justify-center p-4 md:min-h-[300px] md:p-8">
              <div className="text-center">
                <p className="mb-4 text-xs font-bold tracking-wider text-muted-foreground">FRONT</p>
                {currentCard.front_image_url && (
                  <ImageViewerDialog src={currentCard.front_image_url} alt="Front image" triggerClassName="mb-4 flex justify-center w-full" />
                )}
                <h2 className="text-balance text-xl font-semibold md:text-2xl mb-6">{currentCard.front}</h2>
              </div>

              {/* AQUÍ ESTÁ LA CONDICIÓN: Solo se muestra el Textarea si is_typing_enabled es true */}
              {!showAnswer && currentCard.is_typing_enabled && (
                <div className="mt-4 border-t pt-4">
                  <Label htmlFor="user-answer" className="text-xs font-medium text-muted-foreground mb-2 block text-center">
                    Type your answer
                  </Label>
                  <Textarea 
                    id="user-answer"
                    placeholder="Escribe aquí tu respuesta para compararla después..." 
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="resize-none"
                    rows={3}
                  />
                </div>
              )}

              {showAnswer && (
                <div className="border-t pt-6 text-center mt-4">
                  {/* Solo mostramos la respuesta del usuario si la tarjeta tenía la opción activada y escribió algo */}
                  {currentCard.is_typing_enabled && userAnswer.trim() !== "" && (
                    <div className="mb-6 rounded-lg border bg-muted/50 p-4 text-left">
                      <p className="mb-1 text-xs font-bold text-muted-foreground">YOUR ANSWER:</p>
                      <p className="text-sm">{userAnswer}</p>
                    </div>
                  )}
                  
                  <p className="mb-4 text-xs font-bold tracking-wider text-muted-foreground">BACK</p>
                  {currentCard.back_image_url && (
                    <ImageViewerDialog src={currentCard.back_image_url} alt="Back image" triggerClassName="mb-4 flex justify-center w-full" />
                  )}
                  <p className="text-balance text-lg text-muted-foreground md:text-xl whitespace-pre-wrap">{currentCard.back}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {!showAnswer ? (
            <div className="flex justify-center w-full">
              <Button size="lg" onClick={() => setShowAnswer(true)} className="w-full max-w-sm">
                Show Answer
              </Button>
            </div>
          ) : (
            <div className="flex w-full justify-center items-center gap-4">
              <Button size="lg" variant="outline" onClick={goToPrevious} disabled={currentIndex === 0} className="w-full max-w-[180px]">
                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button size="lg" onClick={goToNext} disabled={currentIndex === cards.length - 1} className="w-full max-w-[180px]">
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}