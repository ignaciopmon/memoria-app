// components/create-ai-deck-dialog.tsx
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Loader2, CheckCircle, AlertTriangle } from "lucide-react"
import Link from "next/link"

export function CreateAIDeckDialog() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'form' | 'loading' | 'success' | 'error'>('form')
  
  // Form state
  const [deckName, setDeckName] = useState("")
  const [topic, setTopic] = useState("")
  const [cardType, setCardType] = useState("qa")
  const [cardCount, setCardCount] = useState("10")
  const [language, setLanguage] = useState("Spanish")

  const [errorMessage, setErrorMessage] = useState("")
  const [newDeckId, setNewDeckId] = useState<string | null>(null)

  const router = useRouter()

  const resetForm = () => {
    setDeckName("")
    setTopic("")
    setCardType("qa")
    setCardCount("10")
    setLanguage("Spanish")
    setErrorMessage("")
    setNewDeckId(null)
    setView('form')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setView('loading')
    setErrorMessage("")

    try {
      const response = await fetch('/api/generate-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deckName,
          topic,
          cardType,
          cardCount: parseInt(cardCount),
          language,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'An unknown error occurred.')
      }
      
      setNewDeckId(result.deckId)
      setView('success')
      router.refresh()

    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create deck.")
      setView('error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setTimeout(resetForm, 300)}}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="mr-2 h-4 w-4" />
          New AI Deck
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          {view === 'form' && (
            <>
              <DialogHeader>
                <DialogTitle>Create Deck with AI</DialogTitle>
                <DialogDescription>Describe the deck you want, and AI will generate the cards for you.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="deckName">Deck Name *</Label>
                  <Input id="deckName" placeholder="E.g., World War II Basics" value={deckName} onChange={(e) => setDeckName(e.target.value)} required />
                </div>
                 <div className="grid gap-2">
                  <Label htmlFor="topic">Topic & Instructions *</Label>
                  <Textarea
                    id="topic"
                    placeholder="E.g., Generate flashcards about the main events and key figures of World War II. Focus on dates and their significance."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required
                    rows={4}
                  />
                </div>
                {/* --- CAMBIO AQUÍ: de sm:grid-cols-3 a sm:grid-cols-2 --- */}
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
                    <div className="grid gap-2 sm:col-span-1"> {/* Este se ajustará bien ahora */}
                        <Label htmlFor="language">Language</Label>
                        <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger id="language"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Spanish">Spanish</SelectItem>
                                <SelectItem value="English">English</SelectItem>
                                <SelectItem value="French">French</SelectItem>
                                <SelectItem value="German">German</SelectItem>
                                {/* --- CAMBIO AQUÍ: Añadido Portugués --- */}
                                <SelectItem value="Portuguese">Portuguese</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!deckName.trim() || !topic.trim()}>Generate Deck</Button>
              </DialogFooter>
            </>
          )}

          {view === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h3 className="text-lg font-semibold">Generating your deck...</h3>
              <p className="text-sm text-muted-foreground">This may take a moment. The AI is hard at work!</p>
            </div>
          )}

          {view === 'success' && (
             <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h3 className="text-lg font-semibold">Deck Created Successfully!</h3>
              <p className="text-sm text-muted-foreground">Your new deck "{deckName}" is ready.</p>
               <DialogFooter className="mt-4 sm:justify-center">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
                  {newDeckId && <Button asChild><Link href={`/deck/${newDeckId}`}>View Deck</Link></Button>}
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