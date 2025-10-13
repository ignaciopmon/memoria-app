"use client"

import { useState, useEffect } from "react"
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

interface UserSettings {
    again_interval_minutes: number
    hard_interval_days: number
    good_interval_days: number
    easy_interval_days: number
}

type Rating = 1 | 2 | 3 | 4

export function StudySession({ deck, initialCards }: StudySessionProps) {
  const [cards, setCards] = useState(initialCards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchSettings = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single()
        setUserSettings(data)
      }
    }
    fetchSettings()
  }, [])

  const currentCard = cards[currentIndex]
  const progress = (currentIndex / cards.length) * 100 || 0
  const isComplete = currentIndex >= cards.length

  const calculateNextReview = (card: (typeof cards)[0], rating: Rating) => {
    let { ease_factor, interval, repetitions } = card
    
    const settings = {
        again: userSettings?.again_interval_minutes ?? 1,
        hard: userSettings?.hard_interval_days ?? 1,
        good: userSettings?.good_interval_days ?? 3,
        easy: userSettings?.easy_interval_days ?? 7,
    }

    if (rating < 3) { // Again or Hard
      repetitions = 0
      interval = rating === 1 ? 0 : 1
    } else { // Good or Easy
      if (repetitions === 0) {
        interval = settings.good
      } else if (repetitions === 1) {
        interval = settings.easy
      } else {
        interval = Math.round(interval * ease_factor)
      }
      repetitions += 1
    }
    
    ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)))
    
    const nextReviewDate = new Date()
    if (rating === 1) {
        nextReviewDate.setMinutes(nextReviewDate.getMinutes() + settings.again)
    } else {
        nextReviewDate.setDate(nextReviewDate.getDate() + interval)
    }

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

      const { error: updateError } = await supabase
        .from("cards")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentCard.id)

      if (updateError) throw updateError

      const { error: reviewError } = await supabase.from("card_reviews").insert({
        card_id: currentCard.id,
        rating,
      })

      if (reviewError) throw reviewError

      setCurrentIndex((prev) => prev + 1)
      setShowAnswer(false)
    } catch (error) {
      console.error("[v0] Error submitting rating:", error)
      alert("Error saving the response")
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const getIntervalText = (rating: Rating): string => {
    if (!userSettings) return ""
    if (rating === 1) return `< ${userSettings.again_interval_minutes}m`
    if (rating === 2) return `${userSettings.hard_interval_days}d`
    if (rating === 3) return `${userSettings.good_interval_days}d`
    if (rating === 4) return `> ${userSettings.easy_interval_days}d`
    return ""
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
            <h1 className="mb-2 text-3xl font-bold">All caught up!</h1>
            <p className="mb-6 text-muted-foreground">There are no cards due for review in this deck.</p>
            <Button asChild>
              <Link href="/dashboard">Back to Dashboard</Link>
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
            <h1 className="mb-2 text-3xl font-bold">Session complete!</h1>
            <p className="mb-6 text-muted-foreground">
              You have reviewed {cards.length} card{cards.length !== 1 ? "s" : ""}.
            </p>
            <div className="flex justify-center gap-4">
              <Button asChild variant="outline">
                <Link href={`/deck/${deck.id}`}>View Deck</Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
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
              <Link href="/dashboard">
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
                <p className="mb-2 text-xs font-medium text-muted-foreground">QUESTION</p>
                <h2 className="text-balance text-2xl font-semibold">{currentCard.front}</h2>
              </div>

              {showAnswer && (
                <div className="border-t pt-6 text-center">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">ANSWER</p>
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
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">How well did you remember this card?</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-1 py-4 hover:border-red-500 hover:bg-red-50 hover:text-red-700 bg-transparent"
                  onClick={() => handleRating(1)}
                  disabled={isSubmitting}
                >
                  <span className="text-lg font-semibold">Again</span>
                  <span className="text-xs text-muted-foreground">{getIntervalText(1)}</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-1 py-4 hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700 bg-transparent"
                  onClick={() => handleRating(2)}
                  disabled={isSubmitting}
                >
                  <span className="text-lg font-semibold">Hard</span>
                  <span className="text-xs text-muted-foreground">{getIntervalText(2)}</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-1 py-4 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 bg-transparent"
                  onClick={() => handleRating(3)}
                  disabled={isSubmitting}
                >
                  <span className="text-lg font-semibold">Good</span>
                  <span className="text-xs text-muted-foreground">{getIntervalText(3)}</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-1 py-4 hover:border-green-500 hover:bg-green-50 hover:text-green-700 bg-transparent"
                  onClick={() => handleRating(4)}
                  disabled={isSubmitting}
                >
                  <span className="text-lg font-semibold">Easy</span>
                  <span className="text-xs text-muted-foreground">{getIntervalText(4)}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}