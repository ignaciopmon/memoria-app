// components/trash-list.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, RotateCcw, Package, File, AlertTriangle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface DeletedItem {
  id: string
  deleted_at: string
}
interface DeletedDeck extends DeletedItem { name: string }
interface DeletedCard extends DeletedItem { front: string; deck: { name: string } | null }

export function TrashList({ initialDecks, initialCards }: { initialDecks: DeletedDeck[], initialCards: DeletedCard[] }) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState<string | null>(null)

  const handleRestore = async (type: 'decks' | 'cards', id: string) => {
    setIsProcessing(id)
    const supabase = createClient()
    const { error } = await supabase.from(type).update({ deleted_at: null }).eq('id', id)
    if (error) alert(`Error restoring item: ${error.message}`)
    router.refresh()
    setIsProcessing(null)
  }

  const handlePermanentDelete = async (type: 'decks' | 'cards', id: string) => {
    if (!confirm("This action is permanent and cannot be undone. Are you sure?")) return
    setIsProcessing(id)
    const supabase = createClient()
    const { error } = await supabase.from(type).delete().eq('id', id)
    if (error) alert(`Error permanently deleting item: ${error.message}`)
    router.refresh()
    setIsProcessing(null)
  }

  return (
    <Tabs defaultValue="decks">
      <TabsList>
        <TabsTrigger value="decks">Decks ({initialDecks.length})</TabsTrigger>
        <TabsTrigger value="cards">Cards ({initialCards.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="decks">
        {initialDecks.length === 0 ? <p className="py-8 text-center text-muted-foreground">Trash is empty for decks.</p> :
          <div className="space-y-4 pt-4">
            {initialDecks.map(deck => (
              <Card key={deck.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{deck.name}</p>
                      <p className="text-xs text-muted-foreground">Deleted on {new Date(deck.deleted_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleRestore('decks', deck.id)} disabled={!!isProcessing}>
                      <RotateCcw className="mr-2 h-4 w-4" /> Restore
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handlePermanentDelete('decks', deck.id)} disabled={!!isProcessing}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      </TabsContent>

      <TabsContent value="cards">
        {initialCards.length === 0 ? <p className="py-8 text-center text-muted-foreground">Trash is empty for cards.</p> :
          <div className="space-y-4 pt-4">
            {initialCards.map(card => (
              <Card key={card.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <File className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium line-clamp-1">{card.front}</p>
                      <p className="text-xs text-muted-foreground">From deck: <strong>{card.deck?.name || "Unknown"}</strong></p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleRestore('cards', card.id)} disabled={!!isProcessing}>
                      <RotateCcw className="mr-2 h-4 w-4" /> Restore
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handlePermanentDelete('cards', card.id)} disabled={!!isProcessing}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
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