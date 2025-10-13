// components/dashboard-client.tsx
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DndContext, useDraggable, useDroppable, DragOverlay } from "@dnd-kit/core"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { createClient } from "@/lib/supabase/client"
import { DeckCard } from "./deck-card"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Folder, GripVertical } from "lucide-react"
import { DeleteFolderDialog } from "./delete-folder-dialog"

type Item = {
  id: string
  name: string
  description: string | null
  cardCount: number
  created_at: string
  is_folder: boolean
  parent_id: string | null
}

// Componente para una Carpeta
function FolderView({ folder, decks, isEditMode, onDelete }: { folder: Item; decks: Item[], isEditMode: boolean, onDelete: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: folder.id, disabled: !isEditMode })

  const style = {
    backgroundColor: isOver && isEditMode ? 'hsl(var(--primary) / 0.1)' : undefined,
    borderColor: isOver && isEditMode ? 'hsl(var(--primary))' : undefined
  }

  return (
    <Card ref={setNodeRef} style={style} className="transition-colors border-2 border-dashed">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-4">
            <Folder className="h-6 w-6 text-muted-foreground" />
            <CardTitle>{folder.name}</CardTitle>
        </div>
        {isEditMode && <DeleteFolderDialog folder={folder} decksInFolder={decks} onDelete={onDelete} />}
      </CardHeader>
      <CardContent>
        {decks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Drop decks here in Edit Mode</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map(deck => <DraggableDeckCard key={deck.id} deck={deck} isEditMode={isEditMode} />)}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente para un Mazo Arrastrable
function DraggableDeckCard({ deck, isEditMode }: { deck: Item, isEditMode: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deck.id, disabled: !isEditMode })

  return (
    <div ref={setNodeRef} className="relative">
      {isEditMode && (
        <div {...listeners} {...attributes} className="absolute top-2 right-10 z-10 cursor-grab p-2">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <DeckCard deck={deck} />
    </div>
  )
}

// Componente principal del Dashboard
export function DashboardClient({ initialItems, isEditMode }: { initialItems: Item[], isEditMode: boolean }) {
  const [items, setItems] = useState(initialItems)
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null)

  const { folders, rootDecks } = useMemo(() => {
    const folders = items.filter(item => item.is_folder)
    const rootDecks = items.filter(item => !item.is_folder && !item.parent_id)
    return { folders, rootDecks }
  }, [items])

  const handleDragStart = (event: DragStartEvent) => {
    const item = items.find(i => i.id === event.active.id)
    if (item) setActiveDragItem(item)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragItem(null)
    const { over, active } = event

    const deckId = active.id as string
    const targetId = over ? over.id as string : null

    const currentDeck = items.find(item => item.id === deckId)
    if (!currentDeck) return

    // Determina el nuevo parent_id. Si no se suelta sobre una carpeta, es null (raíz)
    const newParentId = (over && folders.some(f => f.id === targetId)) ? targetId : null

    if (currentDeck.parent_id === newParentId) return // No change

    setItems(prevItems => prevItems.map(item => 
      item.id === deckId ? { ...item, parent_id: newParentId } : item
    ))

    const supabase = createClient()
    const { error } = await supabase
      .from("decks")
      .update({ parent_id: newParentId })
      .eq("id", deckId)

    if (error) {
      alert("Failed to move deck.")
      setItems(initialItems) // Revert on error
    }
  }

  // Callback para actualizar la UI después de borrar una carpeta
  const handleFolderDeleted = () => {
      // Re-fetches data indirectly by refreshing the page
      window.location.reload();
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-8">
        {folders.map(folder => {
          const decksInFolder = items.filter(deck => deck.parent_id === folder.id)
          return <FolderView key={folder.id} folder={folder} decks={decksInFolder} isEditMode={isEditMode} onDelete={handleFolderDeleted} />
        })}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rootDecks.map(deck => <DraggableDeckCard key={deck.id} deck={deck} isEditMode={isEditMode} />)}
        </div>
      </div>

      <DragOverlay>
        {activeDragItem ? <DeckCard deck={activeDragItem} /> : null}
      </DragOverlay>
    </DndContext>
  )
}