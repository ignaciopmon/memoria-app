// components/add-ai-cards-dialog.tsx
"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Loader2, CheckCircle, AlertTriangle } from "lucide-react"

interface AddAiCardsDialogProps {
  deckId: string;
  deckName: string;
}

export function AddAiCardsDialog({ deckId, deckName }: AddAiCardsDialogProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'form' | 'loading' | 'success' | 'error'>('form')
  
  // Form state
  const [topic, setTopic] = useState("")
  const [cardType, setCardType] = useState("qa")
  const [cardCount, setCardCount] = useState("10")
  const [language, setLanguage] = useState("Spanish")
  const [difficulty, setDifficulty] = useState("medium")

  const [errorMessage, setErrorMessage] = useState("")
  const [addedCount, setAddedCount] = useState(0)
  
  const router = useRouter()

  const resetForm = () => {
    setTopic("")
    setCardType("qa")
    setCardCount("10")
    setLanguage("Spanish")
    setDifficulty("medium")
    setErrorMessage("")
    setAddedCount(0)
    setView('form')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setView('loading')
    setErrorMessage("")

    try {
      const response = await fetch('/api/add-ai-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deckId, // <-- Pasamos el ID del mazo existente
          topic,
          cardType,
          cardCount: parseInt(cardCount),
          language,
          difficulty,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'An unknown error occurred.')
      }
      
      setAddedCount(result.addedCount)
      setView('success')
      router.refresh() // Refresca la página del mazo para mostrar las nuevas tarjetas

    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add cards.")
      setView('error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setTimeout(resetForm, 300)}}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="mr-2 h-4 w-4" />
          Add AI Cards
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          {view === 'form' && (
            <>
              <DialogHeader>
                <DialogTitle>Add AI Cards to "{deckName}"</DialogTitle>
                <DialogDescription>
                  Generate new cards based on a topic. The AI will avoid duplicating cards already in this deck.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                 <div className="grid gap-2">
                  <Label htmlFor="topic">Topic & Instructions *</Label>
                  <Textarea
                    id="topic"
                    placeholder="E.g., More cards about the Cold War, focusing on proxy wars."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="cardType">Card Type</Label>
                        <Select value={cardType} onValueChange={setCardType}>
                            <SelectTrigger id="cardType"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="qa">Question & Answer</SelectItem>
                                <SelectItem value="vocabulary">Vocabulary/Terms</SelectItem>
                                <SelectItem value="facts">Key Facts</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cardCount">Number of Cards</Label>
                        <Select value={cardCount} onValueChange={setCardCount}>
                            <SelectTrigger id="cardCount"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="15">15</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="language">Language</Label>
                        <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger id="language"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Spanish">Spanish</SelectItem>
                                <SelectItem value="English">English</SelectItem>
                                <SelectItem value="French">French</SelectItem>
                                <SelectItem value="German">German</SelectItem>
                                <SelectItem value="Portuguese">Portuguese</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="difficulty">Difficulty</Label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                            <SelectTrigger id="difficulty"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="easy">Easy</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!topic.trim()}>Generate Cards</Button>
              </DialogFooter>
            </>
          )}

          {view === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h3 className="text-lg font-semibold">Generating new cards...</h3>
              <p className="text-sm text-muted-foreground">Checking for duplicates and creating content...</p>
            </div>
          )}

          {view === 'success' && (
             <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h3 className="text-lg font-semibold">Cards Added!</h3>
              <p className="text-sm text-muted-foreground">Successfully added {addedCount} new cards to "{deckName}".</p>
               <DialogFooter className="mt-4 sm:justify-center">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
              </DialogFooter>
            </div>
          )}

          {view === 'error' && (
             <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
              <h3 className="text-lg font-semibold">Generation Failed</h3>
              <p className="text-sm text-muted-foreground max-w-sm">{errorMessage}</p>
               <DialogFooter className="mt-4 sm:justify-center">
                  <Button type="button" variant="outline" onClick={resetForm}>Try Again</Button>
              </DialogFooter>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}