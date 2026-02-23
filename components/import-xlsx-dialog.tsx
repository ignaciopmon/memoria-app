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
    reader.onload = async (event) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        // Asegurarse de que header: 1 convierte todo a string[][]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as string[][]
        // Filtrar filas completamente vacías o con solo espacios
        const filteredData = jsonData.filter(row => row && row.some(cell => cell && cell.toString().trim() !== ''))

        if (filteredData.length === 0 || filteredData.every(row => row.every(cell => !cell || cell.toString().trim() === ''))) {
           setError("The selected Excel sheet appears empty or contains no processable data.");
           setIsLoading(false);
           setSheetData([]); // Limpiar datos si no son válidos
           return;
        }

        setSheetData(filteredData)
        // Auto-seleccionar columnas si hay datos y al menos 2 columnas
        if (filteredData.length > 0 && filteredData[0] && filteredData[0].length >= 2) {
          setFrontColumn("0"); setBackColumn("1");
        } else if (filteredData.length > 0 && filteredData[0] && filteredData[0].length === 1) {
          // Si solo hay una columna, seleccionar la primera para ambos por defecto
          setFrontColumn("0"); setBackColumn("0");
          setError("Only one column detected. Please verify Front and Back column selections."); // Añadir aviso
        } else {
             // Resetear columnas si no hay suficientes
             setFrontColumn(""); setBackColumn("");
        }

      } catch (err) {
        setError("Error processing the Excel file. Ensure it's a valid .xlsx format."); console.error(err);
        setSheetData([]); // Limpiar datos en caso de error
      } finally {
        setIsLoading(false);
      }
    }
    reader.onerror = () => { setError("Error reading the file."); setIsLoading(false); }
    reader.readAsArrayBuffer(selectedFile);
  }

  const handleImport = async () => {
    // Verificar que sheetData tenga al menos la fila de cabecera y una fila de datos
    if (!sheetData || sheetData.length < 2 || frontColumn === "" || backColumn === "") {
       setError("Please select a file with data and the columns for Front and Back.");
       return;
    }
    setIsLoading(true); setError(null);
    const supabase = createClient();
    try {
      const frontIdx = Number.parseInt(frontColumn);
      const backIdx = Number.parseInt(backColumn);

       // Validar índices contra la longitud de la cabecera (primera fila)
       const headerLength = sheetData[0]?.length ?? 0;
       if (frontIdx < 0 || frontIdx >= headerLength || backIdx < 0 || backIdx >= headerLength) {
           setError("Selected column index is out of bounds for the detected data.");
           setIsLoading(false);
           return;
       }


      // --- CORRECCIÓN AQUÍ ---
      // Procesar filas a partir de la segunda (índice 1)
      const cardsToInsert = sheetData.slice(1).map((row) => {
          // Asegurarse de que row existe y tiene suficientes elementos
          const frontValue = row && row[frontIdx] ? row[frontIdx].toString() : "";
          const backValue = row && row[backIdx] ? row[backIdx].toString() : "";
          return {
            deck_id: deckId,
            front: frontValue,
            back: backValue,
            ease_factor: 2.5,
            interval: 0,
            repetitions: 0,
            next_review_date: new Date().toISOString(),
          };
      }).filter(card => card.front.trim() && card.back.trim()); // Filtrar tarjetas vacías

      // --- CORRECCIÓN AQUÍ ---
      // Usar cardsToInsert en lugar de validCards
      if (cardsToInsert.length === 0) {
        setError("No valid cards found in the file after filtering. Check column selection and data.");
        setIsLoading(false);
        return;
      }

      // --- CORRECCIÓN AQUÍ ---
      // Usar cardsToInsert en lugar de validCards
      const { error: insertError } = await supabase.from("cards").insert(cardsToInsert);
      if (insertError) throw insertError;

      // --- CORRECCIÓN AQUÍ ---
      // Usar cardsToInsert en lugar de validCards
      setImportSuccess(true); setImportedCount(cardsToInsert.length);
      router.refresh();
      setTimeout(() => { onOpenChange(false); resetState(); }, 2000);
    } catch (error: any) {
      setError(error.message || "Error importing the cards");
      console.error("Import error details:", error); // Log detallado del error
    } finally {
      setIsLoading(false);
    }
  }

  // Extraer columnas de la primera fila si existe
  const columns = sheetData && sheetData.length > 0 && sheetData[0] ? sheetData[0] : []

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) resetState(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import cards from XLSX</DialogTitle>
          <DialogDescription>
            Upload an .xlsx file and select the columns for the card's front and back. The first row should be headers.
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
                <input id="xlsx-file-input" type="file" accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} className="hidden" />
                <Button type="button" variant="outline" onClick={() => document.getElementById("xlsx-file-input")?.click()} className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {file ? file.name : "Select .xlsx file"}
                </Button>
              </div>
              {/* Solo mostrar selectores si hay datos y columnas */}
              {sheetData.length > 0 && columns.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="front-column">Front Column</Label>
                      <Select value={frontColumn} onValueChange={setFrontColumn} disabled={isLoading}>
                        <SelectTrigger id="front-column"><SelectValue placeholder="Select a column" /></SelectTrigger>
                        <SelectContent>
                          {/* Mostrar índice + valor (o placeholder si está vacío) */}
                          {columns.map((col, idx) => (
                            <SelectItem key={`front-${idx}`} value={idx.toString()}>
                              Col {idx + 1}: {col?.toString().trim() || "(empty header)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="back-column">Back Column</Label>
                      <Select value={backColumn} onValueChange={setBackColumn} disabled={isLoading}>
                        <SelectTrigger id="back-column"><SelectValue placeholder="Select a column" /></SelectTrigger>
                        <SelectContent>
                          {columns.map((col, idx) => (
                            <SelectItem key={`back-${idx}`} value={idx.toString()}>
                              Col {idx + 1}: {col?.toString().trim() || "(empty header)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                   {/* Mostrar una vista previa de los datos si es posible */}
                   {sheetData.length > 1 && (
                     <div className="mt-2 text-xs text-muted-foreground">
                       Preview (first data row):{' '}
                       <strong>Front:</strong> "{sheetData[1]?.[parseInt(frontColumn, 10)] || 'N/A'}",{' '}
                       <strong>Back:</strong> "{sheetData[1]?.[parseInt(backColumn, 10)] || 'N/A'}"
                     </div>
                   )}
                </>
              )}
               {/* Mostrar el botón de importar solo si hay datos válidos */}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
               {/* Deshabilitar si no hay datos suficientes o no se seleccionaron columnas */}
              <Button
                type="button"
                onClick={handleImport}
                disabled={isLoading || sheetData.length < 2 || frontColumn === "" || backColumn === ""}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? "Importing..." : `Import ${Math.max(0, sheetData.length - 1)} Cards`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}