"use client"

import type React from "react"
import { useState, useRef } from "react"
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
import { Sparkles, Loader2, CheckCircle, AlertTriangle, Upload, BrainCircuit } from "lucide-react"
import Link from "next/link"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { z } from "zod"
import { Card } from "./ui/card"
import { ScrollArea } from "./ui/scroll-area"

const cardSchema = z.object({
    cards: z.array(z.object({
        front: z.string(),
        back: z.string()
    }))
})

export function CreateAIDeckDialog({ size }: { size?: React.ComponentProps<typeof Button>["size"] }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'form' | 'loading' | 'success' | 'error'>('form')

  const [generationSource, setGenerationSource] = useState<'topic' | 'pdf'>('topic')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pageRange, setPageRange] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [deckName, setDeckName] = useState("")
  const [topic, setTopic] = useState("")
  const [cardType, setCardType] = useState("qa")
  const [cardCount, setCardCount] = useState("10")
  const [language, setLanguage] = useState("Spanish")
  const [difficulty, setDifficulty] = useState("medium")

  const [errorMessage, setErrorMessage] = useState("")
  const [newDeckId, setNewDeckId] = useState<string | null>(null)
  const router = useRouter()

  const { object, submit, isLoading, stop } = useObject({
      api: '/api/generate-deck-stream',
      schema: cardSchema,
      onFinish: async (event) => {
          if (!event.object?.cards || event.object.cards.length === 0) {
              setErrorMessage("AI generated no valid cards. Try a different prompt.");
              setView('error');
              return;
          }

          try {
              const response = await fetch('/api/save-generated-deck', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      deckName,
                      description: `AI-generated from ${generationSource === 'pdf' ? `PDF` : `Topic`}`,
                      cards: event.object.cards
                  })
              });

              const result = await response.json();
              if (!response.ok) throw new Error(result.error);

              setNewDeckId(result.deckId);
              setView('success');
              router.refresh();
          } catch (e: any) {
              setErrorMessage(e.message || "Failed to save generated cards.");
              setView('error');
          }
      },
      onError: (err) => {
          setErrorMessage(err.message || "Stream interrupted.");
          setView('error');
      }
  });

  const resetForm = () => {
    if (isLoading) stop();
    setDeckName(""); setTopic(""); setPdfFile(null); setPageRange("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setGenerationSource('topic'); setCardType("qa"); setCardCount("10");
    setLanguage("Spanish"); setDifficulty("medium");
    setErrorMessage(""); setNewDeckId(null); setView('form');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setView('loading');
    setErrorMessage("");

    let pdfFileBase64 = null;
    
    if (generationSource === 'pdf' && pdfFile) {
      try {
        pdfFileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(pdfFile);
          reader.onload = () => {
             if (typeof reader.result === 'string') {
                 resolve(reader.result.split(',')[1]);
             } else {
                 reject(new Error("File read error"));
             }
          };
          reader.onerror = error => reject(error);
        });
      } catch (err) {
        setErrorMessage("Failed to process the PDF file.");
        setView('error');
        return;
      }
    }

    // Iniciamos el Stream enviando un objeto JSON plano
    submit({
        cardType,
        cardCount,
        language,
        difficulty,
        generationSource,
        topic: generationSource === 'topic' ? topic : null,
        pageRange: generationSource === 'pdf' ? pageRange : null,
        pdfFileBase64
    });
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file); setErrorMessage("");
    } else {
      setPdfFile(null); setErrorMessage("Please select a valid PDF file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isSubmitDisabled = view === 'loading' || !deckName.trim() || 
                           (generationSource === 'topic' && !topic.trim()) ||
                           (generationSource === 'pdf' && !pdfFile);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setTimeout(resetForm, 300)}}>
      <DialogTrigger asChild>
        <Button variant="default" size={size} className="bg-gradient-to-r from-purple-600 to-primary hover:from-purple-700 hover:to-primary/90 shadow-md border-0">
          <Sparkles className="mr-2 h-4 w-4" />
          Create with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        
        <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
                <BrainCircuit className="h-6 w-6 text-primary" /> Create Deck with AI
            </DialogTitle>
            <DialogDescription>Let the AI analyze your topic or document and generate cards instantly.</DialogDescription>
        </DialogHeader>

        {view === 'form' && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid gap-6 py-4">
              <div className="grid gap-2">
                <Label htmlFor="deckName">Deck Name *</Label>
                <Input id="deckName" placeholder="E.g., Anatomy 101" value={deckName} onChange={(e) => setDeckName(e.target.value)} required />
              </div>

              <div className="grid gap-2">
                <Label>Source Material</Label>
                <RadioGroup value={generationSource} onValueChange={(value) => setGenerationSource(value as 'topic' | 'pdf')} className="flex gap-4">
                  <div className="flex items-center space-x-2 border rounded-lg p-3 flex-1 cursor-pointer data-[state=checked]:border-primary hover:bg-muted/50 transition-colors" onClick={() => setGenerationSource('topic')}>
                    <RadioGroupItem value="topic" id="source-topic" />
                    <Label htmlFor="source-topic" className="cursor-pointer font-medium w-full">Topic Description</Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 flex-1 cursor-pointer data-[state=checked]:border-primary hover:bg-muted/50 transition-colors" onClick={() => setGenerationSource('pdf')}>
                    <RadioGroupItem value="pdf" id="source-pdf" />
                    <Label htmlFor="source-pdf" className="cursor-pointer font-medium w-full">PDF Document</Label>
                  </div>
                </RadioGroup>
              </div>

              {generationSource === 'topic' ? (
                <div className="grid gap-2 animate-in fade-in zoom-in-95 duration-200">
                  <Label htmlFor="topic">Topic Details *</Label>
                  <Textarea id="topic" placeholder="E.g., Generate flashcards about the human skeleton, focusing on the bones of the skull and spine." value={topic} onChange={(e) => setTopic(e.target.value)} required={generationSource === 'topic'} rows={4} className="resize-none" />
                </div>
              ) : (
                <div className="grid gap-4 rounded-xl border p-5 bg-muted/20 animate-in fade-in zoom-in-95 duration-200">
                  <div className="grid gap-2">
                    <Label>Upload PDF *</Label>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileChange} />
                    <Button type="button" variant={pdfFile ? "default" : "outline"} onClick={() => fileInputRef.current?.click()} className="w-full justify-start border-dashed border-2 h-12">
                      <Upload className="mr-2 h-4 w-4" />
                      {pdfFile ? <span className="font-semibold">{pdfFile.name}</span> : "Click to select PDF"}
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pageRange">Specific Pages (Optional)</Label>
                    <Input id="pageRange" placeholder="E.g., 1-5, 8, 10-12" value={pageRange} onChange={(e) => setPageRange(e.target.value)} disabled={!pdfFile} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="grid gap-2">
                      <Label htmlFor="cardCount">Amount</Label>
                      <Select value={cardCount} onValueChange={setCardCount}>
                          <SelectTrigger id="cardCount"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="5">5 Cards</SelectItem>
                              <SelectItem value="10">10 Cards</SelectItem>
                              <SelectItem value="15">15 Cards</SelectItem>
                              <SelectItem value="20">20 Cards</SelectItem>
                              <SelectItem value="30">30 Cards</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="cardType">Card Type</Label>
                      <Select value={cardType} onValueChange={setCardType}>
                          <SelectTrigger id="cardType"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="qa">Q & A</SelectItem>
                              <SelectItem value="vocabulary">Vocabulary</SelectItem>
                              <SelectItem value="facts">Key Facts</SelectItem>
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
                  <div className="grid gap-2">
                      <Label htmlFor="language">Language</Label>
                      <Select value={language} onValueChange={setLanguage}>
                          <SelectTrigger id="language"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Spanish">Spanish</SelectItem>
                              <SelectItem value="English">English</SelectItem>
                              <SelectItem value="French">French</SelectItem>
                              <SelectItem value="German">German</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
              </div>
              {errorMessage && <p className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md">{errorMessage}</p>}
            </div>
            
            <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t mt-4 flex-shrink-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitDisabled} className="bg-primary hover:bg-primary/90 text-white w-full sm:w-auto">
                  <Sparkles className="mr-2 h-4 w-4"/> Generate Magic
              </Button>
            </DialogFooter>
          </form>
        )}

        {view === 'loading' && (
          <div className="flex-1 flex flex-col items-center pt-8 pb-4 h-full min-h-[400px]">
            <div className="text-center mb-8 space-y-2">
                <div className="relative inline-flex mb-2">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                    <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
                </div>
                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
                    Crafting your deck...
                </h3>
                <p className="text-sm text-muted-foreground">Reading source and writing flashcards in real-time.</p>
            </div>

            <ScrollArea className="w-full flex-1 border rounded-xl bg-muted/10 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {object?.cards?.map((card, idx) => (
                        <Card key={idx} className="p-4 shadow-sm border-primary/20 bg-background animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-2">
                            <div className="text-xs font-semibold text-primary/70 uppercase tracking-wider mb-1">Card {idx + 1}</div>
                            <div className="font-medium">{card?.front || <span className="text-muted-foreground/30 animate-pulse">Thinking...</span>}</div>
                            <div className="h-px bg-border w-full my-1" />
                            <div className="text-muted-foreground text-sm">{card?.back || <span className="text-muted-foreground/30 animate-pulse">Writing...</span>}</div>
                        </Card>
                    ))}
                    
                    {(!object?.cards || object.cards.length < parseInt(cardCount)) && (
                        <Card className="p-4 shadow-none border-dashed border-muted-foreground/30 bg-transparent flex flex-col gap-3 opacity-50">
                            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                            <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
                            <div className="h-4 w-full bg-muted rounded animate-pulse mt-2" />
                        </Card>
                    )}
                </div>
            </ScrollArea>
          </div>
        )}

        {view === 'success' && (
           <div className="flex-1 flex flex-col items-center justify-center py-16 gap-4 text-center animate-in zoom-in-95 duration-500">
            <div className="rounded-full bg-green-500/10 p-4 mb-2">
                <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold">Deck Ready!</h3>
            <p className="text-muted-foreground text-lg">"{deckName}" has been created with {object?.cards?.length} cards.</p>
             <div className="mt-8 flex gap-3 w-full sm:w-auto justify-center">
                <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>Close</Button>
                {newDeckId && <Button asChild size="lg"><Link href={`/deck/${newDeckId}`}>Start Studying</Link></Button>}
            </div>
          </div>
        )}

        {view === 'error' && (
           <div className="flex-1 flex flex-col items-center justify-center py-16 gap-4 text-center">
            <AlertTriangle className="h-16 w-16 text-destructive" />
            <h3 className="text-xl font-bold">Something went wrong</h3>
            <p className="text-muted-foreground max-w-sm">{errorMessage}</p>
             <div className="mt-6">
                <Button type="button" variant="outline" onClick={resetForm}>Try Again</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}