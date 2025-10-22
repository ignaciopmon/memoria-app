// components/add-ai-cards-dialog.tsx
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Loader2, CheckCircle, AlertTriangle, FileText, Upload } from "lucide-react" // Added FileText, Upload
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group" // Import RadioGroup
import { Input } from "@/components/ui/input" // Import Input for page range

interface AddAiCardsDialogProps {
  deckId: string;
  deckName: string;
}

export function AddAiCardsDialog({ deckId, deckName }: AddAiCardsDialogProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'form' | 'loading' | 'success' | 'error'>('form')

  // New state for generation source
  const [generationSource, setGenerationSource] = useState<'topic' | 'pdf'>('topic')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pageRange, setPageRange] = useState("") // e.g., "1-5, 8, 10-12"
  const fileInputRef = useRef<HTMLInputElement>(null) // Ref for file input

  // Form state
  const [topic, setTopic] = useState("")
  const [cardType, setCardType] = useState("qa")
  const [cardCount, setCardCount] = useState("10")
  const [language, setLanguage] = useState("Spanish")
  const [difficulty, setDifficulty] = useState("medium")

  const [errorMessage, setErrorMessage] = useState("") // Renamed 'error' state to 'errorMessage' for clarity
  const [addedCount, setAddedCount] = useState(0)

  const router = useRouter()

  const resetForm = () => {
    setTopic("")
    setPdfFile(null) // Reset PDF file
    setPageRange("") // Reset page range
    if (fileInputRef.current) fileInputRef.current.value = ""; // Clear file input visually
    setGenerationSource('topic') // Reset source
    setCardType("qa")
    setCardCount("10")
    setLanguage("Spanish")
    setDifficulty("medium")
    setErrorMessage("") // Use setErrorMessage
    setAddedCount(0)
    setView('form')
  }

  // --- MODIFIED handleSubmit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setView('loading')
    setErrorMessage("") // Use setErrorMessage

    const formData = new FormData();
    formData.append('deckId', deckId); // Keep existing deck ID
    formData.append('cardType', cardType);
    formData.append('cardCount', cardCount);
    formData.append('language', language);
    formData.append('difficulty', difficulty);
    formData.append('generationSource', generationSource); // Send source type

    if (generationSource === 'topic') {
      if (!topic.trim()) { // Added check here
         setErrorMessage("Please provide a topic description.");
         setView('form');
         return;
      }
      formData.append('topic', topic);
    } else if (generationSource === 'pdf' && pdfFile) {
      formData.append('pdfFile', pdfFile);
      formData.append('pageRange', pageRange); // Send page range
    } else if (generationSource === 'pdf' && !pdfFile) {
        setErrorMessage("Please select a PDF file."); // Use setErrorMessage
        setView('form');
        return;
    }

    try {
      const response = await fetch('/api/add-ai-cards', {
        method: 'POST',
        // Body is FormData
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'An unknown error occurred.')
      }

      setAddedCount(result.addedCount || 0) // Ensure addedCount is handled
      setView('success')
      router.refresh() // Refresh the deck page

    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add cards.") // Use setErrorMessage
      setView('error')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setErrorMessage(""); // Use setErrorMessage
    } else {
      setPdfFile(null);
      setErrorMessage("Please select a valid PDF file."); // Use setErrorMessage
      if (fileInputRef.current) fileInputRef.current.value = ""; // Clear invalid file
    }
  };

  // Determine if submit should be disabled
   const isSubmitDisabled = view === 'loading' || // Also disable if loading
                           (generationSource === 'topic' && !topic.trim()) ||
                           (generationSource === 'pdf' && !pdfFile);


  // *** The actual JSX rendering starts here ***
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setTimeout(resetForm, 300)}}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="mr-2 h-4 w-4" />
          Add AI Cards
        </Button>
      </DialogTrigger>
      {/* Increased max width */}
      <DialogContent className="max-w-3xl">
        <form onSubmit={handleSubmit}>
          {view === 'form' && (
            <>
              <DialogHeader>
                <DialogTitle>Add AI Cards to "{deckName}"</DialogTitle>
                <DialogDescription>
                  Generate new cards from a topic description or a PDF document. The AI will try to match the style and avoid duplicates.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4"> {/* Increased gap */}
                 {/* Generation Source Selection */}
                <div className="grid gap-2">
                  <Label>Generation Source</Label>
                  <RadioGroup value={generationSource} onValueChange={(value) => setGenerationSource(value as 'topic' | 'pdf')} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="topic" id="add-source-topic" />
                      <Label htmlFor="add-source-topic">Describe Topic</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pdf" id="add-source-pdf" />
                      <Label htmlFor="add-source-pdf">From PDF</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Conditional Inputs */}
                {generationSource === 'topic' ? (
                  <div className="grid gap-2">
                    <Label htmlFor="topic">Topic & Instructions *</Label>
                    <Textarea
                      id="topic"
                      placeholder="E.g., More cards about the Cold War, focusing on proxy wars and key treaties."
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
                      {/* Changed 'errorMessage' state usage */}
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
                        <Label htmlFor="add-cardType">Card Type</Label>
                        <Select value={cardType} onValueChange={setCardType}>
                            <SelectTrigger id="add-cardType"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="qa">Question & Answer</SelectItem>
                                <SelectItem value="vocabulary">Vocabulary/Terms</SelectItem>
                                <SelectItem value="facts">Key Facts</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {/* Number of Cards */}
                    <div className="grid gap-2">
                        <Label htmlFor="add-cardCount">Number of Cards</Label>
                        <Select value={cardCount} onValueChange={setCardCount}>
                            <SelectTrigger id="add-cardCount"><SelectValue /></SelectTrigger>
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
                        <Label htmlFor="add-language">Language</Label>
                        <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger id="add-language"><SelectValue /></SelectTrigger>
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
                        <Label htmlFor="add-difficulty">Difficulty</Label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                            <SelectTrigger id="add-difficulty"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="easy">Easy</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                 {/* Display general error if exists and not related to file */}
                {/* Changed 'errorMessage' state usage */}
                {errorMessage && pdfFile && <p className="text-sm text-destructive">{errorMessage}</p>}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                {/* Updated disable logic */}
                <Button type="submit" disabled={isSubmitDisabled}>
                    {view === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                    {view === 'loading' ? 'Generating...' : 'Generate Cards'}
                </Button>
              </DialogFooter>
            </>
          )}

           {/* Loading View */}
          {view === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h3 className="text-lg font-semibold">Generating new cards...</h3>
              <p className="text-sm text-muted-foreground">
                {generationSource === 'pdf' ? 'Processing PDF and creating cards...' : 'Checking for duplicates and creating content...'} This may take a moment.
              </p>
            </div>
          )}

          {/* Success View */}
          {view === 'success' && (
             <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h3 className="text-lg font-semibold">Cards Added!</h3>
              <p className="text-sm text-muted-foreground">Successfully added {addedCount} new card{addedCount !== 1 ? 's' : ''} to "{deckName}".</p>
               <DialogFooter className="mt-4 sm:justify-center">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
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
  ); // Added closing parenthesis and semicolon for the return statement
} // Added closing brace for the component function