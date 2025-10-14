"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Upload, CheckCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface ImportTxtDialogProps {
  deckId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface TxtCard { front: string; back: string }

export function ImportTxtDialog({ deckId, open, onOpenChange }: ImportTxtDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [previewCards, setPreviewCards] = useState<TxtCard[]>([])
  const router = useRouter()

  const resetState = () => {
    setFile(null); setPreviewCards([]); setImportSuccess(false); setImportedCount(0); setError(null); setIsLoading(false);
  }

  const parseTxtFile = (text: string): TxtCard[] => {
    return text.split('\n').map(line => {
      const parts = line.split('\t'); // Assumes tab-separated
      if (parts.length < 2) return null;
      const front = parts[0].trim();
      const back = parts[1].trim();
      return front && back ? { front, back } : null;
    }).filter((card): card is TxtCard => card !== null);
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    if (!selectedFile.name.toLowerCase().endsWith(".txt")) {
      setError("Please select a valid .txt file"); return;
    }
    setFile(selectedFile); setError(null); setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const cards = parseTxtFile(text);
      if (cards.length === 0) {
        setError("No valid cards found. Ensure the format is 'Front<Tab>Back' on each line.");
      } else {
        setPreviewCards(cards);
      }
      setIsLoading(false);
    };
    reader.onerror = () => { setError("Error reading the file."); setIsLoading(false); };
    reader.readAsText(selectedFile);
  }

  const handleImport = async () => {
    if (!previewCards.length) return
    setIsLoading(true); setError(null);
    const supabase = createClient()
    try {
      const cardsToInsert = previewCards.map(card => ({
        deck_id: deckId, ...card, ease_factor: 2.5, interval: 0, repetitions: 0, next_review_date: new Date().toISOString(),
      }))
      const { error: insertError } = await supabase.from("cards").insert(cardsToInsert)
      if (insertError) throw insertError
      setImportSuccess(true); setImportedCount(cardsToInsert.length);
      router.refresh()
      setTimeout(() => { onOpenChange(false); resetState(); }, 2000)
    } catch (error: any) {
      setError(error.message || "Error importing cards");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) resetState(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from a TXT file</DialogTitle>
          <DialogDescription>Upload a plain text (.txt) file to import your cards.</DialogDescription>
        </DialogHeader>
        {importSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold">Import Successful!</h3>
            <p className="text-muted-foreground">Imported {importedCount} card{importedCount !== 1 ? "s" : ""}.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <input id="txt-file-input" type="file" accept=".txt" onChange={handleFileChange} className="hidden" />
                <Button type="button" variant="outline" onClick={() => document.getElementById("txt-file-input")?.click()} className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {file ? file.name : "Select .txt file"}
                </Button>
                <p className="text-xs text-muted-foreground">Each card should be on a new line, separating the front and back with a Tab.</p>
              </div>
              {previewCards.length > 0 && (
                <div className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">Preview ({previewCards.length} cards found)</p>
                  <div className="space-y-2 text-sm max-h-40 overflow-y-auto pr-2">
                    {previewCards.slice(0, 5).map((card, idx) => (
                      <div key={idx} className="rounded-sm bg-muted p-2">
                        <p className="font-semibold line-clamp-1">{card.front}</p>
                        <p className="text-muted-foreground line-clamp-1">{card.back}</p>
                      </div>
                    ))}
                    {previewCards.length > 5 && <p className="text-xs text-muted-foreground mt-2">... and {previewCards.length - 5} more.</p>}
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
              <Button type="button" onClick={handleImport} disabled={isLoading || !previewCards.length}>
                {isLoading ? "Importing..." : `Import ${previewCards.length} Cards`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}