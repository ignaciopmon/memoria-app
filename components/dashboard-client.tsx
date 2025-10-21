// components/dashboard-client.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  useDroppable,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
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

// --- Componente FolderView (sin cambios respecto a la versión anterior) ---
function FolderView({
  folder,
  decks,
  isEditMode,
  onUpdate,
}: {
  folder: Item;
  decks: Item[];
  isEditMode: boolean;
  onUpdate: (updater: (prev: Item[]) => Item[]) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({
    id: folder.id,
    disabled: !isEditMode,
  });

  const folderColor = folder.color || "hsl(var(--border))";
  const setNodeRef = useMemo(() => setDroppableNodeRef, [setDroppableNodeRef]);

  // FIX: Solo no renderizar si NO está en modo edición Y está vacía Y NO está expandida
  if (!isEditMode && decks.length === 0 && !isExpanded) return null;

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
                  e.stopPropagation();
                  setIsRenaming(true);
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
                  );
                }}
              />
              <DeleteFolderDialog
                folder={folder}
                decksInFolder={decks}
                onDelete={(deletedIds) => {
                  onUpdate((prev) =>
                    prev.filter((it) => !deletedIds.includes(it.id))
                  );
                }}
              />
            </div>
          ) : (
             // Mostrar botón solo si hay mazos dentro o si estamos en modo edición (para coherencia visual)
            (decks.length > 0 || isEditMode) && (
                 <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
                    {isExpanded ? <ChevronDown /> : <ChevronRight />}
                 </Button>
            )
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
  );
}

// --- Componente DraggableDeckItem (sin cambios respecto a la versión anterior) ---
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
    setIsDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("decks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) {
      setIsDeleting(false); // Resetear solo en caso de error
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error sending deck to trash.",
      });
    } else {
      // Dejar que el padre (DashboardClient) maneje el re-renderizado
      onUpdate((prevItems) => prevItems.filter((i) => i.id !== item.id));
      toast({ title: "Success", description: "Deck moved to trash." });
      // No necesitamos setIsDeleting(false) aquí, el componente se desmontará o re-renderizará
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
              );
            }}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                title="Delete"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Move deck "{item.name}" to trash?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deck and its cards will be moved to the trash. You can restore them later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Move to Trash
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div
            {...listeners}
            {...attributes}
            className={`cursor-grab p-1 touch-none ${isDeleting ? 'cursor-not-allowed opacity-50' : ''}`} // Estilo si está borrando
            title="Move deck"
            style={{ touchAction: 'none' }}
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      )}
      <DeckCard deck={item} isEditMode={isEditMode} />
    </div>
  );
}

// ---- Componente Principal del Dashboard (Refactorizado v2) ----
export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  // Hooks siempre se llaman
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  useEffect(() => {
    // Ordenar y establecer items
    const sortedInitial = [...initialItems].sort((a, b) => {
      const posA = a.position ?? Infinity;
      const posB = b.position ?? Infinity;
      if (posA !== posB) return posA - posB;
      return (a.created_at && b.created_at) ? a.created_at.localeCompare(b.created_at) : 0;
    });
    setItems(sortedInitial);

    // Lógica del popup
    const hasSeenPopup = localStorage.getItem('hasSeenWelcomePopup');
    if (!hasSeenPopup && initialItems.length > 0) {
      setShowWelcomePopup(true);
      localStorage.setItem('hasSeenWelcomePopup', 'true');
    }
  }, [initialItems]);

  // useMemo siempre se llama
  const { folders, rootDecks, decksInFolders } = useMemo(() => {
    const foldersMap = new Map<string, Item>();
    const rootDecksList: Item[] = [];
    const decksInFoldersMap = new Map<string, Item[]>();
    // Usar el estado `items` directamente, ya que useEffect lo ordena inicialmente
    const currentItems = items; // Podrías re-ordenar aquí si fuera necesario en cada render

    for (const item of currentItems) {
      if (item.is_folder) {
        foldersMap.set(item.id, item);
        if (!decksInFoldersMap.has(item.id)) {
          decksInFoldersMap.set(item.id, []);
        }
      } else if (item.parent_id) {
        if (!decksInFoldersMap.has(item.parent_id)) {
          decksInFoldersMap.set(item.parent_id, []);
        }
        decksInFoldersMap.get(item.parent_id)!.push(item);
        // Opcional: Ordenar mazos dentro de carpetas si es relevante para la UI
        // decksInFoldersMap.get(item.parent_id)!.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
      } else {
        rootDecksList.push(item);
      }
    }
    // Ordenar carpetas y mazos raíz basados en 'position' o 'created_at' como fallback
    const sortedFolders = Array.from(foldersMap.values()).sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || (a.created_at && b.created_at ? a.created_at.localeCompare(b.created_at) : 0));
    const sortedRootDecks = rootDecksList.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || (a.created_at && b.created_at ? a.created_at.localeCompare(b.created_at) : 0));

    return { folders: sortedFolders, rootDecks: sortedRootDecks, decksInFolders: decksInFoldersMap };
  }, [items]);

  // useMemo siempre se llama
  const draggableItemIds = useMemo(() => items.filter(item => !item.is_folder).map(item => item.id), [items]);

  // --- Funciones Handler (sin cambios internos, solo usan el estado y lo actualizan) ---
  const handleDragStart = (event: DragStartEvent) => {
    // ... (sin cambios)
     if (!isEditMode) return
    const { active } = event
    const item = items.find((i) => i.id === active.id)
    if (item && !item.is_folder) {
      setActiveDragItem(item)
    } else {
      setActiveDragItem(null)
    }
  };
  const handleDragEnd = async (event: DragEndEvent) => {
    // ... (sin cambios lógicos internos, solo usa `items`, `folders`, `initialItems`)
     setActiveDragItem(null)
    const { active, over } = event
    const activeItem = items.find((item) => item.id === active.id)
    if (!activeItem || activeItem.is_folder || !over) return;
    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return
    const supabase = createClient()
    let dbUpdate: Partial<Item> = {} // Update for the dragged item specifically
    let newItems = [...items]
    let successMessage = ""
    let errorMessage = ""
    const isOverFolder = folders.some((f) => f.id === overId)
    const isOverRootArea = overId === 'root-drop-area';
    const overItem = items.find(item => item.id === overId);
    // isOverRootDeck: Check if dropping over a deck that is NOT in a folder
    const isOverRootDeck = overItem && !overItem.is_folder && !overItem.parent_id;
    const oldIndex = newItems.findIndex((item) => item.id === activeId)

    // Store updates for multiple items if reordering occurs
    const batchUpdates: { [id: string]: Partial<Item> } = {};

    try {
      // 1. Moving INTO a folder
      if (isOverFolder && activeItem.parent_id !== overId) {
        dbUpdate = { parent_id: overId, position: null }; // Reset position when moving into folder
        newItems = newItems.map(item => item.id === activeId ? { ...item, ...dbUpdate } : item);
        successMessage = "Deck moved into folder.";
        errorMessage = "Failed to move deck into folder.";
      }
      // 2. Moving OUT of a folder (to root area or over another root deck)
      else if (activeItem.parent_id && (isOverRootArea || isOverRootDeck)) {
         let targetIndex = -1;
         if (isOverRootDeck) {
             // Find the index of the item being dropped onto
             targetIndex = newItems.findIndex(item => item.id === overId);
         } else { // Dropping onto the root drop area
             // Find the index AFTER the last root item (folder or root deck)
             const lastRootIndex = newItems.findLastIndex(item => item.is_folder || !item.parent_id);
             targetIndex = lastRootIndex + 1;
         }

         // Update parent_id before moving for correct context
         const itemWithUpdatedParent = { ...activeItem, parent_id: null };
         newItems.splice(oldIndex, 1); // Remove from old position
         newItems.splice(targetIndex > oldIndex ? targetIndex -1 : targetIndex, 0, itemWithUpdatedParent); // Insert at new position

         // --- Recalculate positions ONLY for ROOT items ---
         const rootItemsAfterMove = newItems.filter(item => item.is_folder || !item.parent_id);
         for (let i = 0; i < rootItemsAfterMove.length; i++) {
             const currentItem = rootItemsAfterMove[i];
             const prevPos = rootItemsAfterMove[i - 1]?.position;
             const nextPos = rootItemsAfterMove[i + 1]?.position;
             const calculatedPos = calculateNewPosition(prevPos, nextPos, i);

             if (currentItem.position !== calculatedPos || currentItem.id === activeId) {
                // Ensure parent_id is null for root items being updated
                batchUpdates[currentItem.id] = { position: calculatedPos, parent_id: null };
                // Update newItems array immediately for next iteration's prevPos/nextPos
                const idxInNewItems = newItems.findIndex(it => it.id === currentItem.id);
                if (idxInNewItems > -1) {
                    newItems[idxInNewItems] = { ...newItems[idxInNewItems], position: calculatedPos, parent_id: null };
                }
             }
         }
         // Ensure the main dbUpdate for the moved item is captured if it was recalculated
         if (batchUpdates[activeId]) {
            dbUpdate = batchUpdates[activeId];
         } else {
             // If its position wasn't recalculated but it moved out, ensure parent_id is null
             dbUpdate = { parent_id: null, position: itemWithUpdatedParent.position }; // Keep existing position if not recalculated
             batchUpdates[activeId] = dbUpdate; // Add to batch
         }
         // --- End Recalculation ---

         successMessage = "Deck moved out of folder.";
         errorMessage = "Failed to move deck out of folder.";
      }
      // 3. Reordering within ROOT decks
       else if (!activeItem.parent_id && isOverRootDeck) {
         const targetIndex = newItems.findIndex(item => item.id === overId);
         if (oldIndex === targetIndex) return; // No change

         newItems = arrayMove(newItems, oldIndex, targetIndex);

          // --- Recalculate positions ONLY for ROOT items ---
         const rootItemsAfterMove = newItems.filter(item => item.is_folder || !item.parent_id);
         for (let i = 0; i < rootItemsAfterMove.length; i++) {
             const currentItem = rootItemsAfterMove[i];
             const prevPos = rootItemsAfterMove[i - 1]?.position;
             const nextPos = rootItemsAfterMove[i + 1]?.position;
             const calculatedPos = calculateNewPosition(prevPos, nextPos, i);

             if (currentItem.position !== calculatedPos) {
                batchUpdates[currentItem.id] = { position: calculatedPos, parent_id: null }; // parent_id should already be null
                // Update newItems array immediately
                const idxInNewItems = newItems.findIndex(it => it.id === currentItem.id);
                 if (idxInNewItems > -1) {
                    newItems[idxInNewItems] = { ...newItems[idxInNewItems], position: calculatedPos };
                }
             }
         }
         // Ensure the dragged item's update is captured
         if (batchUpdates[activeId]) {
             dbUpdate = batchUpdates[activeId];
         } else if (newItems.find(it=>it.id===activeId)?.position !== activeItem.position) {
             // If only the moved item's effective position changed but wasn't in batch
              const finalPos = newItems.find(it=>it.id===activeId)?.position;
              dbUpdate = { position: finalPos, parent_id: null };
              batchUpdates[activeId] = dbUpdate;
         }
         // --- End Recalculation ---

         successMessage = "Deck reordered.";
         errorMessage = "Failed to reorder deck.";
      } else {
        // Dropped in an invalid location (e.g., inside same folder, on root area when already root)
        return;
      }

      // Update local state IMMEDIATELY with the potentially reordered and position-updated array
      setItems(newItems);

      // --- Database Update ---
      if (Object.keys(batchUpdates).length > 0) {
        const updatePromises = Object.entries(batchUpdates).map(([id, updateData]) =>
            supabase.from("decks").update(updateData).eq("id", id)
        );

        const results = await Promise.all(updatePromises);
        const firstErrorResult = results.find(result => result.error);

        if (firstErrorResult) {
            throw new Error(errorMessage + ` (${firstErrorResult.error.message})`);
        } else {
            toast({ title: "Success", description: successMessage });
            // Refresh might still be needed if counts or other derived data changed server-side
            // Consider if router.refresh() is necessary based on what needs updating visually
             // router.refresh();
        }
      } else if (Object.keys(dbUpdate).length > 0 && !batchUpdates[activeId]) {
         // Handle cases where only the single dragged item needs updating (like moving into a folder)
          const { error } = await supabase.from("decks").update(dbUpdate).eq("id", activeId);
          if (error) {
              throw new Error(errorMessage + ` (${error.message})`);
          } else {
              toast({ title: "Success", description: successMessage });
              // router.refresh();
          }
      }
       else {
           console.warn("DragEnd handled but no DB update was needed for activeId:", activeId);
       }

    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message || "An error occurred." });
        // Revert UI to initial state on error
        const sortedInitial = [...initialItems].sort((a, b) => {
             const posA = a.position ?? Infinity;
             const posB = b.position ?? Infinity;
             if (posA !== posB) return posA - posB;
             return (a.created_at && b.created_at) ? a.created_at.localeCompare(b.created_at) : 0;
        });
        setItems(sortedInitial);
    }
  };

  const calculateNewPosition = (
    prevPos: number | null | undefined,
    nextPos: number | null | undefined,
    currentIndex: number
  ): number => {
    // ... (sin cambios)
     const BASE_INCREMENT = 1000;
    const MIN_POSITION = BASE_INCREMENT / 2; // Empezar con algo de espacio

    let newPos: number;

    if (prevPos == null && nextPos == null) {
      // Único elemento
      newPos = MIN_POSITION;
    } else if (prevPos == null) {
      // Mover al principio
      newPos = (nextPos ?? BASE_INCREMENT) / 2;
    } else if (nextPos == null) {
      // Mover al final
      newPos = prevPos + BASE_INCREMENT;
    } else {
      // Mover entre dos elementos
      newPos = (prevPos + nextPos) / 2;
    }

    // Manejo de colisiones o precisión insuficiente
    if (newPos <= (prevPos ?? 0) || newPos >= (nextPos ?? Infinity) || newPos === prevPos || newPos === nextPos) {
       console.warn("Potential position collision or precision issue, recalculating based on index as fallback.");
       newPos = (currentIndex + 1) * BASE_INCREMENT;
    }

    return Math.max(1, newPos);
  };

  // *** Renderizado principal ***
  return (
    <>
      {/* Header (sin cambios) */}
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

      {/* *** Lógica condicional movida aquí DENTRO del return *** */}
      {items.length === 0 && !isEditMode ? (
        // --- Renderizado cuando está vacío y NO en modo edición ---
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
      ) : (
        // --- Renderizado cuando HAY items O estamos en modo edición ---
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={draggableItemIds} strategy={rectSortingStrategy}>
            <div className="space-y-8">
              {/* Renderizar carpetas */}
              {folders.map((folder) => {
                const decksInCurrentFolder = decksInFolders.get(folder.id) || [];
                // Asegurarse de que FolderView maneje correctamente el caso de 0 decks
                return (
                  <FolderView
                    key={folder.id}
                    folder={folder}
                    decks={decksInCurrentFolder}
                    isEditMode={isEditMode}
                    onUpdate={setItems}
                  />
                );
              })}

              {/* Renderizar mazos raíz */}
              {rootDecks.length > 0 && (
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
              )}

              {/* Mensaje si está vacío PERO en modo edición */}
              {items.length === 0 && isEditMode && (
                <p className="text-center text-muted-foreground py-8">
                  Dashboard is empty. Add a deck or folder using the buttons above.
                </p>
              )}
            </div>
             {/* Área de drop en la raíz - visible en modo edición */}
            <div
                id="root-drop-area"
                ref={useDroppable({ id: 'root-drop-area', disabled: !isEditMode }).setNodeRef}
                 className={`min-h-20 mt-8 rounded-lg border-2 border-dashed transition-colors duration-300 ease-in-out ${
                    isEditMode
                    ? 'border-border hover:border-primary/50' // Visible y con feedback hover
                    : 'border-transparent' // Invisible si no está en modo edición
                 }`}
            >
                {isEditMode && (
                     <div className="flex items-center justify-center h-full">
                        <p className="p-4 text-center text-sm text-muted-foreground">
                            Drop decks here to move to root or reorder.
                        </p>
                     </div>
                 )}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeDragItem ? <DeckCard deck={activeDragItem} isEditMode /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Popup de bienvenida (sin cambios) */}
      <AlertDialog open={showWelcomePopup} onOpenChange={setShowWelcomePopup}>
        {/* ... contenido del AlertDialog ... */}
         <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" /> Welcome to Memoria!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Memoria helps you learn faster using spaced repetition.
              To get the most out of it, check out the Help page to discover all the features and how it works.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Dismiss</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link href="/help">Go to Help Page</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}