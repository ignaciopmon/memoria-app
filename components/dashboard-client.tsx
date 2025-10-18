// components/dashboard-client.tsx
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  DndContext, 
  useDraggable, // Keep useDraggable for the overlay if needed, or remove if useSortable suffices
  useDroppable, 
  DragOverlay, 
  closestCenter, // Use closestCenter for better sorting collision detection
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core"
import { 
  SortableContext, 
  useSortable, 
  arrayMove, 
  rectSortingStrategy // Strategy for grid layout
} from "@dnd-kit/sortable";
import { CSS } from '@dnd-kit/utilities'; // Helper for styles
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
import { CreateAIDeckDialog } from "./create-ai-deck-dialog"

type Item = {
  id: string
  name: string
  description: string | null
  cardCount: number
  is_folder: boolean
  parent_id: string | null
  color: string | null
  position: number | null // <-- AÑADIR POSICIÓN
}

// ---- Componente para una Carpeta ----
function FolderView({ folder, decks, isEditMode, onUpdate }: { folder: Item; decks: Item[], isEditMode: boolean, onUpdate: (updater: (prev: Item[]) => Item[]) => void }) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({ id: folder.id, disabled: !isEditMode })

  const folderColor = folder.color || 'hsl(var(--border))'

  // Usamos setDroppableNodeRef aquí para la carpeta como zona de destino
  const setNodeRef = useMemo(() => setDroppableNodeRef, [setDroppableNodeRef]);


  if (!isEditMode && decks.length === 0) return null

  return (
    <>
      {isRenaming && <RenameDialog item={folder} isOpen={isRenaming} onClose={() => setIsRenaming(false)} />}
      <Card
        ref={setNodeRef} // <-- Ref para droppable
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
                  {/* Los items dentro de la carpeta no necesitan ser SortableContext por ahora */}
                  {decks.map(deck => <DraggableDeckItem key={deck.id} item={deck} isEditMode={isEditMode} onUpdate={onUpdate} />)}
                </div>
              )}
          </CardContent>
        )}
      </Card>
    </>
  )
}

// ---- Componente para un Mazo Arrastrable y Ordenable ----
function DraggableDeckItem({ item, isEditMode, onUpdate }: { item: Item, isEditMode: boolean, onUpdate: (updater: (prev: Item[]) => Item[]) => void }) {
  // Usamos useSortable en lugar de useDraggable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging // <-- useSortable también provee isDragging
  } = useSortable({ id: item.id, disabled: !isEditMode });

  const { toast } = useToast()
  const [isRenaming, setIsRenaming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1, // Atenuar mientras se arrastra
    zIndex: isDragging ? 10 : undefined, // Poner encima mientras se arrastra
  };

  const handleDelete = async () => {
    setIsDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from("decks").update({ deleted_at: new Date().toISOString() }).eq("id", item.id)
    setIsDeleting(false)
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Error sending deck to trash." });
    } else {
      onUpdate(prevItems => prevItems.filter(i => i.id !== item.id))
      toast({ title: "Success", description: "Deck moved to trash." });
    }
  }

  return (
    // Aplicamos ref y style de useSortable al div contenedor
    <div ref={setNodeRef} style={style} className="relative group touch-manipulation"> 
      {isRenaming && <RenameDialog item={item} isOpen={isRenaming} onClose={() => setIsRenaming(false)} />}
      {isEditMode && (
        <div className="absolute top-2 right-2 z-20 flex items-center bg-background/80 backdrop-blur-sm rounded-full border p-0.5 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
          {/* El handle de arrastre viene de useSortable */}
          <div {...listeners} {...attributes} className="cursor-grab p-1 touch-none" title="Move deck">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      )}
      {/* Pasamos isDragging para posible lógica interna en DeckCard si fuera necesario */}
      <DeckCard deck={item} isEditMode={isEditMode}/>
    </div>
  )
}

// ---- Componente Principal del Dashboard ----
export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems); // Asegurar tipo
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const router = useRouter()
  const { toast } = useToast();

  // Sensores para DndContext (recomendado para mejor compatibilidad táctil)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Mover 8px antes de iniciar arrastre
      },
    })
  );

  // Sincronizar estado si las props cambian
  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const { folders, rootDecks } = useMemo(() => {
    // Aseguramos que estén ordenados por 'position' para SortableContext
    const sortedItems = [...items].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
    const folders = sortedItems.filter(item => item.is_folder);
    const rootDecks = sortedItems.filter(item => !item.is_folder && !item.parent_id);
    return { folders, rootDecks }
  }, [items])

  const handleDragStart = (event: DragStartEvent) => {
    if (!isEditMode) return
    const item = items.find(i => i.id === event.active.id)
    if (item && !item.is_folder) {
        setActiveDragItem(item);
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragItem(null)
    const { active, over } = event

    if (!over) return; // Si no se soltó sobre nada válido

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeItem = items.find(item => item.id === activeId);
    if (!activeItem || activeItem.is_folder) return; // Solo mover mazos

    const isOverFolder = folders.some(f => f.id === overId);
    const isOverRootDeckAreaOrSelf = overId === 'root-drop-area' || overId === activeId; // 'root-drop-area' es un ID que podríamos añadir si queremos un área explícita, o simplemente detectar si overId es otro mazo raíz.

    const activeIndex = items.findIndex(item => item.id === activeId);
    
    // CASO 1: Mover a una carpeta
    if (isOverFolder && activeItem.parent_id !== overId) {
        const newParentId = overId;
        // Actualización optimista
        setItems(prevItems => prevItems.map(item =>
            item.id === activeId ? { ...item, parent_id: newParentId, position: null } : item // Resetear posición al entrar en carpeta
        ));
        // Actualizar Supabase
        const supabase = createClient();
        const { error } = await supabase.from("decks").update({ parent_id: newParentId, position: null }).eq("id", activeId);
        if (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to move deck into folder." });
            setItems(initialItems); // Revertir si falla
        } else {
             toast({ title: "Success", description: "Deck moved into folder." });
        }
    }
    // CASO 2: Reordenar dentro de rootDecks o moverse fuera de una carpeta a root
    else if (overId !== activeId && !isOverFolder ) {
        const overIndex = items.findIndex(item => item.id === overId);
        
        // Si 'over' es otro mazo raíz o se movió fuera de una carpeta a la zona raíz
        if (overIndex !== -1 && !items[overIndex].is_folder) {
           
            const newItems = arrayMove(items, activeIndex, overIndex);
            
            // Recalcular posición
            const prevItemPos = newItems[overIndex - 1]?.position;
            const nextItemPos = newItems[overIndex + 1]?.position;
            let newPosition: number;

            if (prevItemPos == null && nextItemPos == null) { // Único elemento o no hay posiciones definidas
              newPosition = 1; // O cualquier valor inicial como Date.now()
            } else if (prevItemPos == null) { // Mover al principio
              newPosition = (nextItemPos ?? 1) / 2;
            } else if (nextItemPos == null) { // Mover al final
              newPosition = prevItemPos + 1;
            } else { // Mover entre dos elementos
              newPosition = (prevItemPos + nextItemPos) / 2;
            }

            // Actualización optimista con nueva posición y parent_id null
            setItems(newItems.map((item, index) => 
                index === overIndex ? { ...item, position: newPosition, parent_id: null } : item
            ));

            // Actualizar Supabase
            const supabase = createClient();
            const { error } = await supabase.from("decks").update({ position: newPosition, parent_id: null }).eq("id", activeId);
             if (error) {
                toast({ variant: "destructive", title: "Error", description: "Failed to reorder deck." });
                setItems(initialItems); // Revertir si falla
            } else {
                 toast({ title: "Success", description: "Deck reordered." });
            }
        } else if (activeItem.parent_id) { // Caso: Mover de carpeta a root (soltando en espacio vacío o sobre sí mismo después de salir)
            
            // Calcular posición (poner al final por simplicidad, se podría mejorar)
            const lastRootDeckPos = rootDecks.length > 0 ? rootDecks[rootDecks.length-1].position : 0;
            const newPosition = (lastRootDeckPos ?? 0) + 1;

            // Actualización optimista
            setItems(prevItems => prevItems.map(item =>
                item.id === activeId ? { ...item, parent_id: null, position: newPosition } : item
            ));

             // Actualizar Supabase
            const supabase = createClient();
            const { error } = await supabase.from("decks").update({ parent_id: null, position: newPosition }).eq("id", activeId);
            if (error) {
                toast({ variant: "destructive", title: "Error", description: "Failed to move deck out of folder." });
                setItems(initialItems); // Revertir si falla
            } else {
                 toast({ title: "Success", description: "Deck moved out of folder." });
            }
        }
    }
  }


  if (items.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <BookOpen className="mb-4 h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">Your dashboard is empty</h2>
        <p className="mb-6 text-muted-foreground">Create your first deck to get started.</p>
        <div className="flex gap-2">
          <CreateDeckDialog onDeckCreated={() => router.refresh()} size="lg" />
          <CreateAIDeckDialog />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
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
            <CreateAIDeckDialog />
            <CreateDeckDialog onDeckCreated={() => router.refresh()} />
        </div>
      </div>

      <DndContext 
        sensors={sensors} // Añadir sensores
        collisionDetection={closestCenter} // Estrategia de colisión
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-8">
          {/* Carpetas (no son ordenables entre sí por ahora, solo destinos) */}
          {folders.map(folder => {
            const decksInFolder = items.filter(deck => deck.parent_id === folder.id)
            return <FolderView key={folder.id} folder={folder} decks={decksInFolder} isEditMode={isEditMode} onUpdate={setItems} />
          })}

          {/* Contexto de Ordenación para los Mazos Raíz */}
          <SortableContext 
            items={rootDecks.map(deck => deck.id)} 
            strategy={rectSortingStrategy} // Estrategia para grid
            disabled={!isEditMode}
          >
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {rootDecks.map(deck => <DraggableDeckItem key={deck.id} item={deck} isEditMode={isEditMode} onUpdate={setItems} />)}
            </div>
             {/* Área invisible para soltar mazos fuera de carpetas (opcional pero útil) */}
             <div 
                id="root-drop-area" 
                ref={useDroppable({ id: 'root-drop-area', disabled: !isEditMode }).setNodeRef}
                className="min-h-10" // Darle un tamaño mínimo para que sea un destino válido
             ></div>
          </SortableContext>
        </div>

        <DragOverlay>
          {activeDragItem ? <DeckCard deck={activeDragItem} isEditMode /> : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}