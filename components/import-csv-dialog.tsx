"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, CheckCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface ImportCSVDialogProps {
  deckId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportCSVDialog({ deckId, open, onOpenChange }: ImportCSVDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<string[][]>([])
  const [frontColumn, setFrontColumn] = useState<string>("")
  const [backColumn, setBackColumn] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const router = useRouter()

  const resetState = () => {
    setFile(null); setCsvData([]); setFrontColumn(""); setBackColumn("");
    setImportSuccess(false); setImportedCount(0); setError(null); setIsLoading(false);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please select a valid CSV file"); return;
    }
    setFile(selectedFile); setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split("\n").map((row) => row.split(",").map((cell) => cell.trim()));
      const filteredRows = rows.filter((row) => row.some((cell) => cell.length > 0));
      setCsvData(filteredRows);
      if (filteredRows.length > 0 && filteredRows[0].length >= 2) {
        setFrontColumn("0"); setBackColumn("1");
      }
    };
    reader.readAsText(selectedFile);
  }

  const handleImport = async () => {
    if (!csvData.length || frontColumn === "" || backColumn === "") {
      setError("Please select the columns for Front and Back"); return;
    }
    setIsLoading(true); setError(null);
    const supabase = createClient();
    try {
      const frontIdx = Number.parseInt(frontColumn);
      const backIdx = Number.parseInt(backColumn);
      const cardsToInsert = csvData.slice(1).map((row) => ({
        deck_id: deckId, front: row[frontIdx] || "", back: row[backIdx] || "",
        ease_factor: 2.5, interval: 0, repetitions: 0, next_review_date: new Date().toISOString(),
      })).filter(card => card.front.trim() && card.back.trim());
      
      if (cardsToInsert.length === 0) {
        setError("No valid cards found in the CSV file."); setIsLoading(false); return;
      }
      
      const { error: insertError } = await supabase.from("cards").insert(cardsToInsert);
      if (insertError) throw insertError;

      setImportSuccess(true); setImportedCount(cardsToInsert.length);
      router.refresh();
      setTimeout(() => { onOpenChange(false); resetState(); }, 2000);
    } catch (error: any) {
      setError(error.message || "Error importing cards");
    } finally {
      setIsLoading(false);
    }
  }

  // ESTA ES LA LÍNEA QUE FALTABA:
  const columns = csvData && csvData.length > 0 ? csvData[0] : []

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) resetState(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import cards from CSV</DialogTitle>
          <DialogDescription>
            Upload a .csv file and select the columns for the card's front and back.
          </DialogDescription>
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
                <input id="csv-file-input" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                <Button type="button" variant="outline" onClick={() => document.getElementById("csv-file-input")?.click()} className="w-full">
                  <Upload className="mr-2 h-4 w-4" />
                  {file ? file.name : "Select .csv file"}
                </Button>
              </div>
              {csvData.length > 0 && columns.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="front-column">Front Column</Label>
                      <Select value={frontColumn} onValueChange={setFrontColumn}>
                        <SelectTrigger id="front-column"><SelectValue placeholder="Select a column" /></SelectTrigger>
                        <SelectContent>{columns.map((col, idx) => <SelectItem key={idx} value={idx.toString()}>Col {idx + 1}: {col || "(empty)"}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="back-column">Back Column</Label>
                      <Select value={backColumn} onValueChange={setBackColumn}>
                        <SelectTrigger id="back-column"><SelectValue placeholder="Select a column" /></SelectTrigger>
                        <SelectContent>{columns.map((col, idx) => <SelectItem key={idx} value={idx.toString()}>Col {idx + 1}: {col || "(empty)"}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
              <Button type="button" onClick={handleImport} disabled={isLoading || !csvData.length || frontColumn === "" || backColumn === ""}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? "Importing..." : `Import ${csvData.length > 0 ? csvData.length -1 : 0} Cards`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}