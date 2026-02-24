"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Brain, ArrowLeft, CheckCircle, RotateCcw, Clock, ThumbsUp, Sparkles, Volume2, VolumeX, Maximize, Minimize } from "lucide-react"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { Shortcuts } from "@/components/shortcuts-form"
import { ImageViewerDialog } from "./image-viewer-dialog"
import { calculateNextReview, type UserSettings, type Rating } from "@/lib/srs"
import Image from "next/image"

interface StudySessionProps {
  deck: { id: string; name: string }
  initialCards: Array<{
    id: string
    front: string
    back: string
    front_image_url: string | null
    back_image_url: string | null
    is_typing_enabled?: boolean
    ease_factor: number
    interval: number
    repetitions: number
    next_review_date: string
    last_rating: number | null
  }>
}

const guessLanguage = (text: string): string => {
  if (!text) return 'en-US';
  const str = text.toLowerCase();

  const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/;
  const chineseRegex = /[\u4e00-\u9fff]/;
  const koreanRegex = /[\uac00-\ud7af]/;
  const russianRegex = /[А-яЁё]/;
  const spanishRegex = /[áéíóúüñ¿¡]/i;
  const frenchRegex = /[àâçéèêëîïôûùüÿœæ]/i;
  const germanRegex = /[äöüß]/i;

  if (japaneseRegex.test(str)) return 'ja-JP';
  if (koreanRegex.test(str)) return 'ko-KR';
  if (chineseRegex.test(str)) return 'zh-CN';
  if (russianRegex.test(str)) return 'ru-RU';

  const words = str.split(/\s+/);
  const isSpanish = words.some(w => ['el', 'la', 'los', 'las', 'un', 'una', 'y', 'de', 'en', 'por', 'para', 'con', 'que', 'es'].includes(w)) || spanishRegex.test(str);
  const isEnglish = words.some(w => ['the', 'a', 'an', 'and', 'of', 'in', 'on', 'for', 'with', 'that', 'is', 'it'].includes(w));
  const isFrench = words.some(w => ['le', 'la', 'les', 'un', 'une', 'et', 'de', 'en', 'pour', 'avec', 'qui', 'est', 'ce'].includes(w)) || frenchRegex.test(str);
  const isGerman = words.some(w => ['der', 'die', 'das', 'ein', 'eine', 'und', 'in', 'zu', 'mit', 'ist', 'für'].includes(w)) || germanRegex.test(str);
  const isItalian = words.some(w => ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'e', 'di', 'in', 'per', 'con', 'che'].includes(w));

  if (isSpanish && !isFrench && !isItalian) return 'es-ES';
  if (isFrench && !isSpanish) return 'fr-FR';
  if (isGerman) return 'de-DE';
  if (isItalian && !isSpanish && !isFrench) return 'it-IT';
  if (isSpanish) return 'es-ES'; 
  
  if (isEnglish) return 'en-US';

  return 'en-US';
};

export function StudySession({ deck, initialCards }: StudySessionProps) {
  const [cards, setCards] = useState(initialCards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [userAnswer, setUserAnswer] = useState("")
  
  const [isZenMode, setIsZenMode] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
  const [shortcuts, setShortcuts] = useState<Shortcuts | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchUserSettings = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: settingsData } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
        if (settingsData) {
            setUserSettings(settingsData)
            setIsZenMode(settingsData.zen_mode ?? false)
            setSoundEnabled(settingsData.sound_enabled ?? true)
        }
        
        const { data: shortcutsData } = await supabase.from('user_shortcuts').select('*').eq('user_id', user.id).single()
        setShortcuts(shortcutsData)
      }
    }
    fetchUserSettings()
  }, [])

  const toggleZenMode = async () => {
    const newVal = !isZenMode
    setIsZenMode(newVal)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('user_settings').update({ zen_mode: newVal }).eq('user_id', user.id)
  }

  const toggleSound = async () => {
    const newVal = !soundEnabled
    setSoundEnabled(newVal)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('user_settings').update({ sound_enabled: newVal }).eq('user_id', user.id)
  }

  const currentCard = cards[currentIndex]
  const progress = (currentIndex / (cards.length || 1)) * 100
  const isComplete = currentIndex >= cards.length

  const playAudio = useCallback((text: string) => {
    if (!text || isPlayingAudio || !soundEnabled) return;
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    
    const langCode = guessLanguage(text);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    
    const voices = window.speechSynthesis.getVoices();
    const baseLang = langCode.split('-')[0];

    let voice = voices.find(v => v.lang.startsWith(baseLang) && v.name.includes('Google'));
    if (!voice) voice = voices.find(v => v.lang.startsWith(baseLang));
    if (!voice) voice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Google'));
    if (!voice) voice = voices.find(v => v.lang.startsWith('en-'));

    if (voice) utterance.voice = voice;

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  }, [isPlayingAudio, soundEnabled]);

  const playFeedback = useCallback(() => {
    if (!soundEnabled) return;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(40);
    }
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
    }
  }, [soundEnabled]);

  const handleRating = useCallback(async (rating: Rating) => {
    if (!currentCard || isSubmitting) return
    setIsSubmitting(true)
    playFeedback() 
    
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
        .update({ ...updates, ai_suggestion: null, updated_at: new Date().toISOString() })
        .eq("id", currentCard.id)
        
      await supabase.from("card_reviews").insert({ card_id: currentCard.id, rating })
      
      if (rating === 1) {
        setCards(prevCards => [...prevCards, currentCard]);
      }

      setCurrentIndex((prev) => prev + 1)
      setShowAnswer(false)
      setUserAnswer("") 
    } catch (error) {
      console.error("Error submitting rating:", error)
    } finally {
      setIsSubmitting(false)
    }
  }, [currentCard, isSubmitting, userSettings, playFeedback])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return

    const key = event.key === ' ' ? ' ' : event.key.toLowerCase()
    const s = shortcuts || { rate_again: '1', rate_hard: '2', rate_good: '3', rate_easy: '4' }

    if (!isComplete) {
        if (!showAnswer && key === ' ') {
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

    if (key === 'd') {
        event.preventDefault()
        router.push('/dashboard')
    }
  }, [showAnswer, shortcuts, handleRating, router, isComplete, currentCard, playAudio])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
        <p className="mb-8 text-muted-foreground max-w-md">There are no cards due for review in this deck right now.</p>
        <Button asChild size="lg"><Link href="/dashboard">Back to Dashboard</Link></Button>
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
          <Button asChild variant="outline" size="lg"><Link href={`/deck/${deck.id}`}>View Deck</Link></Button>
          <Button asChild size="lg"><Link href="/dashboard">Go to Dashboard</Link></Button>
        </div>
      </div>
    )
  }

  // Pre-cargar las imágenes de la siguiente tarjeta
  const nextCard = currentIndex + 1 < cards.length ? cards[currentIndex + 1] : null;

  return (
    <div className="flex min-h-screen flex-col bg-background relative">
      
      {/* Sistema Invisible de Precarga de Imágenes */}
      {nextCard && (
        <div className="hidden" aria-hidden="true">
          {nextCard.front_image_url && <Image src={nextCard.front_image_url} alt="preload" width={1} height={1} priority />}
          {nextCard.back_image_url && <Image src={nextCard.back_image_url} alt="preload" width={1} height={1} priority />}
        </div>
      )}

      <header className={`border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 ${isZenMode ? 'hidden' : 'block'}`}>
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="-ml-2">
              <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">{deck.name}</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-sm font-medium tabular-nums flex items-center gap-1">
                 <span className="text-primary">{currentIndex + 1}</span>
                 <span className="text-muted-foreground">/</span>
                 <span className="text-muted-foreground">{cards.length}</span>
             </div>
             <Button variant="ghost" size="icon" onClick={toggleSound} title={soundEnabled ? "Mute Sounds" : "Enable Sounds"} className="text-muted-foreground hover:text-foreground">
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
             </Button>
             <Button variant="ghost" size="icon" onClick={toggleZenMode} title="Focus Mode" className="text-muted-foreground hover:text-foreground">
                <Maximize className="h-4 w-4" />
             </Button>
          </div>
        </div>
        <Progress value={progress} className="h-1 w-full rounded-none bg-muted" />
      </header>
      
      <main className={`flex flex-1 flex-col items-center justify-center p-4 sm:p-8 transition-all ${isZenMode ? 'fixed inset-0 z-50 bg-background/95 backdrop-blur-sm' : ''}`}>
        
        {isZenMode && (
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-50 text-muted-foreground hover:text-foreground" onClick={toggleZenMode} title="Exit Focus Mode">
            <Minimize className="h-5 w-5" />
          </Button>
        )}

        <div className="w-full max-w-2xl flex-1 flex flex-col" style={{ perspective: '1000px' }}>
          <div 
             className="relative w-full h-full min-h-[40vh] sm:min-h-[50vh] transition-transform duration-500 ease-out"
             style={{ 
                 transformStyle: 'preserve-3d', 
                 transform: showAnswer ? 'rotateY(180deg)' : 'rotateY(0deg)' 
             }}
          >
            
            <Card 
               onClick={() => !showAnswer && setShowAnswer(true)}
               className={`absolute inset-0 flex flex-col overflow-hidden shadow-xl border-muted/60 bg-card z-10 select-none ${!showAnswer ? 'cursor-pointer hover:ring-2 ring-primary/20 transition-all' : ''}`}
               style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            >
              <CardContent className="flex-1 overflow-y-auto flex flex-col justify-center p-6 sm:p-10 text-center">
                <div className="flex-1 flex flex-col justify-center items-center space-y-4 pointer-events-none">
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-primary/10 text-primary uppercase tracking-wider mb-2">
                      Question
                  </span>
                  
                  {currentCard.front_image_url && (
                    <div className="relative rounded-lg overflow-hidden border bg-muted/20 max-h-56 w-full flex justify-center mb-4 pointer-events-auto">
                       <ImageViewerDialog src={currentCard.front_image_url} alt="Front image" triggerClassName="w-auto h-auto max-h-56 object-contain" />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center gap-3 w-full">
                      <h2 className="text-2xl sm:text-3xl font-bold text-balance leading-tight">
                          {currentCard.front}
                      </h2>
                      <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors pointer-events-auto"
                          onClick={(e) => { e.stopPropagation(); playAudio(currentCard.front); }}
                          title="Listen"
                      >
                          <Volume2 className={`h-5 w-5 ${isPlayingAudio ? 'animate-pulse text-primary' : ''}`} />
                      </Button>
                  </div>
                  
                  {!showAnswer && currentCard.is_typing_enabled && (
                    <div className="mt-6 w-full max-w-sm pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        <Textarea
                            placeholder="Type your answer here..."
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            className="resize-none bg-background text-foreground"
                            rows={3}
                        />
                    </div>
                  )}

                  {!showAnswer && !currentCard.is_typing_enabled && (
                    <p className="text-xs text-muted-foreground mt-8 animate-pulse">Tap anywhere to reveal</p>
                  )}
                  {!showAnswer && currentCard.is_typing_enabled && (
                    <p className="text-xs text-muted-foreground mt-4">Tap outside the box or press "Show Answer" to reveal</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card 
                className="absolute inset-0 flex flex-col overflow-hidden shadow-xl border-muted/60 bg-card"
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <CardContent className="flex-1 overflow-y-auto flex flex-col justify-center p-6 sm:p-10 text-center">
                <div className="opacity-50 text-sm mb-4 font-medium text-balance">
                   {currentCard.front}
                </div>
                <div className="my-2 border-t border-dashed w-full max-w-xs mx-auto mb-6" />

                <div className="flex-1 flex flex-col justify-center items-center space-y-4">
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-muted text-muted-foreground uppercase tracking-wider mb-2">
                    Answer
                  </span>
                  
                  {currentCard.is_typing_enabled && userAnswer.trim() !== "" && (
                    <div className="mb-2 w-full max-w-sm rounded-lg border bg-muted/50 p-4 text-left shadow-sm">
                      <p className="mb-1 text-xs font-bold text-muted-foreground">YOUR ANSWER:</p>
                      <p className="text-sm font-medium">{userAnswer}</p>
                    </div>
                  )}

                   {currentCard.back_image_url && (
                    <div className="relative rounded-lg overflow-hidden border bg-muted/20 max-h-56 w-full flex justify-center mb-4">
                        <ImageViewerDialog src={currentCard.back_image_url} alt="Back image" triggerClassName="w-auto h-auto max-h-56 object-contain" />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center gap-3 w-full">
                      <p className="text-xl sm:text-2xl text-foreground text-balance font-medium">
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
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        <div className="w-full max-w-2xl mt-8 h-24 flex items-end justify-center z-10">
          {!showAnswer ? (
            <Button size="lg" onClick={() => setShowAnswer(true)} className="w-full sm:w-auto min-w-[200px] text-lg h-12 shadow-md hover:shadow-lg transition-all animate-in fade-in zoom-in duration-300">
              Show Answer <span className="ml-2 text-xs opacity-50 bg-primary-foreground/20 px-1.5 py-0.5 rounded">SPACE</span>
            </Button>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
              <RatingButton rating={1} label="Again" icon={<RotateCcw className="h-4 w-4" />} interval={getIntervalText(1)} colorClass="hover:border-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => handleRating(1)} disabled={isSubmitting} shortcut={shortcuts?.rate_again || '1'} />
              <RatingButton rating={2} label="Hard" icon={<Clock className="h-4 w-4" />} interval={getIntervalText(2)} colorClass="hover:border-orange-500 hover:bg-orange-500/5 hover:text-orange-600 dark:hover:text-orange-400" onClick={() => handleRating(2)} disabled={isSubmitting} shortcut={shortcuts?.rate_hard || '2'} />
              <RatingButton rating={3} label="Good" icon={<ThumbsUp className="h-4 w-4" />} interval={getIntervalText(3)} colorClass="hover:border-blue-500 hover:bg-blue-500/5 hover:text-blue-600 dark:hover:text-blue-400" onClick={() => handleRating(3)} disabled={isSubmitting} shortcut={shortcuts?.rate_good || '3'} />
              <RatingButton rating={4} label="Easy" icon={<Sparkles className="h-4 w-4" />} interval={getIntervalText(4)} colorClass="hover:border-green-500 hover:bg-green-500/5 hover:text-green-600 dark:hover:text-green-400" onClick={() => handleRating(4)} disabled={isSubmitting} shortcut={shortcuts?.rate_easy || '4'} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function RatingButton({ rating, label, icon, interval, colorClass, onClick, disabled, shortcut }: any) {
    return (
        <Button variant="outline" className={`h-auto flex-col gap-1.5 py-3 transition-all duration-200 border-muted-foreground/20 ${colorClass}`} onClick={onClick} disabled={disabled}>
            <div className="flex items-center gap-2">{icon}<span className="font-semibold">{label}</span></div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span>{interval}</span><span className="border rounded px-1 min-w-[1.2rem] text-center opacity-70 hidden sm:inline-block">{shortcut}</span></div>
        </Button>
    )
}