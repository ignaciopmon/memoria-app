// components/trash-list.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, RotateCcw, Package, File, Loader2, AlertTriangle } from "lucide-react" // Añadido Loader2 y AlertTriangle
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Añadir imports para AlertDialog
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface DeletedItem {
  id: string
  deleted_at: string
}
interface DeletedDeck extends DeletedItem { name: string }
interface DeletedCard extends DeletedItem { front: string; deck: { name: string } | null }

export function TrashList({ initialDecks, initialCards }: { initialDecks: DeletedDeck[], initialCards: DeletedCard[] }) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  // --- NUEVO: Estado para saber qué pestaña está activa ---
  const [activeTab, setActiveTab] = useState<'decks' | 'cards'>('decks')
  // --- FIN NUEVO ---

  const handleRestore = async (type: 'decks' | 'cards', id: string) => {
    setIsProcessing(`restore-${id}`) // Identificador único para la acción
    const supabase = createClient()
    const { error } = await supabase.from(type).update({ deleted_at: null }).eq('id', id)
    if (error) alert(`Error restoring item: ${error.message}`)
    router.refresh()
    setIsProcessing(null)
  }

  const handlePermanentDelete = async (type: 'decks' | 'cards', id: string) => {
    if (!confirm("This action is permanent and cannot be undone. Are you sure?")) return
    setIsProcessing(`delete-${id}`) // Identificador único para la acción
    const supabase = createClient()
    const { error } = await supabase.from(type).delete().eq('id', id)
    if (error) alert(`Error permanently deleting item: ${error.message}`)
    router.refresh()
    setIsProcessing(null)
  }

  // --- NUEVO: Función para vaciar la papelera de la pestaña activa ---
  const handleEmptyTrash = async () => {
    const type = activeTab;
    const itemsToDelete = type === 'decks' ? initialDecks : initialCards;
    if (itemsToDelete.length === 0) return;

    setIsProcessing(`empty-${type}`) // Identificador único para la acción
    const supabase = createClient()
    const idsToDelete = itemsToDelete.map(item => item.id);

    try {
      const { error } = await supabase.from(type).delete().in('id', idsToDelete);
      if (error) throw error;
      router.refresh();
    } catch (error: any) {
      alert(`Error emptying trash: ${error.message}`);
    } finally {
      setIsProcessing(null);
    }
  }
  // --- FIN NUEVO ---

  const decksEmpty = initialDecks.length === 0;
  const cardsEmpty = initialCards.length === 0;

  return (
    <Tabs defaultValue="decks" onValueChange={(value) => setActiveTab(value as 'decks' | 'cards')}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <TabsList>
          <TabsTrigger value="decks">Decks ({initialDecks.length})</TabsTrigger>
          <TabsTrigger value="cards">Cards ({initialCards.length})</TabsTrigger>
        </TabsList>

        {/* --- NUEVO: Botón para vaciar papelera --- */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={
                (activeTab === 'decks' && decksEmpty) ||
                (activeTab === 'cards' && cardsEmpty) ||
                !!isProcessing // Deshabilitado si hay alguna operación en curso
              }
              className="w-full sm:w-auto" // Ancho completo en móvil
            >
              {isProcessing?.startsWith('empty-') ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
              )}
              Empty {activeTab === 'decks' ? `Decks` : `Cards`} Trash
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                 <AlertTriangle className="h-5 w-5 text-destructive" /> Are you absolutely sure?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action is permanent and cannot be undone. All{' '}
                {activeTab === 'decks' ? initialDecks.length : initialCards.length}{' '}
                deleted {activeTab} will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleEmptyTrash}
                className="bg-destructive hover:bg-destructive/90"
              >
                Yes, delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
         {/* --- FIN NUEVO --- */}
      </div>

      <TabsContent value="decks">
        {decksEmpty ? <p className="py-8 text-center text-muted-foreground">Trash is empty for decks.</p> :
          <div className="space-y-4 pt-4">
            {initialDecks.map(deck => (
              <Card key={deck.id}>
                <CardContent className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{deck.name}</p>
                      <p className="text-xs text-muted-foreground">Deleted on {new Date(deck.deleted_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button variant="ghost" size="sm" onClick={() => handleRestore('decks', deck.id)} disabled={!!isProcessing}>
                       {isProcessing === `restore-${deck.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4" />}
                       Restore
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handlePermanentDelete('decks', deck.id)} disabled={!!isProcessing}>
                       {isProcessing === `delete-${deck.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                       Delete Permanently
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      </TabsContent>

      <TabsContent value="cards">
        {cardsEmpty ? <p className="py-8 text-center text-muted-foreground">Trash is empty for cards.</p> :
          <div className="space-y-4 pt-4">
            {initialCards.map(card => (
              <Card key={card.id}>
                <CardContent className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <File className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="overflow-hidden">
                      <p className="font-medium truncate">{card.front}</p>
                      <p className="text-xs text-muted-foreground">From deck: <strong>{card.deck?.name || "Unknown"}</strong></p>
                       <p className="text-xs text-muted-foreground">Deleted on {new Date(card.deleted_at).toLocaleDateString()}</p> {/* Añadido fecha borrado tarjeta */}
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button variant="ghost" size="sm" onClick={() => handleRestore('cards', card.id)} disabled={!!isProcessing}>
                      {isProcessing === `restore-${card.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4" />}
                      Restore
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handlePermanentDelete('cards', card.id)} disabled={!!isProcessing}>
                      {isProcessing === `delete-${card.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                      Delete Permanently
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      </TabsContent>
    </Tabs>
  )
}