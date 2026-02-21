"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Brain, ArrowLeft, CheckCircle, RotateCcw, Clock, ThumbsUp, Sparkles, Volume2 } from "lucide-react"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"
import type { Shortcuts } from "@/components/shortcuts-form"
import { ImageViewerDialog } from "./image-viewer-dialog"
import { calculateNextReview, type UserSettings, type Rating } from "@/lib/srs"

interface StudySessionProps {
  deck: { id: string; name: string }
  initialCards: Array<{
    id: string
    front: string
    back: string
    front_image_url: string | null
    back_image_url: string | null
    ease_factor: number
    interval: number
    repetitions: number
    next_review_date: string
    last_rating: number | null
  }>
}

export function StudySession({ deck, initialCards }: StudySessionProps) {
  const [cards, setCards] = useState(initialCards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
  const [shortcuts, setShortcuts] = useState<Shortcuts | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchUserSettings = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: settingsData } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
        setUserSettings(settingsData)
        
        const { data: shortcutsData } = await supabase.from('user_shortcuts').select('*').eq('user_id', user.id).single()
        setShortcuts(shortcutsData)
      }
    }
    fetchUserSettings()
  }, [])

  const currentCard = cards[currentIndex]
  const progress = (currentIndex / (cards.length || 1)) * 100
  const isComplete = currentIndex >= cards.length

  // --- FUNCIÓN DE AUDIO NATIVA (GRATIS Y SIN CLAVES) ---
  const playAudio = useCallback((text: string) => {
    if (!text || isPlayingAudio) return;

    if (!('speechSynthesis' in window)) {
      console.warn("Tu navegador no soporta síntesis de voz.");
      return;
    }

    // Cancelar cualquier audio anterior
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Intentar buscar una voz en inglés (opcional, si no usará la por defecto)
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(voice => voice.lang.startsWith('en-') && voice.name.includes('Google')) 
                 || voices.find(voice => voice.lang.startsWith('en-'));
    
    if (enVoice) {
      utterance.voice = enVoice;
    }

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = (e) => {
      console.error("Error al reproducir audio:", e);
      setIsPlayingAudio(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [isPlayingAudio]);
  // ----------------------------------------------------

  const handleRating = useCallback(async (rating: Rating) => {
    if (!currentCard || isSubmitting) return
    setIsSubmitting(true)
    const supabase = createClient()
    
    const currentSettings = userSettings || {
        again_interval_minutes: 1,
        hard_interval_days: 1,
        good_interval_days: 3,
        easy_interval_days: 7
    };

    try {
      const updates = calculateNextReview(currentCard, rating, currentSettings)
      
      await supabase
        .from("cards")
        .update({ 
          ...updates, 
          ai_suggestion: null,
          updated_at: new Date().toISOString() 
        })
        .eq("id", currentCard.id)
        
      await supabase.from("card_reviews").insert({ card_id: currentCard.id, rating })
      
      if (rating === 1) {
        setCards(prevCards => [...prevCards, currentCard]);
      }

      setCurrentIndex((prev) => prev + 1)
      setShowAnswer(false)
    } catch (error) {
      console.error("Error submitting rating:", error)
    } finally {
      setIsSubmitting(false)
    }
  }, [currentCard, isSubmitting, userSettings])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return

    const key = event.key === ' ' ? ' ' : event.key.toLowerCase()
    const s = shortcuts || { flip_card: ' ', rate_again: '1', rate_hard: '2', rate_good: '3', rate_easy: '4', to_dashboard: 'd', play_audio: 'p' }

    if (!isComplete) {
        if (!showAnswer && key === s.flip_card.toLowerCase()) {
          event.preventDefault()
          setShowAnswer(true)
        } else if (showAnswer) {
            if ([s.rate_again, s.rate_hard, s.rate_good, s.rate_easy].some(k => k.toLowerCase() === key)) {
                event.preventDefault()
            }
            switch (key) {
                case s.rate_again.toLowerCase(): handleRating(1); break;
                case s.rate_hard.toLowerCase(): handleRating(2); break;
                case s.rate_good.toLowerCase(): handleRating(3); break;
                case s.rate_easy.toLowerCase(): handleRating(4); break;
            }
        }
        
        if (key === 'p') { 
            event.preventDefault();
            playAudio(showAnswer ? currentCard.back : currentCard.front);
        }
    }

    if (key === s.to_dashboard.toLowerCase()) {
        event.preventDefault()
        router.push('/dashboard')
    }
  }, [showAnswer, shortcuts, handleRating, router, isComplete, currentCard, playAudio])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
  
  const getIntervalText = (rating: Rating): string => {
    if (!userSettings) return ""
    if (rating === 1) return `< ${userSettings.again_interval_minutes}m`
    if (rating === 2) return `${userSettings.hard_interval_days}d`
    if (rating === 3) return `${userSettings.good_interval_days}d`
    if (rating === 4) return `> ${userSettings.easy_interval_days}d`
    return ""
  }

  if (initialCards.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <div className="bg-muted/30 p-8 rounded-full mb-6">
            <CheckCircle className="h-12 w-12 text-primary" />
        </div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">All caught up!</h1>
        <p className="mb-8 text-muted-foreground max-w-md">There are no cards due for review in this deck right now. Great job keeping up with your studies.</p>
        <Button asChild size="lg">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    )
  }

  if (isComplete) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <div className="bg-primary/10 p-8 rounded-full mb-6 animate-in zoom-in duration-300">
            <Sparkles className="h-12 w-12 text-primary" />
        </div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Session complete!</h1>
        <p className="mb-8 text-muted-foreground">
          You have reviewed <span className="font-semibold text-foreground">{cards.length}</span> card{cards.length !== 1 ? "s" : ""}.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild variant="outline" size="lg">
            <Link href={`/deck/${deck.id}`}>View Deck</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="-ml-2">
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
                {deck.name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium tabular-nums">
             <span className="text-primary">{currentIndex + 1}</span>
             <span className="text-muted-foreground">/</span>
             <span className="text-muted-foreground">{cards.length}</span>
          </div>
        </div>
        <Progress value={progress} className="h-1 w-full rounded-none bg-muted" />
      </header>
      
      <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl perspective-1000">
          <Card className="overflow-hidden shadow-lg border-muted/60 min-h-[400px] flex flex-col">
            <CardContent className="flex-1 flex flex-col justify-center p-6 sm:p-10 text-center">
              
              {/* FRONT (QUESTION) */}
              <div className="flex-1 flex flex-col justify-center items-center space-y-4">
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-primary/10 text-primary uppercase tracking-wider">
                    Question
                </span>
                
                {currentCard.front_image_url && (
                  <div className="relative rounded-lg overflow-hidden border bg-muted/20 max-h-64 w-full flex justify-center">
                     <ImageViewerDialog src={currentCard.front_image_url} alt="Front image" triggerClassName="w-auto h-auto max-h-64 object-contain" />
                  </div>
                )}
                
                <div className="flex items-center justify-center gap-3 w-full">
                    <h2 className="text-2xl sm:text-3xl font-bold text-balance leading-tight">
                        {currentCard.front}
                    </h2>
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        onClick={(e) => { e.stopPropagation(); playAudio(currentCard.front); }}
                        title="Listen"
                    >
                        <Volume2 className={`h-5 w-5 ${isPlayingAudio ? 'animate-pulse text-primary' : ''}`} />
                        <span className="sr-only">Listen</span>
                    </Button>
                </div>
              </div>

              {/* DIVIDER */}
              {showAnswer && (
                  <div className="my-8 border-t border-dashed" />
              )}

              {/* BACK (ANSWER) */}
              {showAnswer && (
                <div className="flex-1 flex flex-col justify-center items-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-muted text-muted-foreground uppercase tracking-wider">
                    Answer
                  </span>
                  
                   {currentCard.back_image_url && (
                    <div className="relative rounded-lg overflow-hidden border bg-muted/20 max-h-64 w-full flex justify-center">
                        <ImageViewerDialog src={currentCard.back_image_url} alt="Back image" triggerClassName="w-auto h-auto max-h-64 object-contain" />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center gap-3 w-full">
                      <p className="text-xl sm:text-2xl text-muted-foreground text-balance">
                        {currentCard.back}
                      </p>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        onClick={(e) => { e.stopPropagation(); playAudio(currentCard.back); }}
                        title="Listen"
                    >
                        <Volume2 className={`h-5 w-5 ${isPlayingAudio ? 'animate-pulse text-primary' : ''}`} />
                        <span className="sr-only">Listen</span>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CONTROLS */}
        <div className="w-full max-w-2xl mt-8 h-24 flex items-end justify-center">
          {!showAnswer ? (
            <Button size="lg" onClick={() => setShowAnswer(true)} className="w-full sm:w-auto min-w-[200px] text-lg h-12 shadow-md hover:shadow-lg transition-all">
              Show Answer <span className="ml-2 text-xs opacity-50 bg-primary-foreground/20 px-1.5 py-0.5 rounded">SPACE</span>
            </Button>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
              <RatingButton 
                rating={1} 
                label="Again" 
                icon={<RotateCcw className="h-4 w-4" />} 
                interval={getIntervalText(1)} 
                colorClass="hover:border-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={() => handleRating(1)} 
                disabled={isSubmitting} 
                shortcut={shortcuts?.rate_again || '1'}
              />
              <RatingButton 
                rating={2} 
                label="Hard" 
                icon={<Clock className="h-4 w-4" />} 
                interval={getIntervalText(2)} 
                colorClass="hover:border-orange-500 hover:bg-orange-500/5 hover:text-orange-600 dark:hover:text-orange-400"
                onClick={() => handleRating(2)} 
                disabled={isSubmitting} 
                shortcut={shortcuts?.rate_hard || '2'}
              />
              <RatingButton 
                rating={3} 
                label="Good" 
                icon={<ThumbsUp className="h-4 w-4" />} 
                interval={getIntervalText(3)} 
                colorClass="hover:border-blue-500 hover:bg-blue-500/5 hover:text-blue-600 dark:hover:text-blue-400"
                onClick={() => handleRating(3)} 
                disabled={isSubmitting} 
                shortcut={shortcuts?.rate_good || '3'}
              />
              <RatingButton 
                rating={4} 
                label="Easy" 
                icon={<Sparkles className="h-4 w-4" />} 
                interval={getIntervalText(4)} 
                colorClass="hover:border-green-500 hover:bg-green-500/5 hover:text-green-600 dark:hover:text-green-400"
                onClick={() => handleRating(4)} 
                disabled={isSubmitting} 
                shortcut={shortcuts?.rate_easy || '4'}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function RatingButton({ rating, label, icon, interval, colorClass, onClick, disabled, shortcut }: any) {
    return (
        <Button 
            variant="outline" 
            className={`h-auto flex-col gap-1.5 py-3 transition-all duration-200 border-muted-foreground/20 ${colorClass}`} 
            onClick={onClick} 
            disabled={disabled}
        >
            <div className="flex items-center gap-2">
                {icon}
                <span className="font-semibold">{label}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{interval}</span>
                <span className="border rounded px-1 min-w-[1.2rem] text-center opacity-70 hidden sm:inline-block">{shortcut}</span>
            </div>
        </Button>
    )
}