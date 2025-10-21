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

// --- Componente FolderView (sin cambios) ---
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

  // FIX: Solo no renderizar si NO está en modo edición Y está vacía
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
             // Mostrar botón solo si hay mazos o está en modo edición
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

// --- Componente DraggableDeckItem (sin cambios) ---
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
            className={`cursor-grab p-1 touch-none ${isDeleting ? 'cursor-not-allowed' : ''}`}
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

// ---- Componente Principal del Dashboard (Refactorizado) ----
export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  // *** Hooks siempre se llaman ***
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

  // *** useMemo siempre se llama ***
  const { folders, rootDecks, decksInFolders } = useMemo(() => {
    const foldersMap = new Map<string, Item>();
    const rootDecksList: Item[] = [];
    const decksInFoldersMap = new Map<string, Item[]>();
    // Ordenar items aquí dentro si es necesario, o basarse en el estado `items` ya ordenado
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
        foldersMap.set(item.id, item);
        if (!decksInFoldersMap.has(item.id)) {
          decksInFoldersMap.set(item.id, []);
        }
      } else if (item.parent_id) {
        if (!decksInFoldersMap.has(item.parent_id)) {
          decksInFoldersMap.set(item.parent_id, []);
        }
        decksInFoldersMap.get(item.parent_id)!.push(item);
        // Ordenar mazos dentro de carpetas si es necesario
        // decksInFoldersMap.get(item.parent_id)!.sort(...);
      } else {
        rootDecksList.push(item);
      }
    }
    const sortedFolders = Array.from(foldersMap.values())//.sort(/* Criterio de ordenación para carpetas */);
    return { folders: sortedFolders, rootDecks: rootDecksList, decksInFolders: decksInFoldersMap };
  }, [items]);

  // *** useMemo siempre se llama ***
  const draggableItemIds = useMemo(() => items.filter(item => !item.is_folder).map(item => item.id), [items]);

  // Funciones handler (sin cambios internos significativos, solo llamadas a setState)
   const handleDragStart = (event: DragStartEvent) => {
     if (!isEditMode) return
    const { active } = event
    const item = items.find((i) => i.id === active.id)
    if (item && !item.is_folder) {
      setActiveDragItem(item)
    } else {
      setActiveDragItem(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
     setActiveDragItem(null)
    const { active, over } = event
    const activeItem = items.find((item) => item.id === active.id)
    if (!activeItem || activeItem.is_folder || !over) return;
    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return
    const supabase = createClient()
    let dbUpdate: Partial<Item> = {}
    let newItems = [...items]
    let successMessage = ""
    let errorMessage = ""
    const isOverFolder = folders.some((f) => f.id === overId)
    const isOverRootArea = overId === 'root-drop-area';
    const overItem = items.find(item => item.id === overId);
    const isOverRootDeck = overItem && !overItem.is_folder && !overItem.parent_id;
    const oldIndex = newItems.findIndex((item) => item.id === activeId)

    try {
      if (isOverFolder && activeItem.parent_id !== overId) {
        newItems[oldIndex] = { ...activeItem, parent_id: overId, position: null };
        dbUpdate = { parent_id: overId, position: null };
        successMessage = "Deck moved into folder.";
        errorMessage = "Failed to move deck into folder.";
      }
      else if (activeItem.parent_id && (isOverRootArea || isOverRootDeck)) {
         let newIndex = -1;
         if (isOverRootDeck) {
             newIndex = newItems.findIndex(item => item.id === overId);
         } else {
             // Encuentra el índice del último elemento raíz (carpeta o mazo raíz)
             const lastRootIndex = newItems.findLastIndex(item => item.is_folder || !item.parent_id);
             newIndex = lastRootIndex + 1;
         }
         
         // Actualizar parent_id antes de mover para el cálculo correcto
         newItems = newItems.map(item => item.id === activeId ? { ...item, parent_id: null } : item);
         const oldIndexAfterParentUpdate = newItems.findIndex((item) => item.id === activeId); // Re-buscar índice por si acaso

         newItems = arrayMove(newItems, oldIndexAfterParentUpdate, newIndex);
         
         // Recalcular posiciones solo para los elementos raíz
         const rootItemsAfterMove = newItems.filter(item => item.is_folder || !item.parent_id);
         const updatedPositions: { [id: string]: { position: number, parent_id: string | null } } = {};
         
         for (let i = 0; i < rootItemsAfterMove.length; i++) {
             const prevPos = rootItemsAfterMove[i - 1]?.position;
             const nextPos = rootItemsAfterMove[i + 1]?.position;
             const currentItem = rootItemsAfterMove[i];
             const calculatedPos = calculateNewPosition(prevPos, nextPos, i);
             
             // Marcar para actualización si es el item movido o si su posición calculada es diferente
             if(currentItem.id === activeId || currentItem.position !== calculatedPos) {
                  updatedPositions[currentItem.id] = { position: calculatedPos, parent_id: currentItem.parent_id }; // Usar parent_id null aquí
             }
         }

        newItems = newItems.map(item => {
             if (updatedPositions[item.id] !== undefined) {
                 if (item.id === activeId) {
                     dbUpdate = { parent_id: null, position: updatedPositions[activeId].position };
                 }
                 return { ...item, position: updatedPositions[item.id].position, parent_id: updatedPositions[item.id].parent_id };
             }
             return item;
         });
        successMessage = "Deck moved out of folder.";
        errorMessage = "Failed to move deck out of folder.";
      }
       else if (!activeItem.parent_id && isOverRootDeck) {
         const newIndex = newItems.findIndex(item => item.id === overId);
         if (oldIndex === newIndex) return; // No hay cambio real
         
         newItems = arrayMove(newItems, oldIndex, newIndex);

         // Recalcular posiciones solo para los elementos raíz
         const rootItemsAfterMove = newItems.filter(item => item.is_folder || !item.parent_id);
         const updatedPositions: { [id: string]: { position: number, parent_id: string | null } } = {};

         for (let i = 0; i < rootItemsAfterMove.length; i++) {
             const prevPos = rootItemsAfterMove[i - 1]?.position;
             const nextPos = rootItemsAfterMove[i + 1]?.position;
             const currentItem = rootItemsAfterMove[i];
             const calculatedPos = calculateNewPosition(prevPos, nextPos, i);

             if(currentItem.id === activeId || currentItem.position !== calculatedPos) {
                  updatedPositions[currentItem.id] = { position: calculatedPos, parent_id: currentItem.parent_id };
             }
         }

         dbUpdate = updatedPositions[activeId] || {}; // Update para el item movido
         
         newItems = newItems.map(item => {
             if (updatedPositions[item.id] !== undefined) {
                 return { ...item, position: updatedPositions[item.id].position, parent_id: updatedPositions[item.id].parent_id };
             }
             return item;
         });
         successMessage = "Deck reordered.";
         errorMessage = "Failed to reorder deck.";
      } else {
        // No hacer nada si se suelta sobre sí mismo o en un área no válida dentro de su contexto actual
        return;
      }
      
      // Actualizar estado local inmediatamente
      setItems(newItems);

      // --- Actualización de la Base de Datos ---
      if (Object.keys(dbUpdate).length > 0) {
        const updatePromises = Object.entries(updatedPositions).map(([id, updateData]) =>
            supabase.from("decks").update({ position: updateData.position, parent_id: updateData.parent_id }).eq("id", id)
        );
        // Asegurarse de que el elemento arrastrado se actualiza si no estaba en updatedPositions
        if (!updatedPositions[activeId] && Object.keys(dbUpdate).length > 0) {
             updatePromises.push(supabase.from("decks").update(dbUpdate).eq("id", activeId));
        }

        const results = await Promise.all(updatePromises);
        const firstError = results.find(result => result.error);

        if (firstError) {
            throw new Error(errorMessage + ` (${firstError.error.message})`);
        } else {
            toast({ title: "Success", description: successMessage });
             // No es necesario llamar a router.refresh() si la UI ya está actualizada
        }
      } else {
          console.warn("DragEnd handled but no DB update was generated for activeId:", activeId);
          // Si no hay dbUpdate pero sí hubo movimiento local (arrayMove),
          // podría indicar un error lógico o un caso no manejado.
          // Considera revertir el estado local si es necesario.
      }

    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message || "An error occurred." });
        // Revertir al estado inicial ordenado en caso de error
        const sortedInitial = [...initialItems].sort((a, b) => {
             const posA = a.position ?? Infinity;
             const posB = b.position ?? Infinity;
             if (posA !== posB) return posA - posB;
             return (a.created_at && b.created_at) ? a.created_at.localeCompare(b.created_at) : 0;
        });
        setItems(sortedInitial);
    }
  }

  const calculateNewPosition = (
      prevPos: number | null | undefined,
      nextPos: number | null | undefined,
      currentIndex: number // El índice DESPUÉS de mover el elemento
  ): number => {
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
       // Fallback simple: usar índice * incremento. Necesitará reordenar más elementos.
       // O podrías implementar una lógica más compleja para reasignar posiciones alrededor.
       newPos = (currentIndex + 1) * BASE_INCREMENT;
    }


    // Asegurar que la posición sea al menos 1 (o un mínimo positivo)
    return Math.max(1, newPos);
  };

  // *** Renderizado condicional DENTRO del return ***
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

      {items.length === 0 && !isEditMode ? (
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
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={draggableItemIds} strategy={rectSortingStrategy}>
            <div className="space-y-8">
                {folders.map((folder) => {
                const decksInCurrentFolder = decksInFolders.get(folder.id) || [];
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
            {/* Área de drop en la raíz */}
            <div
                id="root-drop-area"
                ref={useDroppable({ id: 'root-drop-area', disabled: !isEditMode }).setNodeRef}
                className={`min-h-10 mt-8 rounded-md border-2 border-dashed transition-colors ${isEditMode ? 'border-border' : 'border-transparent'}`} // Estilo visible en modo edición
            >
                {isEditMode && (
                     <p className="p-4 text-center text-sm text-muted-foreground">
                        Drop decks here to move them out of folders or reorder root decks.
                     </p>
                 )}
            </div>
            </SortableContext>
            <DragOverlay>
            {activeDragItem ? <DeckCard deck={activeDragItem} isEditMode /> : null}
            </DragOverlay>
        </DndContext>
       )}

      <AlertDialog open={showWelcomePopup} onOpenChange={setShowWelcomePopup}>
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