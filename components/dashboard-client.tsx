// components/dashboard-client.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  useDroppable,
  DragOverlay,
  closestCorners, // Usaremos closestCorners para mejorar detección
  PointerSensor,
  MouseSensor, // <-- AÑADIDO: Usar MouseSensor para mejor control con ratón
  TouchSensor, // <-- AÑADIDO: Usar TouchSensor para mejor control táctil
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier,
  // --- AÑADIDO: Modificadores para restringir movimiento si es necesario ---
  // import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy, // <-- Para los mazos dentro de carpetas y en la raíz
  verticalListSortingStrategy, // <-- Para la lista principal (carpetas y el contenedor de mazos raíz)
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { DeckCard } from "./deck-card";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
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
  Info,
} from "lucide-react";
import { DeleteFolderDialog } from "./delete-folder-dialog";
import { RenameDialog } from "./rename-dialog";
import { ColorPopover } from "./color-popover";
import { CreateDeckDialog } from "./create-deck-dialog";
import { CreateFolderDialog } from "./create-folder-dialog";
import { CreateAIDeckDialog } from "./create-ai-deck-dialog";
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
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
  is_folder: boolean;
  parent_id: string | null;
  color: string | null;
  position: number | null;
  created_at?: string;
};

// --- Componente FolderView (Sin cambios estructurales importantes, se mantiene SortableContext interno) ---
function FolderView({ /* ...props sin cambios... */
  folder,
  decks,
  isEditMode,
  onUpdate,
  isDraggingOver,
  activeDragItem,
}: {
  folder: Item;
  decks: Item[];
  isEditMode: boolean;
  onUpdate: (updater: (prev: Item[]) => Item[]) => void;
  isDraggingOver: boolean;
  activeDragItem: Item | null;
}) {
    const [isRenaming, setIsRenaming] = useState(false);
    // Mostrar expandido por defecto en modo edición para facilitar el drop
    const [isExpanded, setIsExpanded] = useState(isEditMode);

    const {
        attributes,
        listeners,
        setNodeRef: setSortableNodeRef,
        transform,
        transition,
        isDragging: isFolderDragging,
    } = useSortable({ id: folder.id, disabled: !isEditMode });

    const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
        id: folder.id,
        disabled: !isEditMode || isFolderDragging,
    });

    const folderColor = folder.color || "hsl(var(--border))";

    const combinedRef = (node: HTMLElement | null) => {
        setSortableNodeRef(node);
        setDroppableNodeRef(node);
    };

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isFolderDragging ? 0.5 : 1,
        zIndex: isFolderDragging ? 10 : undefined,
    };

    // Resaltar si se arrastra un mazo (no carpeta) sobre esta carpeta y no es su carpeta actual
    const shouldHighlightDrop = isEditMode && isOver && activeDragItem && !activeDragItem.is_folder && activeDragItem.parent_id !== folder.id;

    // Expandir automáticamente si se arrastra un mazo sobre ella
    useEffect(() => {
        if (shouldHighlightDrop && !isExpanded) {
            setIsExpanded(true);
        }
    }, [shouldHighlightDrop, isExpanded]);


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
        ref={combinedRef}
        style={style}
        className={cn(
          "transition-all duration-150 ease-out border-2 relative group", // <-- Añadido relative group
          // Aplicar resaltado si `isOver` es true y se está arrastrando algo que puede ir DENTRO de la carpeta
          shouldHighlightDrop ? "border-primary ring-2 ring-primary ring-offset-2 bg-primary/5" : `border-[${folderColor}]`,
          isEditMode && !shouldHighlightDrop ? "hover:border-muted-foreground/50" : ""
        )}
      >
        {isEditMode && (
           // Handle de arrastre para la carpeta (más visible y a la izquierda)
          <div {...listeners} {...attributes} className="absolute top-1/2 -left-3 transform -translate-y-1/2 z-10 p-1 cursor-grab touch-none opacity-0 group-hover:opacity-100 transition-opacity" title="Move Folder">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <CardHeader
          className="flex-row items-center justify-between space-y-0 p-4 cursor-pointer"
          onClick={() => !isEditMode && setIsExpanded(!isExpanded)} // Solo permitir colapsar/expandir fuera de modo edición
        >
          <div className="flex items-center gap-4">
            <Folder
              className="h-6 w-6"
              style={{ color: folder.color || "hsl(var(--muted-foreground))" }}
            />
            <CardTitle>{folder.name}</CardTitle>
          </div>
           {/* Botones de acción (Edit, Color, Delete) */}
          {isEditMode ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}><Edit className="h-4 w-4" /></Button>
              <ColorPopover itemId={folder.id} currentColor={folder.color} onColorChange={(color) => { onUpdate((prev) => prev.map((it) => it.id === folder.id ? { ...it, color } : it)); }} />
              <DeleteFolderDialog folder={folder} decksInFolder={decks} onDelete={(deletedIds) => { onUpdate((prev) => prev.filter((it) => !deletedIds.includes(it.id))); }} />
            </div>
          ) : (
             // Botón para expandir/colapsar fuera de modo edición
            (decks.length > 0) && ( // Solo mostrar si tiene contenido
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
                {isExpanded ? <ChevronDown /> : <ChevronRight />}
              </Button>
            )
          )}
        </CardHeader>
        {/* Siempre mostrar contenido en modo edición, o si está expandido fuera de él */}
        {(isEditMode || isExpanded) && (
          <CardContent className={cn("pt-0", isEditMode ? "p-4 min-h-[80px]" : "p-4")}>
             {/* Usar SortableContext para los decks *dentro* de la carpeta */}
            <SortableContext items={decks.map(d => d.id)} strategy={rectSortingStrategy}>
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
            </SortableContext>
          </CardContent>
        )}
      </Card>
    </>
  );
}


// --- Componente DraggableDeckItem (Con handle de arrastre mejorado) ---
function DraggableDeckItem({
  item,
  isEditMode,
  onUpdate,
}: {
  item: Item;
  isEditMode: boolean;
  onUpdate: (updater: (prev: Item[]) => Item[]) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isEditMode });

  const { toast } = useToast();
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const handleDelete = async () => {
    // ... (sin cambios)
    setIsDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("decks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) {
      setIsDeleting(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error sending deck to trash.",
      });
    } else {
      onUpdate((prevItems) => prevItems.filter((i) => i.id !== item.id));
      toast({ title: "Success", description: "Deck moved to trash." });
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group touch-manipulation">
      {isRenaming && (
        <RenameDialog
          item={item}
          isOpen={isRenaming}
          onClose={() => setIsRenaming(false)}
        />
      )}
       {/* Handle de arrastre para el mazo (más visible y a la izquierda) */}
      {isEditMode && (
         <div {...listeners} {...attributes} className="absolute top-1/2 -left-3 transform -translate-y-1/2 z-10 p-1 cursor-grab touch-none opacity-0 group-hover:opacity-100 transition-opacity" title="Move Deck">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
      )}
      {/* Botones de acción (Edit, Color, Delete) */}
      {isEditMode && (
        <div className="absolute top-2 right-2 z-20 flex items-center bg-background/80 backdrop-blur-sm rounded-full border p-0.5 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsRenaming(true)} title="Rename" > <Edit className="h-4 w-4" /> </Button>
          <ColorPopover itemId={item.id} currentColor={item.color} onColorChange={(color) => { onUpdate((prev) => prev.map((it) => (it.id === item.id ? { ...it, color } : it)) ); }} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete" disabled={isDeleting} >
                {isDeleting ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<Trash2 className="h-4 w-4" />)}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader> <AlertDialogTitle>Move deck "{item.name}" to trash?</AlertDialogTitle> <AlertDialogDescription> This deck and its cards will be moved to the trash. You can restore them later. </AlertDialogDescription> </AlertDialogHeader>
              <AlertDialogFooter> <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel> <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" > {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Move to Trash </AlertDialogAction> </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
           {/* Handle movido a la izquierda */}
        </div>
      )}
      <DeckCard deck={item} isEditMode={isEditMode} />
    </div>
  );
}


// ---- Componente Principal del Dashboard (MODIFICADO) ----
const ROOT_DROPPABLE_ID = 'root-drop-area';
// --- AÑADIDO: Identificador para el contenedor de mazos raíz ---
const ROOT_DECKS_CONTAINER_ID = 'root-decks-container';

export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);

  // --- SENSORES MEJORADOS ---
  const sensors = useSensors(
     useSensor(MouseSensor, { // Mejor para precisión con ratón
      activationConstraint: {
        distance: 8, // Requiere mover 8px para iniciar arrastre
      },
    }),
     useSensor(TouchSensor, { // Mejor para dispositivos táctiles
      activationConstraint: {
        delay: 250, // Mantener presionado 250ms
        tolerance: 5, // Permitir mover 5px mientras se presiona
      },
    }),
    useSensor(PointerSensor, { // Fallback general
       activationConstraint: { distance: 10, }
    })
  );

  // Orden inicial (sin cambios)
  useEffect(() => {
    // ... (lógica de orden inicial y popup sin cambios)
    const sortedInitial = [...initialItems].sort((a, b) => {
        const posA = a.position ?? Infinity;
        const posB = b.position ?? Infinity;
        if (posA !== posB) return posA - posB;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
    setItems(sortedInitial);

    const hasSeenPopup = localStorage.getItem('hasSeenWelcomePopup');
    if (!hasSeenPopup && initialItems.length > 0) {
      setShowWelcomePopup(true);
      localStorage.setItem('hasSeenWelcomePopup', 'true');
    }
  }, [initialItems]);


  // Separación de items (ligeramente ajustada)
  const { folders, rootDecks, decksInFolders, rootLevelIds } = useMemo(() => {
    const foldersMap = new Map<string, Item>();
    const rootDecksList: Item[] = [];
    const decksInFoldersMap = new Map<string, Item[]>();

    // Ordenar items para la lógica de separación
    const sortedItems = [...items].sort((a, b) => {
      const posA = a.position ?? Infinity;
      const posB = b.position ?? Infinity;
      if (posA !== posB) return posA - posB;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });

    for (const item of sortedItems) {
      if (item.is_folder) {
        foldersMap.set(item.id, item);
        if (!decksInFoldersMap.has(item.id)) {
          decksInFoldersMap.set(item.id, []);
        }
      } else if (item.parent_id) {
        if (!decksInFoldersMap.has(item.parent_id)) {
          // Si la carpeta padre no existe, trátalo como raíz
          rootDecksList.push(item);
        } else {
          // Ordenar mazos dentro de la carpeta por posición
          const folderDecks = decksInFoldersMap.get(item.parent_id)!;
          folderDecks.push(item);
          folderDecks.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
        }
      } else {
        rootDecksList.push(item);
      }
    }

    // Ordenar las carpetas según el orden general
    const sortedFolders = Array.from(foldersMap.values()).sort((a, b) => {
      const posA = a.position ?? Infinity;
      const posB = b.position ?? Infinity;
      if (posA !== posB) return posA - posB;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });

    // --- IDs para el SortableContext del nivel raíz ---
    // Incluye las carpetas y un identificador para el contenedor de mazos raíz
    const combinedRootLevelIds = [
      ...sortedFolders.map(f => f.id),
      ROOT_DECKS_CONTAINER_ID // Añadir el ID del contenedor
    ];


    return {
      folders: sortedFolders,
      rootDecks: rootDecksList, // Ya están ordenados por la clasificación inicial
      decksInFolders: decksInFoldersMap,
      rootLevelIds: combinedRootLevelIds,
    };
  }, [items]);


  const handleDragStart = (event: DragStartEvent) => {
     // ... (sin cambios)
     if (!isEditMode) return;
     const { active } = event;
     const item = items.find((i) => i.id === active.id);
     setActiveDragItem(item || null);
     setOverId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // ... (sin cambios)
     const { over } = event;
     setOverId(over ? over.id : null);
  };

  const { setNodeRef: setRootDroppableNodeRef, isOver: isOverRootArea } = useDroppable({
    id: ROOT_DROPPABLE_ID,
    disabled: !isEditMode,
  });

  const calculateNewPosition = ( /* ...sin cambios... */
     prevPos: number | null | undefined,
    nextPos: number | null | undefined,
    currentIndex: number
  ): number => {
    const defaultIncrement = 1000;
    let newPos: number;

    if (prevPos === null || prevPos === undefined) {
      newPos = nextPos !== null && nextPos !== undefined ? nextPos / 2 : defaultIncrement * (currentIndex + 1);
    } else if (nextPos === null || nextPos === undefined) {
      newPos = prevPos + defaultIncrement;
    } else {
      newPos = prevPos + (nextPos - prevPos) / 2;
    }
    return Math.max(1, Math.round(newPos));
  };


   // --- handleDragEnd REVISADO Y OPTIMIZADO ---
   const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id;
    const overIdResolved = over?.id;

    // Resetear estados visuales
    setActiveDragItem(null);
    setOverId(null);

    const activeItem = items.find((item) => item.id === activeId);

    // Salir si no hay cambios o no es válido
    if (!activeItem || !isEditMode || activeId === overIdResolved) {
        return;
    }

    const supabase = createClient();
    let initialItemsSnapshot = [...items]; // Guardar estado inicial para revertir
    let newItems = [...items];
    const updatesMap: Record<string, Partial<Item>> = {};
    let successMessage = "";
    let errorMessage = "Failed to update item.";

    const oldIndex = newItems.findIndex((item) => item.id === activeId);
    const overItem = overIdResolved ? items.find((item) => item.id === overIdResolved) : null;

    // --- Determinar Contenedor Origen y Destino ---
    const sourceContainerId = activeItem.parent_id;
    let targetContainerId: string | null = null; // null significa raíz

     if (overIdResolved === ROOT_DROPPABLE_ID) {
        targetContainerId = null; // Mover a la raíz explícitamente
    } else if (overItem?.is_folder && !activeItem.is_folder) {
        targetContainerId = overItem.id; // Mover mazo a una carpeta
    } else if (overItem) {
        // Soltado sobre otro item (mazo o carpeta), hereda su contenedor
        targetContainerId = overItem.parent_id;
    } else {
        // Soltado en espacio "vacío" (podría ser el área raíz implícita)
        // Si viene de una carpeta, lo movemos a la raíz. Si ya estaba en raíz, no hacemos nada aún.
        if (activeItem.parent_id) {
            targetContainerId = null;
        } else {
            // Podría ser reordenamiento en raíz si over es null pero estaba cerca de otros items raíz
            // O podría ser soltado fuera de lugar, lo dejamos como está por ahora
             console.log("Dropped outside valid area, potentially reordering root.");
            // Si overIdResolved es null, arrayMove no funcionará bien. Podríamos intentar colocarlo al final.
            if(!overIdResolved && !activeItem.parent_id) {
                targetContainerId = null; // Confirmar que es la raíz
            } else {
                 return; // No hacer nada si se suelta en un lugar inesperado sin target claro
            }
        }
    }


    try {
        // --- Aplicar Cambios Locales ---
        const isMovingContainer = sourceContainerId !== targetContainerId;
        const overIndex = overIdResolved ? newItems.findIndex(item => item.id === overIdResolved) : -1;

        if (isMovingContainer) {
            // Mover entre contenedores
             const movedItem = { ...newItems[oldIndex], parent_id: targetContainerId, position: null }; // Resetear posición al mover
             newItems.splice(oldIndex, 1);

            // Encontrar índice de inserción en el destino
            let targetInsertionIndex: number;
            if (targetContainerId === null) { // Moviendo a la raíz
                 // Si soltamos sobre un item raíz, insertar antes o después
                 // Si soltamos en ROOT_DROPPABLE_ID o vacío, insertar al final de los items raíz
                if (overIndex !== -1 && !newItems[overIndex].parent_id) { // Soltado sobre item raíz
                     targetInsertionIndex = overIndex > oldIndex ? overIndex : overIndex + 1;
                 } else { // Soltado en área raíz o al final
                    const lastRootIndex = newItems.findLastIndex(item => !item.parent_id);
                    targetInsertionIndex = lastRootIndex + 1;
                }
            } else { // Moviendo a una carpeta
                const lastInFolderIndex = newItems.findLastIndex(item => item.parent_id === targetContainerId);
                targetInsertionIndex = lastInFolderIndex !== -1 ? lastInFolderIndex + 1 : newItems.findIndex(item => item.id === targetContainerId) + 1; // Insertar después del último o de la carpeta
            }
            targetInsertionIndex = Math.max(0, Math.min(targetInsertionIndex, newItems.length));
            newItems.splice(targetInsertionIndex, 0, movedItem);

            updatesMap[activeId] = { parent_id: targetContainerId };
            successMessage = targetContainerId ? "Deck moved into folder." : "Deck moved to root.";

        } else if (overIndex !== -1 && newItems[overIndex].parent_id === sourceContainerId) {
             // Reordenar dentro del mismo contenedor (carpeta o raíz)
             if(oldIndex === overIndex) return; // No hay cambio real
            newItems = arrayMove(newItems, oldIndex, overIndex);
            successMessage = activeItem.is_folder ? "Folder reordered." : "Deck reordered.";
        } else if (!overIdResolved && targetContainerId === null && !activeItem.parent_id) {
            // Caso especial: Reordenar en raíz soltando en espacio vacío (mover al final)
             const lastRootIndex = newItems.findLastIndex(item => !item.parent_id);
             if (oldIndex === lastRootIndex) return; // Ya estaba al final
             newItems = arrayMove(newItems, oldIndex, lastRootIndex);
             successMessage = activeItem.is_folder ? "Folder reordered." : "Deck reordered.";
        }
         else {
             console.log("Drag end condition not met for update.");
             return; // No hacer nada si no es mover o reordenar válido
         }


        // --- Recalcular Posiciones en el Contenedor de Destino ---
        const itemsToReposition = newItems.filter(item => item.parent_id === targetContainerId);
        for (let i = 0; i < itemsToReposition.length; i++) {
            const currentItem = itemsToReposition[i];
            const prevItem = itemsToReposition[i - 1];
            const nextItem = itemsToReposition[i + 1];
            const calculatedPos = calculateNewPosition(prevItem?.position, nextItem?.position, i);

            // Actualizar si la posición cambió o si es el item que movimos/reordenamos
            if (currentItem.position !== calculatedPos || currentItem.id === activeId) {
                updatesMap[currentItem.id] = { ...updatesMap[currentItem.id], position: calculatedPos };
                // Actualizar array local para cálculos posteriores
                 const idxInNewItems = newItems.findIndex(it => it.id === currentItem.id);
                 if (idxInNewItems !== -1) newItems[idxInNewItems].position = calculatedPos;
            }
        }
        // Si movimos *desde* una carpeta, recalcular posiciones allí también
         if (isMovingContainer && sourceContainerId !== null) {
            const sourceItemsToReposition = newItems.filter(item => item.parent_id === sourceContainerId);
             for (let i = 0; i < sourceItemsToReposition.length; i++) {
                const currentItem = sourceItemsToReposition[i];
                const prevItem = sourceItemsToReposition[i - 1];
                const nextItem = sourceItemsToReposition[i + 1];
                const calculatedPos = calculateNewPosition(prevItem?.position, nextItem?.position, i);
                if (currentItem.position !== calculatedPos) {
                     updatesMap[currentItem.id] = { ...updatesMap[currentItem.id], position: calculatedPos };
                    const idxInNewItems = newItems.findIndex(it => it.id === currentItem.id);
                    if (idxInNewItems !== -1) newItems[idxInNewItems].position = calculatedPos;
                }
            }
         }

        // Aplicar estado local final
        setItems(newItems);

        // --- Actualizar Base de Datos ---
        if (Object.keys(updatesMap).length > 0) {
            const updatePromises = Object.entries(updatesMap).map(([id, updateData]) =>
                supabase.from("decks").update(updateData).eq("id", id)
            );
            const results = await Promise.all(updatePromises);
            const firstError = results.find((r) => r.error);

            if (firstError) {
                console.error("Supabase update error:", firstError.error);
                throw new Error(errorMessage + ` (${firstError.error.message})`);
            } else if (successMessage) {
                toast({ title: "Success", description: successMessage });
            }
        }

    } catch (error: any) {
        console.error("Error during drag end:", error);
        toast({ variant: "destructive", title: "Error", description: error.message || "An error occurred during the update." });
        // Revertir al estado antes del drag and drop en caso de error
        setItems(initialItemsSnapshot);
    }
};


  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
         {/* ... (Header sin cambios) ... */}
         <div> <h1 className="text-3xl font-bold">My Decks</h1> <p className="text-muted-foreground"> Manage your study flashcard decks </p> </div>
        <div className="flex items-center gap-2"> <Button variant={isEditMode ? "default" : "outline"} onClick={() => setIsEditMode((prev) => !prev)} > <Edit className="mr-2 h-4 w-4" /> {isEditMode ? "Done" : "Edit"} </Button> {isEditMode && <CreateFolderDialog onFolderCreated={() => router.refresh()} />} <CreateAIDeckDialog /> <CreateDeckDialog onDeckCreated={() => router.refresh()} /> </div>
      </div>

      {items.length === 0 && !isEditMode ? (
         // ... (Mensaje de dashboard vacío sin cambios) ...
         <div className="flex h-[60vh] flex-col items-center justify-center text-center"> <BookOpen className="mb-4 h-16 w-16 text-muted-foreground" /> <h2 className="text-2xl font-semibold">Your dashboard is empty</h2> <p className="mb-6 text-muted-foreground"> Create your first deck to get started. </p> <div className="flex gap-2"> <CreateDeckDialog onDeckCreated={() => router.refresh()} size="lg" /> <CreateAIDeckDialog /> </div> </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners} // Mantenemos closestCorners
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
           // --- AÑADIDO: Modificadores (opcional, para restringir movimiento si es necesario) ---
           // modifiers={isDraggingFolder ? [restrictToVerticalAxis] : undefined} // Ejemplo: Restringir carpetas a eje Y
        >
          {/* --- Contenedor Principal para el Nivel Raíz --- */}
          {/* Usa verticalListSortingStrategy para Carpetas y el Contenedor de Mazos Raíz */}
          <SortableContext items={rootLevelIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-8">
              {/* Renderizar Carpetas */}
              {folders.map((folder) => {
                const decksInCurrentFolder = decksInFolders.get(folder.id) || [];
                return (
                  <FolderView
                    key={folder.id}
                    folder={folder}
                    decks={decksInCurrentFolder}
                    isEditMode={isEditMode}
                    onUpdate={setItems}
                    isDraggingOver={overId === folder.id}
                    activeDragItem={activeDragItem}
                  />
                );
              })}

               {/* --- Contenedor Específico para Mazos Raíz --- */}
               {/* Este div actúa como un item sortable en la lista vertical raíz */}
              <div id={ROOT_DECKS_CONTAINER_ID} key={ROOT_DECKS_CONTAINER_ID} className="root-decks-container">
                 {/* SortableContext INTERNO para los mazos raíz con estrategia de rejilla */}
                <SortableContext items={rootDecks.map(d => d.id)} strategy={rectSortingStrategy}>
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
                 {/* Placeholder si no hay mazos raíz en modo edición */}
                  {isEditMode && rootDecks.length === 0 && (
                     <div className="py-10 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                        Decks outside folders will appear here.
                     </div>
                  )}
                </SortableContext>
              </div>

            </div>
          </SortableContext>

          {/* Área de drop en la raíz (para mover DEcks *hacia* la raíz) */}
          <div
            id={ROOT_DROPPABLE_ID}
            ref={setRootDroppableNodeRef}
            className={cn(
              "mt-12 rounded-lg border-2 border-dashed transition-all duration-150 ease-out",
              isEditMode ? "min-h-[120px] border-border p-6" : "min-h-0 border-transparent p-0",
              isEditMode && isOverRootArea && activeDragItem && !activeDragItem.is_folder && activeDragItem.parent_id && "border-primary ring-2 ring-primary ring-offset-2 bg-primary/5"
            )}
           >
            {isEditMode && (
              <p className="flex items-center justify-center h-full text-center text-sm text-muted-foreground pointer-events-none">
                Drop decks here to move them out of folders.
              </p>
            )}
          </div>

          {/* DragOverlay (sin cambios) */}
          <DragOverlay>
            {activeDragItem ? (
                 activeDragItem.is_folder ? (
                    <Card className="opacity-75 border-2 border-dashed border-muted-foreground bg-muted/30">
                        <CardHeader className="flex-row items-center gap-4 p-4">
                             <Folder className="h-6 w-6 text-muted-foreground" />
                             <CardTitle>{activeDragItem.name}</CardTitle>
                        </CardHeader>
                     </Card>
                 ) : (
                    <DeckCard deck={activeDragItem} isEditMode={isEditMode} />
                 )
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Popup de bienvenida (sin cambios) */}
      <AlertDialog open={showWelcomePopup} onOpenChange={setShowWelcomePopup}>
        {/* ... */}
         <AlertDialogContent> <AlertDialogHeader> <AlertDialogTitle className="flex items-center gap-2"> <Info className="h-5 w-5 text-blue-500" /> Welcome to Memoria! </AlertDialogTitle> <AlertDialogDescription> Memoria helps you learn faster using spaced repetition. To get the most out of it, check out the Help page to discover all the features and how it works. </AlertDialogDescription> </AlertDialogHeader> <AlertDialogFooter> <AlertDialogCancel>Dismiss</AlertDialogCancel> <AlertDialogAction asChild> <Link href="/help">Go to Help Page</Link> </AlertDialogAction> </AlertDialogFooter> </AlertDialogContent>
      </AlertDialog>
    </>
  );
}