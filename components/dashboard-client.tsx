// components/dashboard-client.tsx
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  useDraggable, // Needed for DragOverlay rendering if active item is from within folder
  useDroppable,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from '@dnd-kit/utilities';
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { DeckCard } from "./deck-card"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
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
  position: number | null
  // We might need created_at for stable sorting if position is null or equal
  created_at?: string;
}

// ---- Componente para una Carpeta ----
function FolderView({ folder, decks, isEditMode, onUpdate }: { folder: Item; decks: Item[], isEditMode: boolean, onUpdate: (updater: (prev: Item[]) => Item[]) => void }) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  // Asegúrate de que el droppable SÍ esté habilitado en modo edición
  const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({ id: folder.id, disabled: !isEditMode })

  const folderColor = folder.color || 'hsl(var(--border))'

  // El ref para la carpeta como zona droppable
  const setNodeRef = useMemo(() => setDroppableNodeRef, [setDroppableNodeRef]);

  // No renderizar carpetas vacías si no estamos en modo edición
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
                 // Los items dentro de la carpeta siguen siendo Draggable, pero no Sortable en este contexto
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {decks.map(deck => <DraggableDeckItem key={deck.id} item={deck} isEditMode={isEditMode} onUpdate={onUpdate} isSortable={false} />)}
                </div>
              )}
          </CardContent>
        )}
      </Card>
    </>
  )
}

// ---- Componente para un Mazo Arrastrable ----
// Añadimos 'isSortable' para diferenciar entre los que están en root (sortable) y los de carpeta (draggable only for moving out)
function DraggableDeckItem({ item, isEditMode, onUpdate, isSortable = true }: { item: Item, isEditMode: boolean, onUpdate: (updater: (prev: Item[]) => Item[]) => void, isSortable?: boolean }) {

  // Usamos useSortable si está en la lista principal, useDraggable si está en una carpeta
  const sortable = useSortable({ id: item.id, disabled: !isEditMode || !isSortable });
  const draggable = useDraggable({ id: item.id, disabled: !isEditMode || isSortable });

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = isSortable ? sortable : draggable;

  const { toast } = useToast()
  const [isRenaming, setIsRenaming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Aplicar transform/transition solo si viene de useSortable
  const style = isSortable ? {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  } : {
    opacity: isDragging ? 0.5 : 1, // Draggable no aplica transform automáticamente aquí
    zIndex: isDragging ? 10 : undefined,
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
          <div {...listeners} {...attributes} className="cursor-grab p-1 touch-none" title="Move deck">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      )}
      <DeckCard deck={item} isEditMode={isEditMode}/>
    </div>
  )
}

// ---- Componente Principal del Dashboard ----
export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const router = useRouter()
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    // Ordenar initialItems por posición al recibirlos
    const sortedInitial = [...initialItems].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
    setItems(sortedInitial)
  }, [initialItems])

  const { folders, rootDecks } = useMemo(() => {
    // items ya debería estar ordenado por la carga inicial y las actualizaciones optimistas
    const folders = items.filter(item => item.is_folder).sort((a,b) => (a.created_at && b.created_at) ? a.created_at.localeCompare(b.created_at) : 0); // Ordenar carpetas por creación, por ejemplo
    const rootDecks = items.filter(item => !item.is_folder && !item.parent_id); // Ya están ordenadas por 'position' gracias a useEffect y handleDragEnd
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

    if (!over || !active) return; // Si no hay destino o activo, salir

    const activeId = active.id as string;
    const overId = over.id as string;

    // Si se suelta sobre sí mismo, no hacer nada
    if (activeId === overId) return;

    const activeItem = items.find(item => item.id === activeId);
    if (!activeItem || activeItem.is_folder) return; // Solo movemos mazos

    const isOverFolder = folders.some(f => f.id === overId);
    const activeIndex = items.findIndex(item => item.id === activeId);
    const overIndex = items.findIndex(item => item.id === overId); // Puede ser -1 si se suelta en root-drop-area

    // --- Lógica Refinada ---
    const supabase = createClient();
    let dbUpdate: Partial<Item> = {};
    let optimisticUpdate: (prev: Item[]) => Item[] = prev => prev;
    let successMessage = "";
    let errorMessage = "";

    // CASO 1: Mover HACIA una carpeta
    if (isOverFolder && activeItem.parent_id !== overId) {
        dbUpdate = { parent_id: overId, position: null }; // Resetear position al entrar
        optimisticUpdate = prevItems => prevItems.map(item =>
            item.id === activeId ? { ...item, parent_id: overId, position: null } : item
        );
        successMessage = "Deck moved into folder.";
        errorMessage = "Failed to move deck into folder.";
    }
    // CASO 2: Mover DESDE una carpeta HACIA root (soltando en root-drop-area o sobre otro mazo raíz)
    else if (activeItem.parent_id && (!isOverFolder || overId === 'root-drop-area')) {
        // Encontrar dónde se soltó en la lista de rootDecks
        const targetRootIndex = overIndex !== -1 && !items[overIndex].is_folder
          ? rootDecks.findIndex(d => d.id === overId)
          : rootDecks.length; // Si se suelta en área vacía o no es mazo raíz, va al final

        const tempRootDecks = [...rootDecks]; // Copia temporal para calcular posición
         // Insertar temporalmente para cálculo (no afecta estado real aún)
        const itemToInsert = { ...activeItem, parent_id: null };
        tempRootDecks.splice(targetRootIndex, 0, itemToInsert);

        // Calcular nueva posición
        const prevItemPos = tempRootDecks[targetRootIndex - 1]?.position;
        const nextItemPos = tempRootDecks[targetRootIndex + 1]?.position;
        let newPosition = calculateNewPosition(prevItemPos, nextItemPos);

        dbUpdate = { parent_id: null, position: newPosition };
        optimisticUpdate = prevItems => {
            const updatedItem = { ...activeItem, parent_id: null, position: newPosition };
            // Quitar de su sitio original y colocar ordenado en root
            const filtered = prevItems.filter(item => item.id !== activeId);
            // Reinsertar ordenado (esto es simplificado, idealmente usarías el índice calculado)
            filtered.push(updatedItem);
            return filtered.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
        }
        successMessage = "Deck moved out of folder.";
        errorMessage = "Failed to move deck out of folder.";
    }
    // CASO 3: Reordenar DENTRO de rootDecks
    else if (!activeItem.parent_id && overIndex !== -1 && !items[overIndex].is_folder) {
         const oldRootIndex = rootDecks.findIndex(item => item.id === activeId);
         const newRootIndex = rootDecks.findIndex(item => item.id === overId);

        if (oldRootIndex === newRootIndex) return; // No hubo cambio real de orden

        const movedRootDecks = arrayMove(rootDecks, oldRootIndex, newRootIndex);

        // Calcular nueva posición basado en la nueva lista ordenada
        const prevItemPos = movedRootDecks[newRootIndex - 1]?.position;
        const nextItemPos = movedRootDecks[newRootIndex + 1]?.position;
        let newPosition = calculateNewPosition(prevItemPos, nextItemPos);

        dbUpdate = { position: newPosition, parent_id: null }; // Asegurar parent_id null
        optimisticUpdate = prevItems => {
             const itemsWithoutFolders = prevItems.filter(item => !item.is_folder);
             const oldGlobalIndex = itemsWithoutFolders.findIndex(item => item.id === activeId);
             const newGlobalIndex = itemsWithoutFolders.findIndex(item => item.id === overId);
             
             // Mover en la lista global que incluye carpetas también
             const globalOldIndex = prevItems.findIndex(item => item.id === activeId);
             const globalNewIndex = prevItems.findIndex(item => item.id === overId);
             
             let movedItems = arrayMove(prevItems, globalOldIndex, globalNewIndex);

             // Aplicar la nueva posición al item movido
             return movedItems.map(item => item.id === activeId ? { ...item, position: newPosition, parent_id: null } : item);
        };
        successMessage = "Deck reordered.";
        errorMessage = "Failed to reorder deck.";
    } else {
        // No hacer nada si se intenta soltar una carpeta, o soltar en un lugar inválido.
        return;
    }

    // Ejecutar actualización optimista
    setItems(optimisticUpdate);

    // Ejecutar actualización en Supabase
    const { error } = await supabase.from("decks").update(dbUpdate).eq("id", activeId);

    if (error) {
        toast({ variant: "destructive", title: "Error", description: errorMessage });
        setItems(initialItems); // Revertir si falla
    } else {
        toast({ title: "Success", description: successMessage });
        // Opcional: Podrías querer refetchear para asegurar consistencia,
        // pero la actualización optimista + recálculo de posición debería ser suficiente.
        // router.refresh(); // Descomentar si prefieres recargar todo
    }
  }

  // Función auxiliar para calcular posición
  const calculateNewPosition = (prevPos: number | null | undefined, nextPos: number | null | undefined): number => {
      if (prevPos == null && nextPos == null) {
        return 1; // Primer elemento o único
      } else if (prevPos == null) {
        return (nextPos ?? 1) / 2; // Al principio
      } else if (nextPos == null) {
        return prevPos + 1; // Al final
      } else {
        return (prevPos + nextPos) / 2; // Entre dos
      }
  };


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
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-8">
          {/* Carpetas (no son ordenables, solo destinos) */}
          {folders.map(folder => {
            const decksInFolder = items.filter(deck => deck.parent_id === folder.id)
            // Ordenar mazos dentro de la carpeta por fecha de creación u otro criterio si es necesario
            .sort((a, b) => (a.created_at && b.created_at) ? a.created_at.localeCompare(b.created_at) : 0);
            return <FolderView key={folder.id} folder={folder} decks={decksInFolder} isEditMode={isEditMode} onUpdate={setItems} />
          })}

          {/* Contexto de Ordenación para los Mazos Raíz */}
          <SortableContext
            items={rootDecks.map(deck => deck.id)}
            strategy={rectSortingStrategy}
            disabled={!isEditMode}
          >
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {rootDecks.map(deck => <DraggableDeckItem key={deck.id} item={deck} isEditMode={isEditMode} onUpdate={setItems} isSortable={true}/>)}
            </div>
             {/* Área invisible para soltar mazos fuera de carpetas */}
             <div
                id="root-drop-area"
                ref={useDroppable({ id: 'root-drop-area', disabled: !isEditMode }).setNodeRef}
                className="min-h-10" // Zona para poder soltar fuera de carpetas
             ></div>
          </SortableContext>
        </div>

        <DragOverlay>
          {/* Renderizar el item que se está arrastrando para la previsualización */}
          {activeDragItem ? <DeckCard deck={activeDragItem} isEditMode /> : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}