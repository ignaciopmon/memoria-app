// components/dashboard-client.tsx
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import { createClient } from "@/lib/supabase/client"
import { DeckCard } from "./deck-card"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Folder } from "lucide-react"

type Item = {
  id: string
  name: string
  description: string | null
  cardCount: number
  created_at: string
  is_folder: boolean
  parent_id: string | null
}

// Componente para una Carpeta (Zona donde soltar)
function FolderView({ folder, decks }: { folder: Item; decks: Item[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: folder.id })
  const style = {
    backgroundColor: isOver ? 'rgba(0, 128, 0, 0.1)' : undefined,
    border: isOver ? '2px dashed green' : '1px solid hsl(var(--border))',
  }

  return (
    <Card ref={setNodeRef} style={style} className="transition-all">
      <CardHeader className="flex-row items-center gap-4 space-y-0">
        <Folder className="h-6 w-6 text-muted-foreground" />
        <CardTitle>{folder.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {decks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Drop decks here</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map(deck => <DraggableDeckCard key={deck.id} deck={deck} />)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Componente para un Mazo (Elemento que se arrastra)
function DraggableDeckCard({ deck }: { deck: Item }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deck.id })
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 100, // Asegura que esté por encima mientras se arrastra
  } : undefined

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <DeckCard deck={deck} />
    </div>
  )
}

// Componente principal del Dashboard
export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems)
  const router = useRouter()

  const { folders, rootDecks } = useMemo(() => {
    const folders = items.filter(item => item.is_folder)
    const rootDecks = items.filter(item => !item.is_folder && !item.parent_id)
    return { folders, rootDecks }
  }, [items])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over, active } = event
    if (!over) return

    const deckId = active.id as string
    const folderId = over.id as string

    // Evita soltar sobre sí mismo o si no es un cambio
    if (deckId === folderId) return
    const currentDeck = items.find(item => item.id === deckId)
    if (currentDeck?.parent_id === folderId) return

    // Actualización optimista en la UI
    setItems(prevItems => prevItems.map(item => 
      item.id === deckId ? { ...item, parent_id: folderId } : item
    ))

    // Actualización en la base de datos
    const supabase = createClient()
    const { error } = await supabase
      .from("decks")
      .update({ parent_id: folderId })
      .eq("id", deckId)

    if (error) {
      alert("Failed to move deck.")
      // Revertir si hay error
      setItems(prevItems => prevItems.map(item =>
        item.id === deckId ? { ...item, parent_id: currentDeck?.parent_id || null } : item
      ))
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="space-y-8">
        {/* Renderizar Carpetas */}
        {folders.length > 0 && (
          <div className="space-y-4">
            {folders.map(folder => {
              const decksInFolder = items.filter(deck => deck.parent_id === folder.id)
              return <FolderView key={folder.id} folder={folder} decks={decksInFolder} />
            })}
          </div>
        )}

        {/* Renderizar Mazos en la raíz */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rootDecks.map(deck => <DraggableDeckCard key={deck.id} deck={deck} />)}
        </div>
      </div>
    </DndContext>
  )
}