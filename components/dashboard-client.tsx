// components/dashboard-client.tsx
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DndContext, useDraggable, useDroppable, DragOverlay } from "@dnd-kit/core"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { DeckCard } from "./deck-card"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Folder, GripVertical, Trash2, Edit, Paintbrush, ChevronDown, ChevronRight } from "lucide-react"
import { DeleteFolderDialog } from "./delete-folder-dialog"
import { RenameDialog } from "./rename-dialog"
import { ColorPopover } from "./color-popover"

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
function FolderView({ folder, decks, isEditMode, onUpdate }: { folder: Item; decks: Item[], isEditMode: boolean, onUpdate: (items: Item[]) => void }) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const { isOver, setNodeRef } = useDroppable({ id: folder.id, disabled: !isEditMode })
  
  const folderColor = folder.color || 'hsl(var(--border))'

  // Si no estamos en modo edición y la carpeta está vacía, no la mostramos.
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
                  <ColorPopover folderId={folder.id} currentColor={folder.color} />
                  <DeleteFolderDialog folder={folder} decksInFolder={decks} onDelete={() => onUpdate([])} />
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
function DraggableItem({ item, isEditMode, onUpdate }: { item: Item, isEditMode: boolean, onUpdate: (items: Item[]) => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: item.id, disabled: !isEditMode })
  const { toast } = useToast()
  const [isRenaming, setIsRenaming] = useState(false)

  const handleDelete = async () => {
    const supabase = createClient()
    const { error } = await supabase.from("decks").update({ deleted_at: new Date().toISOString() }).eq("id", item.id)
    if (error) {
      alert("Error sending deck to trash.")
    } else {
      // Actualización en tiempo real
      onUpdate(prevItems => prevItems.filter(i => i.id !== item.id))
    }
  }

  return (
    <div ref={setNodeRef} className="relative group">
      {isRenaming && <RenameDialog item={item} isOpen={isRenaming} onClose={() => setIsRenaming(false)} />}
      {isEditMode && (
        // Contenedor de acciones de edición
        <div className="absolute top-2 right-2 z-20 flex items-center bg-background/80 backdrop-blur-sm rounded-full border p-0.5 gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsRenaming(true)} title="Rename"><Edit className="h-4 w-4" /></Button>
          
          <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Change color"><Paintbrush className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
                <p className="text-sm">Deck colors coming soon!</p>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={handleDelete} title="Delete"><Trash2 className="h-4 w-4" /></Button>
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
export function DashboardClient({ initialItems, isEditMode }: { initialItems: Item[], isEditMode: boolean }) {
  const [items, setItems] = useState(initialItems)
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null)
  const router = useRouter()

  const { folders, rootDecks } = useMemo(() => {
    const folders = items.filter(item => item.is_folder).sort((a,b) => a.name.localeCompare(b.name));
    const rootDecks = items.filter(item => !item.is_folder && !item.parent_id);
    return { folders, rootDecks }
  }, [items])
  
  const handleDragStart = (event: DragStartEvent) => {
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

    // Actualización optimista en la UI para el cambio de posición
    const optimisticItems = items.map(item => 
      item.id === deckId ? { ...item, parent_id: newParentId } : item
    )
    setItems(optimisticItems)

    const supabase = createClient()
    const { error } = await supabase.from("decks").update({ parent_id: newParentId }).eq("id", deckId)
    if (error) {
      alert("Failed to move deck.")
      setItems(initialItems) // Revertimos en caso de error
    } else {
        // En lugar de recargar, solo confirmamos el estado
        setItems(optimisticItems)
    }
  }
  
  // Callback para manejar cualquier actualización de la lista de items
  const handleUpdateItems = (updater: (prevItems: Item[]) => Item[]) => {
      setItems(updater);
      // Forzamos un refresh de los datos del servidor para sincronizar,
      // pero la UI ya se ha actualizado.
      router.refresh();
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-8">
        {folders.map(folder => {
          const decksInFolder = items.filter(deck => deck.parent_id === folder.id)
          return <FolderView key