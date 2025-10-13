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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUp, Upload, CheckCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface ImportCSVDialogProps {
  deckId: string
}

export function ImportCSVDialog({ deckId }: ImportCSVDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<string[][]>([])
  const [frontColumn, setFrontColumn] = useState<string>("")
  const [backColumn, setBackColumn] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please select a valid CSV file")
      return
    }

    setFile(selectedFile)
    setError(null)

    // Parse CSV
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const rows = text.split("\n").map((row) => row.split(",").map((cell) => cell.trim()))

      // Filter out empty rows
      const filteredRows = rows.filter((row) => row.some((cell) => cell.length > 0))

      setCsvData(filteredRows)

      // Auto-select first two columns if available
      if (filteredRows.length > 0 && filteredRows[0].length >= 2) {
        setFrontColumn("0")
        setBackColumn("1")
      }
    }
    reader.readAsText(selectedFile)
  }

  const handleImport = async () => {
    if (!csvData.length || frontColumn === "" || backColumn === "") {
      setError("Please select columns for front and back")
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      const frontIdx = Number.parseInt(frontColumn)
      const backIdx = Number.parseInt(backColumn)

      // Skip header row and prepare cards
      const cardsToInsert = csvData.slice(1).map((row) => ({
        deck_id: deckId,
        front: row[frontIdx] || "",
        back: row[backIdx] || "",
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString(),
      }))

      // Filter out empty cards
      const validCards = cardsToInsert.filter((card) => card.front.trim() && card.back.trim())

      if (validCards.length === 0) {
        setError("No valid cards found in the CSV file")
        setIsLoading(false)
        return
      }

      const { error: insertError } = await supabase.from("cards").insert(validCards)

      if (insertError) throw insertError

      setImportSuccess(true)
      setImportedCount(validCards.length)
      router.refresh()

      // Reset after 2 seconds
      setTimeout(() => {
        setOpen(false)
        setFile(null)
        setCsvData([])
        setFrontColumn("")
        setBackColumn("")
        setImportSuccess(false)
        setImportedCount(0)
      }, 2000)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error importing cards")
    } finally {
      setIsLoading(false)
    }
  }

  const columns = csvData.length > 0 ? csvData[0] : []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import cards from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file and select the columns for the front and back of the cards
          </DialogDescription>
        </DialogHeader>

        {importSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold">Import successful!</h3>
            <p className="text-muted-foreground">
              Imported {importedCount} card{importedCount !== 1 ? "s" : ""}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="csv-file">CSV File</Label>
                <div className="flex items-center gap-2">
                  <input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("csv-file")?.click()}
                    className="w-full"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {file ? file.name : "Select CSV file"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The file must have at least two columns: one for the front and one for the back
                </p>
              </div>

              {csvData.length > 0 && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="front-column">Column for Front</Label>
                    <Select value={frontColumn} onValueChange={setFrontColumn}>
                      <SelectTrigger id="front-column">
                        <SelectValue placeholder="Select a column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            Column {idx + 1}: {col || "(empty)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="back-column">Column for Back</Label>
                    <Select value={backColumn} onValueChange={setBackColumn}>
                      <SelectTrigger id="back-column">
                        <SelectValue placeholder="Select a column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            Column {idx + 1}: {col || "(empty)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-md border p-3">
                    <p className="mb-2 text-sm font-medium">Preview</p>
                    <div className="space-y-2 text-sm">
                      {csvData.slice(1, 4).map((row, idx) => (
                        <div key={idx} className="rounded-sm bg-muted p-2">
                          <p className="text-xs text-muted-foreground">Front:</p>
                          <p className="mb-1">{row[Number.parseInt(frontColumn)] || "(empty)"}</p>
                          <p className="text-xs text-muted-foreground">Back:</p>
                          <p>{row[Number.parseInt(backColumn)] || "(empty)"}</p>
                        </div>
                      ))}
                      {csvData.length > 4 && (
                        <p className="text-xs text-muted-foreground">
                          ... and {csvData.length - 4} more card{csvData.length - 4 !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={isLoading || !csvData.length || frontColumn === "" || backColumn === ""}
              >
                {isLoading ? "Importing..." : "Import Cards"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}