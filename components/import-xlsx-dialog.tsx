"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, CheckCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface ImportXLSXDialogProps {
  deckId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportXLSXDialog({ deckId, open, onOpenChange }: ImportXLSXDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [sheetData, setSheetData] = useState<string[][]>([])
  const [frontColumn, setFrontColumn] = useState<string>("")
  const [backColumn, setBackColumn] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const router = useRouter()

  const resetState = () => {
    setFile(null); setSheetData([]); setFrontColumn(""); setBackColumn("");
    setImportSuccess(false); setImportedCount(0); setError(null); setIsLoading(false);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    if (!selectedFile.name.endsWith(".xlsx")) {
      setError("Please select a valid .xlsx file"); return;
    }
    setFile(selectedFile); setError(null); setIsLoading(true);
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]
        const filteredData = jsonData.filter(row => row.some(cell => cell && cell.toString().trim() !== ''))
        if (filteredData.length === 0) {
          setError("The selected Excel sheet is empty or contains no data."); setIsLoading(false); return;
        }
        setSheetData(filteredData)
        if (filteredData.length > 0 && filteredData[0].length >= 2) {
          setFrontColumn("0"); setBackColumn("1");
        }
      } catch (err) {
        setError("Error processing the Excel file."); console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    reader.onerror = () => { setError("Error reading the file."); setIsLoading(false); }
    reader.readAsArrayBuffer(selectedFile);
  }

  const handleImport = async () => {
    if (!sheetData.length || frontColumn === "" || backColumn === "") {
      setError("Please select the columns for Front and Back"); return;
    }
    setIsLoading(true); setError(null);
    const supabase = createClient();
    try {
      const frontIdx = Number.parseInt(frontColumn);
      const backIdx = Number.parseInt(backColumn);
      const cardsToInsert = sheetData.slice(1).map((row) => ({
        deck_id: deckId, front: row[frontIdx] ? row[frontIdx].toString() : "", back: row[backIdx] ? row[backIdx].toString() : "",
        ease_factor: 2.5, interval: 0, repetitions: 0, next_review_date: new Date().toISOString(),
      })).filter(card => card.front.trim() && card.back.trim());

      if (validCards.length === 0) {
        setError("No valid cards found in the file."); setIsLoading(false); return;
      }
      
      const { error: insertError } = await supabase.from("cards").insert(validCards);
      if (insertError) throw insertError;
      
      setImportSuccess(true); setImportedCount(validCards.length);
      router.refresh();
      setTimeout(() => { onOpenChange(false); resetState(); }, 2000);
    } catch (error: any) {
      setError(error.message || "Error importing the cards");
    } finally {
      setIsLoading(false);
    }
  }

  const columns = sheetData.length > 0 ? sheetData[0] : []

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) resetState(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import cards from XLSX</DialogTitle>
          <DialogDescription>
            Upload an .xlsx file and select the columns for the card's front and back.
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
                <input id="xlsx-file-input" type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" />
                <Button type="button" variant="outline" onClick={() => document.getElementById("xlsx-file-input")?.click()} className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {file ? file.name : "Select .xlsx file"}
                </Button>
              </div>
              {sheetData.length > 0 && (
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
              <Button type="button" onClick={handleImport} disabled={isLoading || !sheetData.length || frontColumn === "" || backColumn === ""}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? "Importing..." : `Import ${sheetData.length > 0 ? sheetData.length -1 : 0} Cards`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}