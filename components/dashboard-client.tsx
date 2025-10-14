// components/dashboard-client.tsx
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DndContext, useDraggable, useDroppable, DragOverlay } from "@dnd-kit/core"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { DeckCard } from "./deck-card"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Folder, GripVertical, Trash2, Edit, Paintbrush, ChevronDown, ChevronRight, Loader2, BookOpen } from "lucide-react"
import { DeleteFolderDialog } from "./delete-folder-dialog"
import { RenameDialog } from "./rename-dialog"
import { ColorPopover } from "./color-popover"
import { CreateDeckDialog } from "./create-deck-dialog"
import { CreateFolderDialog } from "./create-folder-dialog"

type Item = {
  id: string
  name: string
  description: string | null
  cardCount: number
  is_folder: boolean
  parent_id: string | null
  color: string | null
}

// ---- Componente para una Carpeta ----
function FolderView({ folder, decks, isEditMode, onUpdate }: { folder: Item; decks: Item[], isEditMode: boolean, onUpdate: (updater: (prev: Item[]) => Item[]) => void }) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const { isOver, setNodeRef } = useDroppable({ id: folder.id, disabled: !isEditMode })
  
  const folderColor = folder.color || 'hsl(var(--border))'

  if (!isEditMode && decks.length === 0) return null

  return (
    <>
      {isRenaming && <RenameDialog item={folder} isOpen={isRenaming} onClose={() => setIsRenaming(false)} />}
      <Card 
        ref={setNodeRef} 
        style={{ borderColor: isOver && isEditMode ? 'hsl(var(--primary))' : folderColor }} 
        className="transition-colors border-2"
      >
        <CardHeader 
          className="flex-row items-center justify-between space-y-0 p-4 cursor-pointer"
          onClick={() => !isEditMode && setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-4">
              <Folder className="h-6 w-6" style={{ color: folder.color || 'hsl(var(--muted-foreground))' }} />
              <CardTitle>{folder.name}</CardTitle>
          </div>
          
          {isEditMode ? (
              <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}><Edit className="h-4 w-4" /></Button>
                  <ColorPopover
                    itemId={folder.id}
                    currentColor={folder.color}
                    onColorChange={(color) => {
                      onUpdate(prev => prev.map(it => it.id === folder.id ? { ...it, color } : it));
                    }}
                  />
                  <DeleteFolderDialog folder={folder} decksInFolder={decks} onDelete={(deletedIds) => {
                      onUpdate(prev => prev.filter(it => !deletedIds.includes(it.id)))
                  }} />
              </div>
          ) : (
              <Button variant="ghost" size="icon">
                  {isExpanded ? <ChevronDown /> : <ChevronRight />}
              </Button>
          )}
        </CardHeader>

        {(isEditMode || isExpanded) && (
          <CardContent className="p-4 pt-0">
              {decks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {isEditMode ? "Drop decks here" : "This folder is empty"}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {decks.map(deck => <DraggableItem key={deck.id} item={deck} isEditMode={isEditMode} onUpdate={onUpdate} />)}
                </div>
              )}
          </CardContent>
        )}
      </Card>
    </>
  )
}

// ---- Componente para un Mazo Arrastrable ----
function DraggableItem({ item, isEditMode, onUpdate }: { item: Item, isEditMode: boolean, onUpdate: (updater: (prev: Item[]) => Item[]) => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: item.id, disabled: !isEditMode })
  const { toast } = useToast()
  const [isRenaming, setIsRenaming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from("decks").update({ deleted_at: new Date().toISOString() }).eq("id", item.id)
    setIsDeleting(false)
    if (error) {
      alert("Error sending deck to trash.")
    } else {
      onUpdate(prevItems => prevItems.filter(i => i.id !== item.id))
    }
  }

  return (
    <div ref={setNodeRef} className="relative group">
      {isRenaming && <RenameDialog item={item} isOpen={isRenaming} onClose={() => setIsRenaming(false)} />}
      {isEditMode && (
        <div className="absolute top-2 right-2 z-20 flex items-center bg-background/80 backdrop-blur-sm rounded-full border p-0.5 gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsRenaming(true)} title="Rename"><Edit className="h-4 w-4" /></Button>
          
          <ColorPopover
            itemId={item.id}
            currentColor={item.color}
            onColorChange={(color) => {
              onUpdate(prev => prev.map(it => it.id === item.id ? { ...it, color } : it));
            }}
          />

          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={handleDelete} title="Delete" disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
          <div {...listeners} {...attributes} className="cursor-grab p-1" title="Move deck">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      )}
      <DeckCard deck={item} isEditMode={isEditMode} />
    </div>
  )
}

// ---- Componente Principal del Dashboard ----
export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems)
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const { folders, rootDecks } = useMemo(() => {
    const folders = items.filter(item => item.is_folder).sort((a,b) => a.name.localeCompare(b.name));
    const rootDecks = items.filter(item => !item.is_folder && !item.parent_id);
    return { folders, rootDecks }
  }, [items])
  
  const handleDragStart = (event: DragStartEvent) => {
    if (!isEditMode) return
    const item = items.find(i => i.id === event.active.id)
    if (item && !item.is_folder) setActiveDragItem(item)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragItem(null)
    const { over, active } = event
    
    const deckId = active.id as string
    const currentDeck = items.find(item => item.id === deckId)
    if (!currentDeck || currentDeck.is_folder) return
    
    const targetId = over ? over.id as string : null
    const isTargetFolder = over && folders.some(f => f.id === targetId)
    const newParentId = isTargetFolder ? targetId : null

    if (currentDeck.parent_id === newParentId) return

    const optimisticItems = items.map(item => 
      item.id === deckId ? { ...item, parent_id: newParentId } : item
    )
    setItems(optimisticItems)

    const supabase = createClient()
    const { error } = await supabase.from("decks").update({ parent_id: newParentId }).eq("id", deckId)
    if (error) {
      alert("Failed to move deck.")
      setItems(initialItems)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <BookOpen className="mb-4 h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">Your dashboard is empty</h2>
        <p className="mb-6 text-muted-foreground">Create your first deck to get started.</p>
        <CreateDeckDialog onDeckCreated={() => router.refresh()} size="lg" />
      </div>
    )
  }
  
  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Decks</h1>
          <p className="text-muted-foreground">Manage your study flashcard decks</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant={isEditMode ? "default" : "outline"} onClick={() => setIsEditMode(prev => !prev)}>
                <Edit className="mr-2 h-4 w-4" />
                {isEditMode ? "Done" : "Edit"}
            </Button>
            {isEditMode && <CreateFolderDialog onFolderCreated={() => router.refresh()} />}
            <CreateDeckDialog onDeckCreated={() => router.refresh()} />
        </div>
      </div>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-8">
          {folders.map(folder => {
            const decksInFolder = items.filter(deck => deck.parent_id === folder.id)
            return <FolderView key={folder.id} folder={folder} decks={decksInFolder} isEditMode={isEditMode} onUpdate={setItems} />
          })}
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rootDecks.map(deck => <DraggableItem key={deck.id} item={deck} isEditMode={isEditMode} onUpdate={setItems} />)}
          </div>
        </div>
        
        <DragOverlay>
          {activeDragItem ? <DeckCard deck={activeDragItem} isEditMode /> : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}