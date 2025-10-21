// components/dashboard-client.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  useDroppable,
  DragOverlay,
  // --- MODIFICACIÓN: Volver a closestCenter podría ayudar a targetear carpetas ---
  closestCenter,
  PointerSensor, // Mantener PointerSensor como fallback principal
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier,
  // --- AÑADIDO: Modificadores para suavizar el movimiento ---
  Modifiers,
  restrictToParentElement, // Evita que se salga del contenedor principal
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  verticalListSortingStrategy,
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

// --- Componente FolderView (Ajustes menores para drop) ---
function FolderView({
  folder,
  decks,
  isEditMode,
  onUpdate,
  // isDraggingOver ahora viene de useDroppable
  activeDragItem,
}: {
  folder: Item;
  decks: Item[];
  isEditMode: boolean;
  onUpdate: (updater: (prev: Item[]) => Item[]) => void;
  // isDraggingOver: boolean; // Removido, usar `isOver` de `useDroppable`
  activeDragItem: Item | null;
}) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [isExpanded, setIsExpanded] = useState(isEditMode); // Expandido por defecto en modo edición

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

    // --- TRANSICIÓN MÁS SUAVE ---
    const style = {
        transform: CSS.Transform.toString(transform),
        // Aplicar transición solo cuando no se está arrastrando activamente
        transition: isFolderDragging ? 'none' : transition,
        opacity: isFolderDragging ? 0.5 : 1,
        zIndex: isFolderDragging ? 10 : undefined,
    };


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
          "transition-colors duration-150 ease-out border-2 relative group", // <-- Quitado transition-all
          shouldHighlightDrop ? "border-primary ring-2 ring-primary ring-offset-2 bg-primary/5" : `border-[${folderColor}]`,
          isEditMode && !shouldHighlightDrop ? "hover:border-muted-foreground/50" : ""
        )}
      >
        {isEditMode && (
          <div {...listeners} {...attributes} className="absolute top-1/2 -left-3 transform -translate-y-1/2 z-10 p-1 cursor-grab touch-none opacity-0 group-hover:opacity-100 transition-opacity" title="Move Folder">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <CardHeader /* ...sin cambios... */ >
             {/* ... */}
            <div className="flex-row items-center justify-between space-y-0 p-4 cursor-pointer"
             onClick={() => !isEditMode && setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-4">
                    <Folder
                    className="h-6 w-6"
                    style={{ color: folder.color || "hsl(var(--muted-foreground))" }}
                    />
                    <CardTitle>{folder.name}</CardTitle>
                </div>
                {isEditMode ? (
                    <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}><Edit className="h-4 w-4" /></Button>
                    <ColorPopover itemId={folder.id} currentColor={folder.color} onColorChange={(color) => { onUpdate((prev) => prev.map((it) => it.id === folder.id ? { ...it, color } : it)); }} />
                    <DeleteFolderDialog folder={folder} decksInFolder={decks} onDelete={(deletedIds) => { onUpdate((prev) => prev.filter((it) => !deletedIds.includes(it.id))); }} />
                    </div>
                ) : (
                    (decks.length > 0) && (
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
                        {isExpanded ? <ChevronDown /> : <ChevronRight />}
                    </Button>
                    )
                )}
            </div>
        </CardHeader>
        {(isEditMode || isExpanded) && (
           // --- AUMENTAR PADDING Y MIN-HEIGHT EN MODO EDICIÓN PARA FACILITAR DROP ---
          <CardContent className={cn(
                "pt-0 transition-all duration-200", // Añadir transición suave al contenido
                isEditMode ? "p-6 min-h-[100px]" : "p-4" // Más padding y altura mínima en modo edición
           )}>
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


// --- Componente DraggableDeckItem (Ajuste de transición) ---
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

   // ... (estados y handleDelete sin cambios) ...
    const { toast } = useToast();
    const [isRenaming, setIsRenaming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // --- TRANSICIÓN MÁS SUAVE ---
     const style = {
        transform: CSS.Transform.toString(transform),
        // Aplicar transición solo cuando no se está arrastrando activamente
        transition: isDragging ? 'none' : transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
    };

    const handleDelete = async () => { /* ...sin cambios... */
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
      {isRenaming && ( /* ...sin cambios... */
         <RenameDialog
          item={item}
          isOpen={isRenaming}
          onClose={() => setIsRenaming(false)}
        />
      )}
      {isEditMode && ( /* Handle de arrastre (sin cambios) */
         <div {...listeners} {...attributes} className="absolute top-1/2 -left-3 transform -translate-y-1/2 z-10 p-1 cursor-grab touch-none opacity-0 group-hover:opacity-100 transition-opacity" title="Move Deck">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
      )}
      {isEditMode && ( /* Botones de acción (sin cambios) */
        <div className="absolute top-2 right-2 z-20 flex items-center bg-background/80 backdrop-blur-sm rounded-full border p-0.5 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* ... botones ... */}
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
        </div>
      )}
      <DeckCard deck={item} isEditMode={isEditMode} />
    </div>
  );
}

// ---- Componente Principal del Dashboard (MODIFICADO) ----
const ROOT_DROPPABLE_ID = 'root-drop-area';
const ROOT_DECKS_CONTAINER_ID = 'root-decks-container';

export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);

  // --- SENSORES CON MAYOR TOLERANCIA ---
  const sensors = useSensors(
     useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10, // Aumentado a 10px
      },
    }),
     useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300, // Aumentado a 300ms
        tolerance: 8, // Aumentado a 8px
      },
    }),
     useSensor(PointerSensor, { // Fallback general
       activationConstraint: { distance: 12, } // Aumentado
    })
  );

  // Orden inicial (sin cambios)
  useEffect(() => { /* ...sin cambios... */
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

  // Separación de items (sin cambios)
  const { folders, rootDecks, decksInFolders, rootLevelIds } = useMemo(() => { /* ...sin cambios... */
     const foldersMap = new Map<string, Item>();
    const rootDecksList: Item[] = [];
    const decksInFoldersMap = new Map<string, Item[]>();

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
           console.warn(`Deck ${item.id} has parent_id ${item.parent_id} but folder not found. Treating as root.`);
           rootDecksList.push(item);
        } else {
          const folderDecks = decksInFoldersMap.get(item.parent_id)!;
          folderDecks.push(item);
          folderDecks.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
        }
      } else {
        rootDecksList.push(item);
      }
    }

    const sortedFolders = Array.from(foldersMap.values()).sort((a, b) => {
        const posA = a.position ?? Infinity;
        const posB = b.position ?? Infinity;
        if (posA !== posB) return posA - posB;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });

    const combinedRootLevelIds = [
      ...sortedFolders.map(f => f.id),
      ROOT_DECKS_CONTAINER_ID
    ];


    return {
      folders: sortedFolders,
      rootDecks: rootDecksList,
      decksInFolders: decksInFoldersMap,
      rootLevelIds: combinedRootLevelIds,
    };
   }, [items]);

  const draggableItemIds = useMemo(() => items.map(item => item.id), [items]);

  const handleDragStart = (event: DragStartEvent) => { /* ...sin cambios... */
     if (!isEditMode) return;
     const { active } = event;
     const item = items.find((i) => i.id === active.id);
     setActiveDragItem(item || null);
     setOverId(null);
   };

  const handleDragOver = (event: DragOverEvent) => { /* ...sin cambios... */
     const { over } = event;
     setOverId(over ? over.id : null);
   };

  const { setNodeRef: setRootDroppableNodeRef, isOver: isOverRootArea } = useDroppable({ /* ...sin cambios... */
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


   // --- handleDragEnd (Lógica central sin grandes cambios, revisión menor) ---
   const handleDragEnd = async (event: DragEndEvent) => {
      // ... (misma lógica que la versión anterior para mover/reordenar y actualizar BD)
      const { active, over } = event;
        const activeId = active.id;
        const overIdResolved = over?.id;

        setActiveDragItem(null);
        setOverId(null);

        const activeItem = items.find((item) => item.id === activeId);

        if (!activeItem || !isEditMode || activeId === overIdResolved) {
            return;
        }

        const supabase = createClient();
        let initialItemsSnapshot = [...items];
        let newItems = [...items];
        const updatesMap: Record<string, Partial<Item>> = {};
        let successMessage = "";
        let errorMessage = "Failed to update item.";

        const oldIndex = newItems.findIndex((item) => item.id === activeId);
        const overItem = overIdResolved ? items.find((item) => item.id === overIdResolved) : null;

        const sourceContainerId = activeItem.parent_id;
        let targetContainerId: string | null = null;

        if (overIdResolved === ROOT_DROPPABLE_ID) {
            targetContainerId = null;
        } else if (overItem?.is_folder && !activeItem.is_folder) {
            targetContainerId = overItem.id;
        } else if (overItem) {
            targetContainerId = overItem.parent_id;
        } else {
            if (activeItem.parent_id) {
                targetContainerId = null;
            } else {
                 console.log("Dropped outside valid area, potentially reordering root.");
                if(!overIdResolved && !activeItem.parent_id) {
                    targetContainerId = null;
                } else {
                    return;
                }
            }
        }


        try {
            const isMovingContainer = sourceContainerId !== targetContainerId;
            const overIndex = overIdResolved ? newItems.findIndex(item => item.id === overIdResolved) : -1;
            let finalIndex = overIndex !== -1 ? overIndex : newItems.length -1; // Default to end if no specific overItem

            if (isMovingContainer) {
                 const movedItem = { ...newItems[oldIndex], parent_id: targetContainerId, position: null };
                 newItems.splice(oldIndex, 1);

                let targetInsertionIndex: number;
                if (targetContainerId === null) { // Moving to root
                    if (overIndex !== -1 && !newItems[overIndex]?.parent_id) { // Dropped over root item
                        // Insert relative to the item dropped over
                         targetInsertionIndex = overIndex > oldIndex ? overIndex : overIndex + 1;
                     } else { // Dropped in root area or end
                        const lastRootIndex = newItems.findLastIndex(item => !item.parent_id);
                        targetInsertionIndex = lastRootIndex + 1;
                    }
                } else { // Moving to a folder
                    const folderItemIndex = newItems.findIndex(item => item.id === targetContainerId);
                    const lastInFolderIndex = newItems.findLastIndex(item => item.parent_id === targetContainerId);
                    // Insert after last item in folder, or right after folder if empty
                    targetInsertionIndex = lastInFolderIndex !== -1 ? lastInFolderIndex + 1 : folderItemIndex + 1;
                }
                targetInsertionIndex = Math.max(0, Math.min(targetInsertionIndex, newItems.length));
                newItems.splice(targetInsertionIndex, 0, movedItem);

                updatesMap[activeId] = { parent_id: targetContainerId };
                successMessage = targetContainerId ? "Deck moved into folder." : "Deck moved to root.";

            } else if (overIndex !== -1 && newItems[overIndex]?.parent_id === sourceContainerId) {
                 // Reordering within the same container
                 if(oldIndex === overIndex) return;
                finalIndex = overIndex; // Use the index dropped over
                newItems = arrayMove(newItems, oldIndex, finalIndex);
                successMessage = activeItem.is_folder ? "Folder reordered." : "Deck reordered.";
            } else if (!overIdResolved && targetContainerId === null && !activeItem.parent_id) {
                 // Reordering root by dropping in empty space (move to end)
                 const lastRootIndex = newItems.findLastIndex(item => !item.parent_id);
                 if (oldIndex === lastRootIndex) return;
                 finalIndex = lastRootIndex; // Target the last root position
                 newItems = arrayMove(newItems, oldIndex, finalIndex);
                 successMessage = activeItem.is_folder ? "Folder reordered." : "Deck reordered.";
            }
             else {
                 console.log("Drag end condition not met for update.");
                 return;
             }

            // --- Recalculate Positions ---
            const targetItems = newItems.filter(item => item.parent_id === targetContainerId);
            for (let i = 0; i < targetItems.length; i++) {
                const currentItem = targetItems[i];
                const prevItem = targetItems[i - 1];
                const nextItem = targetItems[i + 1];
                const calculatedPos = calculateNewPosition(prevItem?.position, nextItem?.position, i);
                if (currentItem.position !== calculatedPos || currentItem.id === activeId) {
                     updatesMap[currentItem.id] = { ...updatesMap[currentItem.id], position: calculatedPos };
                    const idxInNewItems = newItems.findIndex(it => it.id === currentItem.id);
                    if (idxInNewItems !== -1) newItems[idxInNewItems].position = calculatedPos;
                }
            }
             if (isMovingContainer && sourceContainerId !== null) {
                const sourceItems = newItems.filter(item => item.parent_id === sourceContainerId);
                 for (let i = 0; i < sourceItems.length; i++) {
                    const currentItem = sourceItems[i];
                    const prevItem = sourceItems[i - 1];
                    const nextItem = sourceItems[i + 1];
                    const calculatedPos = calculateNewPosition(prevItem?.position, nextItem?.position, i);
                    if (currentItem.position !== calculatedPos) {
                         updatesMap[currentItem.id] = { ...updatesMap[currentItem.id], position: calculatedPos };
                        const idxInNewItems = newItems.findIndex(it => it.id === currentItem.id);
                        if (idxInNewItems !== -1) newItems[idxInNewItems].position = calculatedPos;
                    }
                }
             }

            // Apply final local state
            setItems(newItems);

            // --- Update Database ---
            if (Object.keys(updatesMap).length > 0) {
                 // ... (misma lógica de promesas y manejo de error/éxito)
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
            setItems(initialItemsSnapshot); // Revertir
        }
   };


  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        {/* Header sin cambios */}
         <div> <h1 className="text-3xl font-bold">My Decks</h1> <p className="text-muted-foreground"> Manage your study flashcard decks </p> </div>
        <div className="flex items-center gap-2"> <Button variant={isEditMode ? "default" : "outline"} onClick={() => setIsEditMode((prev) => !prev)} > <Edit className="mr-2 h-4 w-4" /> {isEditMode ? "Done" : "Edit"} </Button> {isEditMode && <CreateFolderDialog onFolderCreated={() => router.refresh()} />} <CreateAIDeckDialog /> <CreateDeckDialog onDeckCreated={() => router.refresh()} /> </div>
      </div>

      {items.length === 0 && !isEditMode ? (
        /* Mensaje de dashboard vacío sin cambios */
         <div className="flex h-[60vh] flex-col items-center justify-center text-center"> <BookOpen className="mb-4 h-16 w-16 text-muted-foreground" /> <h2 className="text-2xl font-semibold">Your dashboard is empty</h2> <p className="mb-6 text-muted-foreground"> Create your first deck to get started. </p> <div className="flex gap-2"> <CreateDeckDialog onDeckCreated={() => router.refresh()} size="lg" /> <CreateAIDeckDialog /> </div> </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter} // <-- Volver a closestCenter
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          // --- AÑADIDO: Modificador para restringir al contenedor padre ---
          // Esto puede ayudar a que el movimiento se sienta menos "salvaje"
          // modifiers={[restrictToParentElement]} // Descomentar si es necesario
        >
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
                    // isDraggingOver se calcula internamente en FolderView con useDroppable
                    activeDragItem={activeDragItem}
                  />
                );
              })}

               {/* Contenedor Específico para Mazos Raíz */}
              <div id={ROOT_DECKS_CONTAINER_ID} key={ROOT_DECKS_CONTAINER_ID} className="root-decks-container">
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
                  {isEditMode && rootDecks.length === 0 && (
                     <div className="py-10 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg min-h-[100px] flex items-center justify-center"> {/* Añadido min-height */}
                        Decks outside folders will appear here.
                     </div>
                  )}
                </SortableContext>
              </div>

            </div>
          </SortableContext>

          {/* Área de drop en la raíz */}
          <div
            id={ROOT_DROPPABLE_ID}
            ref={setRootDroppableNodeRef}
            className={cn(
              "mt-12 rounded-lg border-2 border-dashed transition-colors duration-150 ease-out", // <-- Cambiado transition-all por transition-colors
              isEditMode ? "min-h-[120px] border-border p-6" : "min-h-0 border-transparent p-0",
              isEditMode && isOverRootArea && activeDragItem && !activeDragItem.is_folder && activeDragItem.parent_id && "border-primary bg-primary/5" // <-- Quitado ring
            )}
           >
            {isEditMode && (
              <p className="flex items-center justify-center h-full text-center text-sm text-muted-foreground pointer-events-none">
                Drop decks here to move them out of folders.
              </p>
            )}
          </div>

          <DragOverlay
             // --- AÑADIDO: Modificador para ajustar la posición del overlay (más centrado) ---
             modifiers={[(args) => {
                 const { transform } = args;
                 return {
                     ...transform,
                     // Ajusta x e y para que el cursor esté más cerca del centro del elemento arrastrado
                     // Puedes experimentar con estos valores
                     // x: transform.x - 50, // Ejemplo: Mover 50px a la izquierda
                     // y: transform.y - 20, // Ejemplo: Mover 20px hacia arriba
                 };
             }]}
             dropAnimation={null} // <-- Desactivar animación de drop para que parezca más instantáneo
          >
            {activeDragItem ? (
                 activeDragItem.is_folder ? (
                     <Card className="opacity-75 border-2 border-dashed border-muted-foreground bg-muted/30 shadow-lg"> {/* Añadido shadow */}
                        <CardHeader className="flex-row items-center gap-4 p-4">
                             <Folder className="h-6 w-6 text-muted-foreground" />
                             <CardTitle>{activeDragItem.name}</CardTitle>
                        </CardHeader>
                     </Card>
                 ) : (
                    // Añadir sombra al overlay del mazo
                    <div className="shadow-xl rounded-xl">
                      <DeckCard deck={activeDragItem} isEditMode={isEditMode} />
                    </div>
                 )
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Popup de bienvenida sin cambios */}
      <AlertDialog open={showWelcomePopup} onOpenChange={setShowWelcomePopup}>
        {/* ... */}
         <AlertDialogContent> <AlertDialogHeader> <AlertDialogTitle className="flex items-center gap-2"> <Info className="h-5 w-5 text-blue-500" /> Welcome to Memoria! </AlertDialogTitle> <AlertDialogDescription> Memoria helps you learn faster using spaced repetition. To get the most out of it, check out the Help page to discover all the features and how it works. </AlertDialogDescription> </AlertDialogHeader> <AlertDialogFooter> <AlertDialogCancel>Dismiss</AlertDialogCancel> <AlertDialogAction asChild> <Link href="/help">Go to Help Page</Link> </AlertDialogAction> </AlertDialogFooter> </AlertDialogContent>
      </AlertDialog>
    </>
  );
}