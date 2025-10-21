// components/dashboard-client.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  useDroppable,
  DragOverlay,
  closestCenter, // Usaremos closestCenter, pero la lógica de 'over' cambiará
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
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

// --- Componente FolderView (Sin cambios respecto a la versión anterior) ---
function FolderView({
  folder,
  decks,
  isEditMode,
  onUpdate,
  isDraggingOver,
}: {
  folder: Item;
  decks: Item[];
  isEditMode: boolean;
  onUpdate: (updater: (prev: Item[]) => Item[]) => void;
  isDraggingOver: boolean;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: folder.id,
    disabled: !isEditMode,
  });

  const folderColor = folder.color || "hsl(var(--border))";
  const setNodeRef = useMemo(() => setDroppableNodeRef, [setDroppableNodeRef]);

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
        className={cn(
          "transition-all duration-150 ease-out border-2",
          isEditMode && isDraggingOver ? "border-primary ring-2 ring-primary ring-offset-2 bg-primary/5" : `border-[${folderColor}]`,
          isEditMode && !isDraggingOver ? "hover:border-muted-foreground/50" : ""
        )}
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
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}><Edit className="h-4 w-4" /></Button>
              <ColorPopover itemId={folder.id} currentColor={folder.color} onColorChange={(color) => { onUpdate((prev) => prev.map((it) => it.id === folder.id ? { ...it, color } : it)); }} />
              <DeleteFolderDialog folder={folder} decksInFolder={decks} onDelete={(deletedIds) => { onUpdate((prev) => prev.filter((it) => !deletedIds.includes(it.id))); }} />
            </div>
          ) : (
            (decks.length > 0 || isEditMode) && (
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
                {isExpanded ? <ChevronDown /> : <ChevronRight />}
              </Button>
            )
          )}
        </CardHeader>
        {(isEditMode || isExpanded) && (
          <CardContent className={cn("pt-0", isEditMode ? "p-4 min-h-[80px]" : "p-4")}>
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

// --- Componente DraggableDeckItem (Sin cambios) ---
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
          <div {...listeners} {...attributes} className={`cursor-grab p-1 touch-none ${isDeleting ? 'cursor-not-allowed' : ''}`} title="Move deck" style={{ touchAction: 'none' }} > <GripVertical className="h-5 w-5 text-muted-foreground" /> </div>
        </div>
      )}
      <DeckCard deck={item} isEditMode={isEditMode} />
    </div>
  );
}

// ---- Componente Principal del Dashboard (handleDragEnd MODIFICADO) ----
export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  useEffect(() => {
    const sortedInitial = [...initialItems].sort((a, b) => {
      const posA = a.position ?? Infinity;
      const posB = b.position ?? Infinity;
      if (posA !== posB) return posA - posB;
      return (a.created_at && b.created_at) ? a.created_at.localeCompare(b.created_at) : 0;
    });
    setItems(sortedInitial);

    const hasSeenPopup = localStorage.getItem('hasSeenWelcomePopup');
    if (!hasSeenPopup && initialItems.length > 0) {
      setShowWelcomePopup(true);
      localStorage.setItem('hasSeenWelcomePopup', 'true');
    }
  }, [initialItems]);

  const { folders, rootDecks, decksInFolders } = useMemo(() => {
    const foldersMap = new Map<string, Item>();
    const rootDecksList: Item[] = [];
    const decksInFoldersMap = new Map<string, Item[]>();
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
      } else {
        rootDecksList.push(item);
      }
    }
    const sortedFolders = Array.from(foldersMap.values());
    return { folders: sortedFolders, rootDecks: rootDecksList, decksInFolders: decksInFoldersMap };
  }, [items]);

  const draggableItemIds = useMemo(() => items.filter(item => !item.is_folder).map(item => item.id), [items]);

  const handleDragStart = (event: DragStartEvent) => {
    if (!isEditMode) return;
    const { active } = event;
    const item = items.find((i) => i.id === active.id);
    if (item && !item.is_folder) {
      setActiveDragItem(item);
      setOverId(null);
    } else {
      setActiveDragItem(null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? over.id as string : null);
  };

  const { setNodeRef: setRootDroppableNodeRef, isOver: isOverRootArea } = useDroppable({
    id: 'root-drop-area',
    disabled: !isEditMode,
  });

  const calculateNewPosition = (
    prevPos: number | null | undefined,
    nextPos: number | null | undefined,
    currentIndex: number
  ): number => {
    const defaultIncrement = 1000;
    if (prevPos === null || prevPos === undefined) {
      return nextPos !== null && nextPos !== undefined ? nextPos / 2 : defaultIncrement * (currentIndex + 1);
    }
    if (nextPos === null || nextPos === undefined) {
      return prevPos + defaultIncrement;
    }
    return prevPos + (nextPos - prevPos) / 2;
  };

  // --- handleDragEnd MODIFICADO ---
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveDragItem(null);
    setOverId(null); // Reset visual state regardless of outcome

    const activeItem = items.find((item) => item.id === active.id);

    // Basic validation
    if (!activeItem || activeItem.is_folder || !over || active.id === over.id) {
      return;
    }

    const activeId = active.id as string;
    const overIdResolved = over.id as string;
    const supabase = createClient();
    let newItems = [...items];
    let successMessage = "";
    let errorMessage = "";
    const updatesMap: Record<string, { position: number | null; parent_id: string | null }> = {};
    const oldIndex = newItems.findIndex((item) => item.id === activeId);

    // Determine the target: is it a folder, the root area, or another root deck?
    const isOverFolder = folders.some((f) => f.id === overIdResolved);
    const overItem = items.find((item) => item.id === overIdResolved);
    const isOverRootDeck = Boolean(overItem && !overItem.is_folder && !overItem.parent_id);

    // --- NUEVA LÓGICA DE DETECCIÓN DE DESTINO ---
    // Consideramos que el destino es la raíz si:
    // 1. Se suelta explícitamente sobre 'root-drop-area'.
    // 2. Se suelta sobre un mazo que ya está en la raíz.
    // 3. Se suelta sobre un elemento (`overItem`) que NO es una carpeta Y NO es un mazo dentro de la misma carpeta de origen del item activo.
    const isMovingToRoot = isOverRootDropArea || isOverRootDeck ||
                           (overItem && !overItem.is_folder && activeItem.parent_id && overItem.parent_id !== activeItem.parent_id);

    // --- FIN NUEVA LÓGICA ---


    try {
      // Caso 1: Mover a una carpeta diferente
      if (isOverFolder && activeItem.parent_id !== overIdResolved) {
        newItems[oldIndex] = { ...activeItem, parent_id: overIdResolved, position: null };
        updatesMap[activeId] = { parent_id: overIdResolved, position: null };
        successMessage = "Deck moved into folder.";
        errorMessage = "Failed to move deck into folder.";
      }
      // Caso 2: Mover desde una carpeta hacia la raíz
      else if (activeItem.parent_id && isMovingToRoot) {
        let targetIndex = -1;

        // Si se suelta sobre un deck raíz específico, usar su índice como referencia
        if (isOverRootDeck) {
          targetIndex = newItems.findIndex((item) => item.id === overIdResolved);
        } else {
          // Si se suelta en el área general raíz (o sobre un elemento que no es carpeta/deck_raiz),
          // encontrar el índice del último elemento raíz (carpeta o deck sin parent) para colocarlo después.
          const lastRootIndex = newItems.findLastIndex((item) => item.is_folder || !item.parent_id);
           // Si el índice original era menor o igual al último índice raíz,
           // el nuevo índice es después del último raíz actual.
           // Si era mayor (un mazo en una carpeta al final), el targetIndex debería ser justo después del último raíz.
           targetIndex = lastRootIndex + 1;

        }

        // Mueve el elemento en el array local y actualiza su parent_id
        const movedItem = { ...newItems[oldIndex], parent_id: null };
        newItems.splice(oldIndex, 1);
        targetIndex = Math.max(0, Math.min(targetIndex, newItems.length)); // Asegurar límites
        newItems.splice(targetIndex, 0, movedItem);

        // Recalcular posiciones solo para elementos raíz
        const rootItemsAfterMove = newItems.filter((item) => item.is_folder || !item.parent_id);
        for (let i = 0; i < rootItemsAfterMove.length; i++) {
          const currentItem = rootItemsAfterMove[i];
          const prevItem = rootItemsAfterMove[i - 1];
          const nextItem = rootItemsAfterMove[i + 1];
          const calculatedPos = calculateNewPosition(prevItem?.position, nextItem?.position, i);
          if (currentItem.id === activeId || currentItem.position !== calculatedPos) {
            updatesMap[currentItem.id] = { position: calculatedPos, parent_id: null };
          }
        }
        // Aplicar localmente
        newItems = newItems.map((item) => updatesMap[item.id] ? { ...item, position: updatesMap[item.id].position } : item);

        successMessage = "Deck moved out of folder.";
        errorMessage = "Failed to move deck out of folder.";
      }
      // Caso 3: Reordenar dentro de la raíz (solo si se suelta sobre otro deck raíz)
      else if (!activeItem.parent_id && isOverRootDeck) {
        const targetIndex = newItems.findIndex((item) => item.id === overIdResolved);
        if (oldIndex === targetIndex) return; // No hay cambio

        newItems = arrayMove(newItems, oldIndex, targetIndex);

        // Recalcular posiciones para todos los elementos raíz
        const rootItemsAfterMove = newItems.filter((item) => item.is_folder || !item.parent_id);
        for (let i = 0; i < rootItemsAfterMove.length; i++) {
          const currentItem = rootItemsAfterMove[i];
          const prevItem = rootItemsAfterMove[i - 1];
          const nextItem = rootItemsAfterMove[i + 1];
          const calculatedPos = calculateNewPosition(prevItem?.position, nextItem?.position, i);
          if (currentItem.position !== calculatedPos) {
             updatesMap[currentItem.id] = { position: calculatedPos, parent_id: null };
          }
        }
         // Aplicar localmente
        newItems = newItems.map((item) => updatesMap[item.id] ? { ...item, position: updatesMap[item.id].position } : item);

        successMessage = "Deck reordered.";
        errorMessage = "Failed to reorder deck.";
      }
      // Caso 4: Reordenar dentro de la MISMA carpeta (si 'over' es un mazo en la misma carpeta)
       else if (activeItem.parent_id && overItem && !overItem.is_folder && overItem.parent_id === activeItem.parent_id) {
           // Lógica de reordenamiento DENTRO de la carpeta (si la necesitas).
           // Por ahora, no haremos nada para mantenerlo simple, ya que DndKit maneja el orden visual dentro del SortableContext de la carpeta si lo implementas así.
           // Si necesitas guardar el orden en la BD, tendrías que recalcular 'position' para los items de esa carpeta aquí.
           // console.log("Reordering within the same folder - no DB action implemented yet.");
           return; // Salir sin hacer cambios en la BD por ahora
       }
      else {
        // Soltado en un lugar no válido o sin cambio funcional
        // console.log("Drop target not valid or no change needed.");
        return;
      }

      // Actualizar estado local
      setItems(newItems);

      // Enviar actualizaciones a BD
      if (Object.keys(updatesMap).length > 0) {
        const updatePromises = Object.entries(updatesMap).map(([id, updateData]) =>
          supabase.from("decks").update({ position: updateData.position, parent_id: updateData.parent_id }).eq("id", id)
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
      // Revertir
      const sortedInitial = [...initialItems].sort((a, b) => {
        const posA = a.position ?? Infinity; const posB = b.position ?? Infinity;
        if (posA !== posB) return posA - posB;
        return a.created_at && b.created_at ? a.created_at.localeCompare(b.created_at) : 0;
      });
      setItems(sortedInitial);
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
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Contenedor principal para toda el área arrastrable */}
          <div className="space-y-8">
            {/* Renderizar carpetas y sus contenidos */}
            {folders.map((folder) => {
              const decksInCurrentFolder = decksInFolders.get(folder.id) || [];
              // Usar SortableContext *dentro* de cada carpeta si quieres reordenar dentro de ellas
              return (
                 <SortableContext key={folder.id} items={decksInCurrentFolder.map(d => d.id)} strategy={rectSortingStrategy}>
                    <FolderView
                        folder={folder}
                        decks={decksInCurrentFolder}
                        isEditMode={isEditMode}
                        onUpdate={setItems}
                        isDraggingOver={overId === folder.id}
                    />
                 </SortableContext>
              );
            })}

            {/* Renderizar mazos raíz */}
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
            </SortableContext>

             {/* Área de drop en la raíz */}
            <div
              id="root-drop-area"
              ref={setRootDroppableNodeRef}
              className={cn(
                "mt-8 rounded-lg border-2 border-dashed transition-all duration-150 ease-out",
                isEditMode ? "min-h-[100px] border-border p-6" : "min-h-0 border-transparent p-0",
                isEditMode && isDraggingOver && activeDragItem?.parent_id && "border-primary ring-2 ring-primary ring-offset-2 bg-primary/5" // Solo resaltar si vienes de una carpeta
              )}
            >
              {isEditMode && (
                <p className="p-4 text-center text-sm text-muted-foreground pointer-events-none">
                  Drop decks here to move them out of folders.
                </p>
              )}
            </div>
          </div>


          <DragOverlay>
            {activeDragItem ? <DeckCard deck={activeDragItem} isEditMode={isEditMode} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Popup de bienvenida sin cambios */}
      <AlertDialog open={showWelcomePopup} onOpenChange={setShowWelcomePopup}>
        <AlertDialogContent> <AlertDialogHeader> <AlertDialogTitle className="flex items-center gap-2"> <Info className="h-5 w-5 text-blue-500" /> Welcome to Memoria! </AlertDialogTitle> <AlertDialogDescription> Memoria helps you learn faster using spaced repetition. To get the most out of it, check out the Help page to discover all the features and how it works. </AlertDialogDescription> </AlertDialogHeader> <AlertDialogFooter> <AlertDialogCancel>Dismiss</AlertDialogCancel> <AlertDialogAction asChild> <Link href="/help">Go to Help Page</Link> </AlertDialogAction> </AlertDialogFooter> </AlertDialogContent>
      </AlertDialog>
    </>
  );
}