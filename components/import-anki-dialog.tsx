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
import { FileUp, Upload, CheckCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface ImportAnkiDialogProps {
  deckId: string
}

interface AnkiCard {
  front: string
  back: string
}

export function ImportAnkiDialog({ deckId }: ImportAnkiDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [previewCards, setPreviewCards] = useState<AnkiCard[]>([])
  const router = useRouter()

  const stripHtml = (html: string): string => {
    // Remove HTML tags and decode entities
    const tmp = document.createElement("DIV")
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ""
  }

  const parseAnkiFile = async (file: File): Promise<AnkiCard[]> => {
    try {
      // Dynamically import JSZip and sql.js
      const JSZip = (await import("jszip")).default
      const initSqlJs = (await import("sql.js")).default

      // Unzip the file
      const zip = await JSZip.loadAsync(file)

      // Find the database file (can be collection.anki2, collection.anki21, or collection.anki21b)
      const dbFile = zip.file("collection.anki2") || zip.file("collection.anki21") || zip.file("collection.anki21b")

      if (!dbFile) {
        throw new Error("No se encontró la base de datos de Anki en el archivo")
      }

      // Get the database as array buffer
      const dbData = await dbFile.async("uint8array")

      // Initialize SQL.js
      const SQL = await initSqlJs({
        locateFile: (file) => `https://sql.js.org/dist/${file}`,
      })

      // Open the database
      const db = new SQL.Database(dbData)

      // Query notes and cards
      // Anki schema: notes table has id, flds (fields separated by \x1f)
      const result = db.exec(`
        SELECT notes.flds 
        FROM notes
        INNER JOIN cards ON notes.id = cards.nid
        LIMIT 1000
      `)

      if (!result.length || !result[0].values.length) {
        throw new Error("No se encontraron tarjetas en el archivo de Anki")
      }

      // Parse the fields
      const cards: AnkiCard[] = []
      for (const row of result[0].values) {
        const fields = (row[0] as string).split("\x1f")

        if (fields.length >= 2) {
          cards.push({
            front: stripHtml(fields[0]),
            back: stripHtml(fields[1]),
          })
        } else if (fields.length === 1) {
          // Single field card - use it for both front and back
          cards.push({
            front: stripHtml(fields[0]),
            back: stripHtml(fields[0]),
          })
        }
      }

      db.close()
      return cards
    } catch (err) {
      console.error("[v0] Error parsing Anki file:", err)
      throw new Error(
        "Error al procesar el archivo de Anki: " + (err instanceof Error ? err.message : "Error desconocido"),
      )
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const fileName = selectedFile.name.toLowerCase()
    if (!fileName.endsWith(".apkg") && !fileName.endsWith(".colpkg")) {
      setError("Por favor selecciona un archivo .apkg o .colpkg válido")
      return
    }

    setFile(selectedFile)
    setError(null)
    setIsLoading(true)

    try {
      const cards = await parseAnkiFile(selectedFile)
      setPreviewCards(cards)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar el archivo")
      setPreviewCards([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    if (!previewCards.length) {
      setError("No hay tarjetas para importar")
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      const cardsToInsert = previewCards.map((card) => ({
        deck_id: deckId,
        front: card.front,
        back: card.back,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString(),
      }))

      const { error: insertError } = await supabase.from("cards").insert(cardsToInsert)

      if (insertError) throw insertError

      setImportSuccess(true)
      setImportedCount(cardsToInsert.length)
      router.refresh()

      setTimeout(() => {
        setOpen(false)
        setFile(null)
        setPreviewCards([])
        setImportSuccess(false)
        setImportedCount(0)
      }, 2000)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error al importar las tarjetas")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp className="mr-2 h-4 w-4" />
          Importar Anki
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar desde Anki</DialogTitle>
          <DialogDescription>Sube un archivo .apkg o .colpkg de Anki para importar tus tarjetas</DialogDescription>
        </DialogHeader>

        {importSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold">¡Importación exitosa!</h3>
            <p className="text-muted-foreground">
              Se importaron {importedCount} tarjeta{importedCount !== 1 ? "s" : ""}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <input
                    id="anki-file"
                    type="file"
                    accept=".apkg,.colpkg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("anki-file")?.click()}
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {file ? file.name : "Seleccionar archivo .apkg o .colpkg"}
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Soporta archivos .apkg (mazos individuales) y .colpkg (colecciones completas)
                </p>
              </div>

              {previewCards.length > 0 && (
                <div className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">
                    Vista previa ({previewCards.length} tarjeta{previewCards.length !== 1 ? "s" : ""})
                  </p>
                  <div className="space-y-2 text-sm">
                    {previewCards.slice(0, 3).map((card, idx) => (
                      <div key={idx} className="rounded-sm bg-muted p-2">
                        <p className="text-xs text-muted-foreground">Frente:</p>
                        <p className="mb-1 line-clamp-2">{card.front}</p>
                        <p className="text-xs text-muted-foreground">Reverso:</p>
                        <p className="line-clamp-2">{card.back}</p>
                      </div>
                    ))}
                    {previewCards.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        ... y {previewCards.length - 3} tarjeta{previewCards.length - 3 !== 1 ? "s" : ""} más
                      </p>
                    )}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleImport} disabled={isLoading || !previewCards.length}>
                {isLoading ? "Importando..." : "Importar Tarjetas"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
