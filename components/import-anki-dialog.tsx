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

interface TxtCard {
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
  const [previewCards, setPreviewCards] = useState<TxtCard[]>([])
  const router = useRouter()

  const parseTxtFile = (text: string): TxtCard[] => {
    const lines = text.split('\n');
    const cards: TxtCard[] = [];
    for (const line of lines) {
      // Anki usa un tabulador para separar el anverso del reverso
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const front = parts[0].trim();
        const back = parts[1].trim();
        if (front && back) {
          cards.push({ front, back });
        }
      }
    }
    return cards;
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const fileName = selectedFile.name.toLowerCase()
    if (!fileName.endsWith(".txt")) {
      setError("Por favor selecciona un archivo .txt válido")
      return
    }

    setFile(selectedFile)
    setError(null)
    setIsLoading(true)

    try {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const cards = parseTxtFile(text);
            if (cards.length === 0) {
                setError("No se encontraron tarjetas válidas. Asegúrate de que el formato sea 'Frente [tabulador] Reverso' en cada línea.");
            } else {
                setPreviewCards(cards);
                setError(null);
            }
            setIsLoading(false);
        };
        reader.onerror = () => {
            setError("Error al leer el archivo.");
            setIsLoading(false);
        };
        reader.readAsText(selectedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar el archivo")
      setPreviewCards([])
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
          Importar TXT
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar desde Anki (.txt)</DialogTitle>
          <DialogDescription>Sube un archivo .txt exportado desde Anki para importar tus tarjetas.</DialogDescription>
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
                    id="anki-txt-file"
                    type="file"
                    accept=".txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("anki-txt-file")?.click()}
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
                        {file ? file.name : "Seleccionar archivo .txt"}
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  El archivo debe ser de texto plano (.txt) con cada tarjeta en una línea, separando el frente y el reverso con un tabulador.
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