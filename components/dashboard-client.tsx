// components/dashboard-client.tsx
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  UniqueIdentifier,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { DeckCard } from "./deck-card"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import {
  Folder,
  GripVertical,
  Trash2,
  Edit,
  Paintbrush,
  ChevronDown,
  ChevronRight,
  Loader2,
  BookOpen,
} from "lucide-react"
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
  created_at?: string
}

// ---- Componente para una Carpeta ----
function FolderView({
  folder,
  decks,
  isEditMode,
  onUpdate,
}: {
  folder: Item
  decks: Item[]
  isEditMode: boolean
  onUpdate: (updater: (prev: Item[]) => Item[]) => void
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({
    id: folder.id,
    disabled: !isEditMode,
  })

  const folderColor = folder.color || "hsl(var(--border))"
  const setNodeRef = useMemo(() => setDroppableNodeRef, [setDroppableNodeRef])

  // No renderizar carpetas vacías si no estamos en modo edición
  if (!isEditMode && decks.length === 0) return null

  return (
    <>
      {isRenaming && (
        <RenameDialog
          item={folder}
          isOpen={isRenaming}
          onClose={() => setIsRenaming(false)}
        />
      )}
      <Card
        ref={setNodeRef}
        style={{
          borderColor: isOver && isEditMode ? "hsl(var(--primary))" : folderColor,
        }}
        className="transition-colors border-2"
      >
        <CardHeader
          className="flex-row items-center justify-between space-y-0 p-4 cursor-pointer"
          onClick={() => !isEditMode && setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-4">
            <Folder
              className="h-6 w-6"
              style={{ color: folder.color || "hsl(var(--muted-foreground))" }}
            />
            <CardTitle>{folder.name}</CardTitle>
          </div>

          {isEditMode ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsRenaming(true)
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <ColorPopover
                itemId={folder.id}
                currentColor={folder.color}
                onColorChange={(color) => {
                  onUpdate((prev) =>
                    prev.map((it) =>
                      it.id === folder.id ? { ...it, color } : it
                    )
                  )
                }}
              />
              <DeleteFolderDialog
                folder={folder}
                decksInFolder={decks}
                onDelete={(deletedIds) => {
                  onUpdate((prev) =>
                    prev.filter((it) => !deletedIds.includes(it.id))
                  )
                }}
              />
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
                {decks.map((deck) => (
                  <DraggableDeckItem
                    key={deck.id}
                    item={deck}
                    isEditMode={isEditMode}
                    onUpdate={onUpdate}
                  />
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </>
  )
}

// ---- Componente para un Mazo Arrastrable ----
// Utiliza useSortable si está en la raíz, useDraggable si está en una carpeta
function DraggableDeckItem({
  item,
  isEditMode,
  onUpdate,
}: {
  item: Item
  isEditMode: boolean
  onUpdate: (updater: (prev: Item[]) => Item[]) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isEditMode }); // Usar siempre useSortable

  const { toast } = useToast()
  const [isRenaming, setIsRenaming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const handleDelete = async () => {
    setIsDeleting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("decks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", item.id)
    setIsDeleting(false)
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error sending deck to trash.",
      })
    } else {
      onUpdate((prevItems) => prevItems.filter((i) => i.id !== item.id))
      toast({ title: "Success", description: "Deck moved to trash." })
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group touch-manipulation">
      {isRenaming && (
        <RenameDialog
          item={item}
          isOpen={isRenaming}
          onClose={() => setIsRenaming(false)}
        />
      )}
      {isEditMode && (
        <div className="absolute top-2 right-2 z-20 flex items-center bg-background/80 backdrop-blur-sm rounded-full border p-0.5 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsRenaming(true)}
            title="Rename"
          >
            <Edit className="h-4 w-4" />
          </Button>

          <ColorPopover
            itemId={item.id}
            currentColor={item.color}
            onColorChange={(color) => {
              onUpdate((prev) =>
                prev.map((it) => (it.id === item.id ? { ...it, color } : it))
              )
            }}
          />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={handleDelete}
            title="Delete"
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
          <div
            {...listeners}
            {...attributes}
            className="cursor-grab p-1 touch-none"
            title="Move deck"
          >
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
  const [items, setItems] = useState<Item[]>(initialItems)
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Aumentamos ligeramente la distancia para evitar drags accidentales
        distance: 10,
      },
    })
  )

  useEffect(() => {
    // Ordenar initialItems por posición (y creación si no hay posición) al cargar
    const sortedInitial = [...initialItems].sort((a, b) => {
        const posA = a.position ?? Infinity;
        const posB = b.position ?? Infinity;
        if (posA !== posB) return posA - posB;
        // Si las posiciones son iguales (o ambas null), ordenar por fecha de creación
        return (a.created_at && b.created_at) ? a.created_at.localeCompare(b.created_at) : 0;
    });
    setItems(sortedInitial);
  }, [initialItems])

  const { folders, rootDecks, decksInFolders } = useMemo(() => {
    const foldersMap = new Map<string, Item>()
    const rootDecksList: Item[] = []
    const decksInFoldersMap = new Map<string, Item[]>()

    // Ordenar primero por si es carpeta o no, luego por posición/fecha
    const sortedItems = [...items].sort((a, b) => {
        if (a.is_folder && !b.is_folder) return -1;
        if (!a.is_folder && b.is_folder) return 1;
        const posA = a.position ?? Infinity;
        const posB = b.position ?? Infinity;
        if (posA !== posB) return posA - posB;
        return (a.created_at && b.created_at) ? a.created_at.localeCompare(b.created_at) : 0;
    });

    for (const item of sortedItems) {
      if (item.is_folder) {
        foldersMap.set(item.id, item)
        if (!decksInFoldersMap.has(item.id)) {
          decksInFoldersMap.set(item.id, [])
        }
      } else if (item.parent_id) {
        if (!decksInFoldersMap.has(item.parent_id)) {
          decksInFoldersMap.set(item.parent_id, [])
        }
        decksInFoldersMap.get(item.parent_id)!.push(item)
        // Ordenar mazos dentro de la carpeta por creación (u otro criterio si es necesario)
        decksInFoldersMap.get(item.parent_id)!.sort((a, b) => (a.created_at && b.created_at) ? a.created_at.localeCompare(b.created_at) : 0);
      } else {
        rootDecksList.push(item)
      }
    }

    // Convertir mapa de carpetas a array ordenado (manteniendo orden original si es posible)
    const sortedFolders = Array.from(foldersMap.values()).sort((a,b) => (a.created_at && b.created_at) ? a.created_at.localeCompare(b.created_at) : 0);

    return { folders: sortedFolders, rootDecks: rootDecksList, decksInFolders: decksInFoldersMap }
  }, [items])

  const handleDragStart = (event: DragStartEvent) => {
    if (!isEditMode) return
    const { active } = event
    const item = items.find((i) => i.id === active.id)
    // Solo permitir arrastrar mazos
    if (item && !item.is_folder) {
      setActiveDragItem(item)
    } else {
      setActiveDragItem(null) // No arrastrar carpetas
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragItem(null)
    const { active, over } = event

    // Si no hay item activo, no es un mazo, o no hay destino, salir
    const activeItem = items.find((item) => item.id === active.id)
    if (!activeItem || activeItem.is_folder || !over) return;

    const activeId = active.id as string
    const overId = over.id as string

    // Si se suelta sobre sí mismo, no hacer nada
    if (activeId === overId) return

    const supabase = createClient()
    let dbUpdate: Partial<Item> = {}
    let newItems = [...items] // Clonar para la actualización optimista
    let successMessage = ""
    let errorMessage = ""

    const isOverFolder = folders.some((f) => f.id === overId)
    const isOverRootArea = overId === 'root-drop-area';
    const overItem = items.find(item => item.id === overId);
    const isOverRootDeck = overItem && !overItem.is_folder && !overItem.parent_id;

    const oldIndex = newItems.findIndex((item) => item.id === activeId)

    try {
      // CASO 1: Mover HACIA una carpeta
      if (isOverFolder && activeItem.parent_id !== overId) {
        newItems[oldIndex] = { ...activeItem, parent_id: overId, position: null };
        dbUpdate = { parent_id: overId, position: null };
        successMessage = "Deck moved into folder.";
        errorMessage = "Failed to move deck into folder.";
      }
      // CASO 2: Mover DESDE una carpeta HACIA root (soltando en root-drop-area o sobre otro mazo raíz)
      else if (activeItem.parent_id && (isOverRootArea || isOverRootDeck)) {
         let newIndex = -1;
         if (isOverRootDeck) {
             newIndex = newItems.findIndex(item => item.id === overId);
         } else { // Soltado en root-drop-area, va al final de los rootDecks
             newIndex = newItems.filter(item => !item.is_folder && !item.parent_id).length + folders.length; // Después de todas las carpetas y rootDecks
         }

         // Mover el item en el array optimista
         newItems = arrayMove(newItems, oldIndex, newIndex);

         // Recalcular posiciones solo para los items raíz afectados
         const rootItemsAfterMove = newItems.filter(item => !item.is_folder && !item.parent_id);
         const updatedPositions: { [id: string]: number } = {};
         for (let i = 0; i < rootItemsAfterMove.length; i++) {
             const prevPos = rootItemsAfterMove[i - 1]?.position;
             const nextPos = rootItemsAfterMove[i + 1]?.position;
             const currentItem = rootItemsAfterMove[i];
             const calculatedPos = calculateNewPosition(prevPos, nextPos, i); // Pasar índice como fallback
             if(currentItem.id === activeId || currentItem.position !== calculatedPos) {
                 updatedPositions[currentItem.id] = calculatedPos;
             }
         }

        // Aplicar posiciones recalculadas y parent_id null al item movido
        newItems = newItems.map(item => {
             if (item.id === activeId) {
                 dbUpdate = { parent_id: null, position: updatedPositions[activeId] };
                 return { ...item, parent_id: null, position: updatedPositions[activeId] };
             }
             if (updatedPositions[item.id] !== undefined) {
                 // Actualizar otros items si su posición calculada cambió (aunque no se actualiza en DB aquí)
                 return { ...item, position: updatedPositions[item.id] };
             }
             return item;
         });

        successMessage = "Deck moved out of folder.";
        errorMessage = "Failed to move deck out of folder.";

      }
      // CASO 3: Reordenar DENTRO de rootDecks
       else if (!activeItem.parent_id && isOverRootDeck) {
         const newIndex = newItems.findIndex(item => item.id === overId);

         if (oldIndex === newIndex) return; // No hubo cambio real

         // Mover en el array optimista
         newItems = arrayMove(newItems, oldIndex, newIndex);

         // Recalcular posiciones solo para los items raíz afectados
         const rootItemsAfterMove = newItems.filter(item => !item.is_folder && !item.parent_id);
         const updatedPositions: { [id: string]: number } = {};
         const movedItemIndex = rootItemsAfterMove.findIndex(item => item.id === activeId); // Índice dentro de rootDecks

         // Calcular nueva posición para el item movido
         const prevPos = rootItemsAfterMove[movedItemIndex - 1]?.position;
         const nextPos = rootItemsAfterMove[movedItemIndex + 1]?.position;
         const newPosition = calculateNewPosition(prevPos, nextPos, movedItemIndex); // Pasar índice como fallback

         dbUpdate = { position: newPosition, parent_id: null }; // Asegurar parent_id null

         // Aplicar la nueva posición solo al item movido en el estado optimista
          newItems = newItems.map(item =>
             item.id === activeId ? { ...item, position: newPosition, parent_id: null } : item
         );


         successMessage = "Deck reordered.";
         errorMessage = "Failed to reorder deck.";
      } else {
        // Movimiento inválido (ej: intentar soltar sobre sí mismo indirectamente, o en un área no definida)
        return;
      }

      // Ejecutar actualización optimista
      setItems(newItems.sort((a, b) => { // Re-ordenar siempre al final
        if (a.is_folder && !b.is_folder) return -1;
        if (!a.is_folder && b.is_folder) return 1;
        const posA = a.position ?? Infinity;
        const posB = b.position ?? Infinity;
        if (posA !== posB) return posA - posB;
        return (a.created_at && b.created_at) ? a.created_at.localeCompare(b.created_at) : 0;
      }));

      // Ejecutar actualización en Supabase
      if (Object.keys(dbUpdate).length > 0) {
        const { error } = await supabase.from("decks").update(dbUpdate).eq("id", activeId);
        if (error) {
            throw new Error(errorMessage + ` (${error.message})`);
        } else {
            toast({ title: "Success", description: successMessage });
             // Opcional: Refrescar para asegurar consistencia total si la lógica optimista falla
             // router.refresh();
        }
      } else {
           // Si no hay dbUpdate, probablemente fue un movimiento inválido que se coló
           console.warn("DragEnd handled but no DB update was generated for activeId:", activeId);
      }

    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message || "An error occurred." });
        // Revertir estado al inicial en caso de error
        setItems(initialItems.sort((a, b) => { // Asegurar orden inicial también
             const posA = a.position ?? Infinity;
             const posB = b.position ?? Infinity;
             if (posA !== posB) return posA - posB;
             return (a.created_at && b.created_at) ? a.created_at.localeCompare(b.created_at) : 0;
        }));
    }
  }

 // Función auxiliar para calcular posición
  const calculateNewPosition = (
      prevPos: number | null | undefined,
      nextPos: number | null | undefined,
      currentIndex: number // Índice actual como fallback
  ): number => {
      const BASE_INCREMENT = 1000; // Incremento base más grande para evitar colisiones flotantes
      const MIN_POSITION = 1;

      if (prevPos == null && nextPos == null) {
          // Primer o único elemento
          return MIN_POSITION;
      } else if (prevPos == null) {
           // Mover al principio
          return (nextPos ?? BASE_INCREMENT) / 2;
      } else if (nextPos == null) {
          // Mover al final
          return prevPos + BASE_INCREMENT;
      } else {
          // Mover entre dos elementos
          const newPos = (prevPos + nextPos) / 2;
           // Evitar posiciones demasiado cercanas o iguales
          if (Math.abs(newPos - prevPos) < 0.001 || Math.abs(newPos - nextPos) < 0.001) {
              // Si están muy juntas, usar el índice como base para recalcular (menos preciso pero evita colisión)
              // Podrías implementar una reindexación completa aquí si es necesario
              console.warn("Potential position collision, using index-based fallback.");
              return (currentIndex + 1) * BASE_INCREMENT;
          }
          return newPos;
      }
  };


  if (items.length === 0 && !isEditMode) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <BookOpen className="mb-4 h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">Your dashboard is empty</h2>
        <p className="mb-6 text-muted-foreground">
          Create your first deck to get started.
        </p>
        <div className="flex gap-2">
          <CreateDeckDialog onDeckCreated={() => router.refresh()} size="lg" />
          <CreateAIDeckDialog />
        </div>
      </div>
    )
  }

  // IDs para SortableContext deben ser estables y solo incluir items arrastrables (decks)
   const draggableItemIds = useMemo(() => items.filter(item => !item.is_folder).map(item => item.id), [items]);


  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Decks</h1>
          <p className="text-muted-foreground">
            Manage your study flashcard decks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isEditMode ? "default" : "outline"}
            onClick={() => setIsEditMode((prev) => !prev)}
          >
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
        collisionDetection={closestCenter} // Podrías probar otras estrategias si esta no funciona bien
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Usamos SortableContext para TODOS los items arrastrables (decks) */}
        <SortableContext items={draggableItemIds} strategy={rectSortingStrategy}>
          <div className="space-y-8">
            {/* Carpetas (no son sortable, solo droppable) */}
            {folders.map((folder) => {
              const decksInCurrentFolder = decksInFolders.get(folder.id) || []
              return (
                <FolderView
                  key={folder.id}
                  folder={folder}
                  decks={decksInCurrentFolder}
                  isEditMode={isEditMode}
                  onUpdate={setItems}
                />
              )
            })}

            {/* Mazos Raíz (son sortable) */}
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
               {rootDecks.map((deck) => (
                 <DraggableDeckItem
                   key={deck.id}
                   item={deck}
                   isEditMode={isEditMode}
                   onUpdate={setItems}
                 />
               ))}
             </div>
          </div>
           {/* Área invisible para soltar mazos fuera de carpetas */}
            <div
                id="root-drop-area"
                ref={useDroppable({ id: 'root-drop-area', disabled: !isEditMode }).setNodeRef}
                className="min-h-10 mt-8" // Añadido margen superior para separarlo
            >
                {isEditMode && rootDecks.length === 0 && folders.length > 0 && (
                     <p className="text-sm text-muted-foreground text-center py-4">Drop decks here to move them out of folders.</p>
                 )}
            </div>
        </SortableContext>

        <DragOverlay>
          {/* Renderizar el item que se está arrastrando para la previsualización */}
          {activeDragItem ? <DeckCard deck={activeDragItem} isEditMode /> : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}