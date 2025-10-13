"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Brain, ArrowLeft, CheckCircle } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Progress } from "@/components/ui/progress"

interface StudySessionProps {
  deck: {
    id: string
    name: string
  }
  initialCards: Array<{
    id: string
    front: string
    back: string
    ease_factor: number
    interval: number
    repetitions: number
    next_review_date: string
  }>
}

type Rating = 1 | 2 | 3 | 4

export function StudySession({ deck, initialCards }: StudySessionProps) {
  const [cards, setCards] = useState(initialCards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const currentCard = cards[currentIndex]
  const progress = (currentIndex / cards.length) * 100 || 0
  const isComplete = currentIndex >= cards.length

  // SM-2 Algorithm implementation
  const calculateNextReview = (card: (typeof cards)[0], rating: Rating) => {
    let { ease_factor, interval, repetitions } = card

    if (rating === 1) {
      // Again - Reset the card
      repetitions = 0
      interval = 0
    } else {
      // Update ease factor based on rating
      ease_factor = Math.max(1.3, ease_factor + (0.1 - (4 - rating) * (0.08 + (4 - rating) * 0.02)))

      if (repetitions === 0) {
        interval = 1
      } else if (repetitions === 1) {
        interval = 6
      } else {
        interval = Math.round(interval * ease_factor)
      }

      repetitions += 1
    }

    // Calculate next review date
    const nextReviewDate = new Date()
    nextReviewDate.setDate(nextReviewDate.getDate() + interval)

    return {
      ease_factor,
      interval,
      repetitions,
      next_review_date: nextReviewDate.toISOString(),
    }
  }

  const handleRating = async (rating: Rating) => {
    if (!currentCard || isSubmitting) return

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      const updates = calculateNextReview(currentCard, rating)

      // Update card with new SRS values
      const { error: updateError } = await supabase
        .from("cards")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentCard.id)

      if (updateError) throw updateError

      // Record the review
      const { error: reviewError } = await supabase.from("card_reviews").insert({
        card_id: currentCard.id,
        rating,
      })

      if (reviewError) throw reviewError

      // Move to next card
      setCurrentIndex((prev) => prev + 1)
      setShowAnswer(false)
    } catch (error) {
      console.error("[v0] Error submitting rating:", error)
      alert("Error al guardar la respuesta")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (cards.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="border-b">
          <div className="container mx-auto flex h-16 items-center px-4">
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6" />
              <span className="text-xl font-bold">Memoria</span>
            </div>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center">
          <div className="container mx-auto max-w-2xl px-4 text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
            <h1 className="mb-2 text-3xl font-bold">¡Todo al día!</h1>
            <p className="mb-6 text-muted-foreground">No hay tarjetas pendientes de revisión en este mazo</p>
            <Button asChild>
              <Link href={`/deck/${deck.id}`}>Volver al Mazo</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (isComplete) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="border-b">
          <div className="container mx-auto flex h-16 items-center px-4">
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6" />
              <span className="text-xl font-bold">Memoria</span>
            </div>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center">
          <div className="container mx-auto max-w-2xl px-4 text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
            <h1 className="mb-2 text-3xl font-bold">¡Sesión completada!</h1>
            <p className="mb-6 text-muted-foreground">
              Has revisado {cards.length} tarjeta{cards.length !== 1 ? "s" : ""}
            </p>
            <div className="flex justify-center gap-4">
              <Button asChild variant="outline">
                <Link href={`/deck/${deck.id}`}>Ver Mazo</Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard">Ir al Dashboard</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
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
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6" />
              <span className="text-xl font-bold">Memoria</span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {currentIndex + 1} / {cards.length}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4">
        <Progress value={progress} className="h-2" />
      </div>

      <main className="flex flex-1 items-center justify-center">
        <div className="container mx-auto max-w-3xl px-4">
          <Card className="mb-6">
            <CardContent className="p-8">
              <div className="mb-6 text-center">
                <p className="mb-2 text-xs font-medium text-muted-foreground">PREGUNTA</p>
                <h2 className="text-balance text-2xl font-semibold">{currentCard.front}</h2>
              </div>

              {showAnswer && (
                <div className="border-t pt-6 text-center">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">RESPUESTA</p>
                  <p className="text-balance text-xl text-muted-foreground">{currentCard.back}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {!showAnswer ? (
            <div className="flex justify-center">
              <Button size="lg" onClick={() => setShowAnswer(true)} className="min-w-48">
                Mostrar Respuesta
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">¿Qué tan bien recordaste esta tarjeta?</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-1 py-4 hover:border-red-500 hover:bg-red-50 hover:text-red-700 bg-transparent"
                  onClick={() => handleRating(1)}
                  disabled={isSubmitting}
                >
                  <span className="text-lg font-semibold">Otra vez</span>
                  <span className="text-xs text-muted-foreground">&lt; 1 día</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-1 py-4 hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700 bg-transparent"
                  onClick={() => handleRating(2)}
                  disabled={isSubmitting}
                >
                  <span className="text-lg font-semibold">Difícil</span>
                  <span className="text-xs text-muted-foreground">1-3 días</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-1 py-4 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 bg-transparent"
                  onClick={() => handleRating(3)}
                  disabled={isSubmitting}
                >
                  <span className="text-lg font-semibold">Bien</span>
                  <span className="text-xs text-muted-foreground">3-7 días</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-1 py-4 hover:border-green-500 hover:bg-green-50 hover:text-green-700 bg-transparent"
                  onClick={() => handleRating(4)}
                  disabled={isSubmitting}
                >
                  <span className="text-lg font-semibold">Fácil</span>
                  <span className="text-xs text-muted-foreground">&gt; 7 días</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
