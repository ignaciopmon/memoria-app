// components/create-ai-deck-dialog.tsx
"use client"

import type React from "react"
import { useState, useRef } from "react" // Import useRef
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
import { Sparkles, Loader2, CheckCircle, AlertTriangle, FileText, Upload } from "lucide-react" // Added FileText, Upload
import Link from "next/link"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group" // Import RadioGroup

export function CreateAIDeckDialog({ size }: { size?: React.ComponentProps<typeof Button>["size"] }) { // Added size prop
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'form' | 'loading' | 'success' | 'error'>('form')

  // New state for generation source
  const [generationSource, setGenerationSource] = useState<'topic' | 'pdf'>('topic')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pageRange, setPageRange] = useState("") // e.g., "1-5, 8, 10-12"
  const fileInputRef = useRef<HTMLInputElement>(null) // Ref for file input

  // Form state
  const [deckName, setDeckName] = useState("")
  const [topic, setTopic] = useState("")
  const [cardType, setCardType] = useState("qa")
  const [cardCount, setCardCount] = useState("10")
  const [language, setLanguage] = useState("Spanish")
  const [difficulty, setDifficulty] = useState("medium")

  const [errorMessage, setErrorMessage] = useState("")
  const [newDeckId, setNewDeckId] = useState<string | null>(null)

  const router = useRouter()

  const resetForm = () => {
    setDeckName("")
    setTopic("")
    setPdfFile(null) // Reset PDF file
    setPageRange("") // Reset page range
    if (fileInputRef.current) fileInputRef.current.value = ""; // Clear file input visually
    setGenerationSource('topic') // Reset source
    setCardType("qa")
    setCardCount("10")
    setLanguage("Spanish")
    setDifficulty("medium")
    setErrorMessage("")
    setNewDeckId(null)
    setView('form')
  }

  // --- MODIFIED handleSubmit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setView('loading')
    setErrorMessage("")

    // Use FormData to send file if PDF source is selected
    const formData = new FormData();
    formData.append('deckName', deckName);
    formData.append('cardType', cardType);
    formData.append('cardCount', cardCount);
    formData.append('language', language);
    formData.append('difficulty', difficulty);
    formData.append('generationSource', generationSource); // Send source type

    if (generationSource === 'topic') {
      formData.append('topic', topic);
    } else if (generationSource === 'pdf' && pdfFile) {
      formData.append('pdfFile', pdfFile);
      formData.append('pageRange', pageRange); // Send page range
    } else if (generationSource === 'pdf' && !pdfFile) {
        setErrorMessage("Please select a PDF file.");
        setView('form');
        return;
    }

    try {
      const response = await fetch('/api/generate-deck', {
        method: 'POST',
        // Body is now FormData, headers are set automatically by fetch
        body: formData,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setErrorMessage("");
    } else {
      setPdfFile(null);
      setErrorMessage("Please select a valid PDF file.");
      if (fileInputRef.current) fileInputRef.current.value = ""; // Clear invalid file
    }
  };

  // Determine if submit should be disabled
const isSubmitDisabled = view === 'loading' || !deckName.trim() || // <-- Changed isLoading
                           (generationSource === 'topic' && !topic.trim()) ||
                           (generationSource === 'pdf' && !pdfFile);
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setTimeout(resetForm, 300)}}>
      <DialogTrigger asChild>
        {/* Pass size prop to Button */}
        <Button variant="outline" size={size}>
          <Sparkles className="mr-2 h-4 w-4" />
          New AI Deck
        </Button>
      </DialogTrigger>
      {/* Increased max width for more space */}
      <DialogContent className="max-w-3xl">
        <form onSubmit={handleSubmit}>
          {view === 'form' && (
            <>
              <DialogHeader>
                <DialogTitle>Create Deck with AI</DialogTitle>
                <DialogDescription>Generate cards from a topic description or a PDF document.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4"> {/* Increased gap */}
                {/* Deck Name */}
                <div className="grid gap-2">
                  <Label htmlFor="deckName">Deck Name *</Label>
                  <Input id="deckName" placeholder="E.g., World War II Basics" value={deckName} onChange={(e) => setDeckName(e.target.value)} required />
                </div>

                {/* Generation Source Selection */}
                <div className="grid gap-2">
                  <Label>Generation Source</Label>
                  <RadioGroup value={generationSource} onValueChange={(value) => setGenerationSource(value as 'topic' | 'pdf')} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="topic" id="source-topic" />
                      <Label htmlFor="source-topic">Describe Topic</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pdf" id="source-pdf" />
                      <Label htmlFor="source-pdf">From PDF</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Conditional Inputs */}
                {generationSource === 'topic' ? (
                  <div className="grid gap-2">
                    <Label htmlFor="topic">Topic & Instructions *</Label>
                    <Textarea
                      id="topic"
                      placeholder="E.g., Generate flashcards about the main events and key figures of World War II. Focus on dates and their significance."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      required={generationSource === 'topic'}
                      rows={4}
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 rounded-md border p-4">
                    <Label>PDF Options *</Label>
                    <div className="grid gap-2">
                      {/* File Input Trigger */}
                      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileChange} />
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full justify-start text-left font-normal">
                        <Upload className="mr-2 h-4 w-4" />
                        {pdfFile ? pdfFile.name : "Select PDF File"}
                      </Button>
                      {errorMessage && !pdfFile && <p className="text-sm text-destructive">{errorMessage}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pageRange">Page Range (Optional)</Label>
                      <Input
                        id="pageRange"
                        placeholder="E.g., 1-5, 8, 10-12 (Leave empty for all pages)"
                        value={pageRange}
                        onChange={(e) => setPageRange(e.target.value)}
                        disabled={!pdfFile}
                      />
                      <p className="text-xs text-muted-foreground">Specify pages or ranges separated by commas.</p>
                    </div>
                  </div>
                )}

                {/* Common Options Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Card Type */}
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
                    {/* Number of Cards */}
                    <div className="grid gap-2">
                        <Label htmlFor="cardCount">Number of Cards</Label>
                        <Select value={cardCount} onValueChange={setCardCount}>
                            <SelectTrigger id="cardCount"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="15">15</SelectItem>
                                <SelectItem value="20">20</SelectItem> {/* Added option */}
                                <SelectItem value="25">25</SelectItem> {/* Added option */}
                            </SelectContent>
                        </Select>
                    </div>
                    {/* Language */}
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
                    {/* Difficulty */}
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
                 {/* Display general error if exists and not related to file */}
                {errorMessage && pdfFile && <p className="text-sm text-destructive">{errorMessage}</p>}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitDisabled}>
                    <Sparkles className="mr-2 h-4 w-4"/>
                    Generate Deck
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Loading View */}
          {view === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h3 className="text-lg font-semibold">Generating your deck...</h3>
              <p className="text-sm text-muted-foreground">
                {generationSource === 'pdf' ? 'Processing PDF and generating cards...' : 'The AI is hard at work!'} This may take a moment.
              </p>
            </div>
          )}

          {/* Success View */}
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

          {/* Error View */}
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