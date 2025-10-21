// components/dashboard-client.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  useDroppable,
  DragOverlay,
  closestCenter, // Mantendremos esta estrategia por ahora, es bastante estándar
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent, // Importar DragOverEvent
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
import { cn } from "@/lib/utils"; // Importar cn

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

// --- Componente FolderView (MODIFICADO) ---
function FolderView({
  folder,
  decks,
  isEditMode,
  onUpdate,
  isDraggingOver, // <-- NUEVO: Prop para saber si se arrastra sobre esta carpeta
}: {
  folder: Item;
  decks: Item[];
  isEditMode: boolean;
  onUpdate: (updater: (prev: Item[]) => Item[]) => void;
  isDraggingOver: boolean; // <-- NUEVO
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { setNodeRef: setDroppableNodeRef } = useDroppable({ // Quitamos isOver de aquí, lo recibimos por props
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
        // --- MODIFICACIÓN: Estilo más evidente al arrastrar encima ---
        className={cn(
          "transition-all duration-150 ease-out border-2", // Mantenemos la transición
          isEditMode && isDraggingOver ? "border-primary ring-2 ring-primary ring-offset-2 bg-primary/5" : `border-[${folderColor}]`, // Estilo resaltado
          isEditMode && !isDraggingOver ? "hover:border-muted-foreground/50" : "" // Ligero hover si no se arrastra encima
        )}
      // --- FIN MODIFICACIÓN ---
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
              {/* Botones de editar, color, borrar (sin cambios) */}
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
          // --- MODIFICACIÓN: Añadir padding extra en modo edición para mejorar el área de drop ---
          <CardContent className={cn("pt-0", isEditMode ? "p-4 min-h-[80px]" : "p-4")}>
            {/* --- FIN MODIFICACIÓN --- */}
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


// ---- Componente Principal del Dashboard (Refactorizado + MODIFICADO) ----
export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  // --- NUEVO: Estado para saber sobre qué se está arrastrando ---
  const [overId, setOverId] = useState<string | null>(null);
  // --- FIN NUEVO ---

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Un umbral pequeño para iniciar el arrastre
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
    // ... (lógica de agrupación sin cambios) ...
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
      setOverId(null); // Resetea overId al empezar a arrastrar
    } else {
      setActiveDragItem(null);
    }
  };

  // --- NUEVO: handleDragOver para actualizar sobre qué se está arrastrando ---
  const handleDragOver = (event: DragOverEvent) => { // Cambiado a DragOverEvent
    const { over } = event;
    setOverId(over ? over.id as string : null);
  };
  // --- FIN NUEVO ---

  // Nuevo hook para el área de drop en la raíz (mover hook fuera del JSX)
  const { setNodeRef: setRootDroppableNodeRef, isOver: isOverRootArea } = useDroppable({ // Añadimos isOver
    id: 'root-drop-area',
    disabled: !isEditMode,
  });


  // Función auxiliar para calcular nueva posición (sin cambios)
  const calculateNewPosition = (
    prevPos: number | null | undefined,
    nextPos: number | null | undefined,
    currentIndex: number
  ): number => {
    const defaultIncrement = 1000;
    if (prevPos === null || prevPos === undefined) {
      // Si es el primer elemento
      return nextPos !== null && nextPos !== undefined ? nextPos / 2 : defaultIncrement * (currentIndex + 1);
    }
    if (nextPos === null || nextPos === undefined) {
      // Si es el último elemento
      return prevPos + defaultIncrement;
    }
    // Si está en medio
    return prevPos + (nextPos - prevPos) / 2;
  };


  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    // Resetea los estados visuales independientemente del resultado
    setActiveDragItem(null);
    setOverId(null);

    const activeItem = items.find((item) => item.id === active.id);

    // Salir si no hay item activo, es una carpeta, no hay destino, o el destino es el mismo origen
    if (!activeItem || activeItem.is_folder || !over || active.id === over.id) {
      return;
    }

    const activeId = active.id as string;
    const overIdResolved = over.id as string; // Renombramos para claridad
    const supabase = createClient();
    let newItems = [...items];
    let successMessage = "";
    let errorMessage = "";

    const isOverFolder = folders.some((f) => f.id === overIdResolved);
    const isOverRootDropArea = overIdResolved === 'root-drop-area'; // Usar la variable renombrada
    const overItem = items.find((item) => item.id === overIdResolved);
    // Un elemento se considera 'root deck' si no es carpeta y no tiene parent_id
    const isOverRootDeck = Boolean(overItem && !overItem.is_folder && !overItem.parent_id);

    // Índice original del elemento que se está moviendo
    const oldIndex = newItems.findIndex((item) => item.id === activeId);

    // Mapa de actualizaciones a enviar a la BD
    const updatesMap: Record<string, { position: number | null; parent_id: string | null }> = {};

    try {
      // Caso 1: Mover a una carpeta (y no estaba ya en ella)
      if (isOverFolder && activeItem.parent_id !== overIdResolved) {
        // Actualiza el parent_id localmente
        newItems[oldIndex] = { ...activeItem, parent_id: overIdResolved, position: null };
        updatesMap[activeId] = { parent_id: overIdResolved, position: null }; // Solo necesita actualizar el item movido
        successMessage = "Deck moved into folder.";
        errorMessage = "Failed to move deck into folder.";
      }
      // Caso 2: Mover desde una carpeta a la raíz (ya sea al área de drop o sobre otro deck raíz)
      else if (activeItem.parent_id && (isOverRootDropArea || isOverRootDeck)) {
        let targetIndex = -1; // Índice donde se insertará en la lista `newItems`

        // Si se suelta sobre otro deck raíz, encontrar su índice
        if (isOverRootDeck) {
           targetIndex = newItems.findIndex((item) => item.id === overIdResolved);
           // Si el índice del destino es mayor que el origen (después de quitar el parent_id), ajustar
           // Esto es necesario porque al quitar el parent_id, el array se reordena antes de arrayMove
           const tempItems = newItems.map(item => item.id === activeId ? {...item, parent_id: null} : item);
           const tempOldIndex = tempItems.findIndex(item => item.id === activeId);

           // Ajuste crucial: Si movemos hacia abajo, el targetIndex efectivo disminuye en 1
           // porque el elemento movido 'desaparece' temporalmente de una posición anterior.
           if (targetIndex > tempOldIndex) {
              targetIndex = targetIndex; // Corrección: El índice encontrado es correcto en este caso
           } else {
             // Si movemos hacia arriba o en la misma posición relativa (aunque cambie el índice absoluto),
             // el findIndex ya nos da la posición correcta donde insertar.
             targetIndex = targetIndex;
           }


        } else { // Si se suelta en el área raíz, ponerlo al final de los elementos raíz
          const lastRootIndex = newItems.findLastIndex((item) => item.is_folder || !item.parent_id);
          targetIndex = lastRootIndex + 1;
        }

        // Mueve el elemento en el array local y actualiza su parent_id
        const movedItem = { ...newItems[oldIndex], parent_id: null };
        newItems.splice(oldIndex, 1); // Quita el item de su posición original
        // Asegurarse de que el targetIndex esté dentro de los límites
        targetIndex = Math.max(0, Math.min(targetIndex, newItems.length));
        newItems.splice(targetIndex, 0, movedItem); // Inserta el item en la nueva posición


        // Recalcular posiciones solo para elementos raíz (carpetas o decks sin parent_id)
        const rootItemsAfterMove = newItems.filter((item) => item.is_folder || !item.parent_id);
        for (let i = 0; i < rootItemsAfterMove.length; i++) {
          const currentItem = rootItemsAfterMove[i];
          const prevItem = rootItemsAfterMove[i - 1];
          const nextItem = rootItemsAfterMove[i + 1];
          const calculatedPos = calculateNewPosition(prevItem?.position, nextItem?.position, i);

          // Añadir al mapa de actualizaciones si la posición cambió o si es el item movido
          if (currentItem.id === activeId || currentItem.position !== calculatedPos) {
            updatesMap[currentItem.id] = { position: calculatedPos, parent_id: currentItem.parent_id }; // Asegurar parent_id null
          }
        }

        // Aplicar posiciones actualizadas localmente
         newItems = newItems.map((item) =>
          updatesMap[item.id] ? { ...item, position: updatesMap[item.id].position } : item
        );


        successMessage = "Deck moved out of folder.";
        errorMessage = "Failed to move deck out of folder.";
      }
      // Caso 3: Reordenar dentro de la raíz (solo si se suelta sobre otro deck raíz)
      else if (!activeItem.parent_id && isOverRootDeck) {
        const targetIndex = newItems.findIndex((item) => item.id === overIdResolved);

        if (oldIndex === targetIndex) return; // No hay cambio de posición

        // Mueve el elemento en el array local
        newItems = arrayMove(newItems, oldIndex, targetIndex);

        // Recalcular posiciones para todos los elementos raíz
        const rootItemsAfterMove = newItems.filter((item) => item.is_folder || !item.parent_id);
        for (let i = 0; i < rootItemsAfterMove.length; i++) {
          const currentItem = rootItemsAfterMove[i];
          const prevItem = rootItemsAfterMove[i - 1];
          const nextItem = rootItemsAfterMove[i + 1];
          const calculatedPos = calculateNewPosition(prevItem?.position, nextItem?.position, i);

          // Actualizar si la posición cambió
          if (currentItem.position !== calculatedPos) {
            updatesMap[currentItem.id] = { position: calculatedPos, parent_id: currentItem.parent_id }; // parent_id sigue siendo null
          }
        }

        // Aplicar posiciones actualizadas localmente
         newItems = newItems.map((item) =>
          updatesMap[item.id] ? { ...item, position: updatesMap[item.id].position } : item
        );

        successMessage = "Deck reordered.";
        errorMessage = "Failed to reorder deck.";
      } else {
        // No hacer nada si se suelta en un área inválida o no hay cambio real
        return;
      }

      // Actualizar el estado local inmediatamente para feedback visual rápido
      setItems(newItems);

      // Enviar las actualizaciones necesarias a la base de datos
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
      } else {
        // Esto podría pasar si el cálculo de posición no genera cambios, lo cual es normal
        // console.log("DragEnd handled, but no database updates were needed.");
      }

    } catch (error: any) {
      console.error("Error during drag end:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "An error occurred during the update." });
      // Revertir al estado inicial ordenado en caso de error
      const sortedInitial = [...initialItems].sort((a, b) => {
        const posA = a.position ?? Infinity;
        const posB = b.position ?? Infinity;
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
          collisionDetection={closestCenter} // Podríamos probar otras como `rectIntersection` si `closestCenter` no funciona bien con áreas grandes
          onDragStart={handleDragStart}
          onDragOver={handleDragOver} // <-- NUEVO: Añadir handler para onDragOver
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
                    isDraggingOver={overId === folder.id} // <-- NUEVO: Pasar el estado
                  />
                );
              })}
              {/* --- MODIFICACIÓN: Envolver rootDecks en un div para SortableContext funcione correctamente --- */}
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
               {/* --- FIN MODIFICACIÓN --- */}
            </div>
            {/* Área de drop en la raíz (MODIFICADA) */}
            <div
              id="root-drop-area"
              ref={setRootDroppableNodeRef} // Usar el ref del hook
              // --- MODIFICACIÓN: Estilo más evidente y padding mayor ---
              className={cn(
                "mt-8 rounded-lg border-2 border-dashed transition-all duration-150 ease-out",
                isEditMode ? "min-h-[100px] border-border p-6" : "min-h-0 border-transparent p-0", // Visible y con padding solo en modo edición
                isEditMode && isOverRootArea && "border-primary ring-2 ring-primary ring-offset-2 bg-primary/5" // Estilo resaltado al arrastrar encima
              )}
            // --- FIN MODIFICACIÓN ---
            >
              {isEditMode && (
                <p className="p-4 text-center text-sm text-muted-foreground pointer-events-none"> {/* Añadido pointer-events-none para asegurar que el drop sea en el div principal */}
                  Drop decks here to move them out of folders or reorder root decks.
                </p>
              )}
            </div>
          </SortableContext>
          <DragOverlay>
            {/* Overlay sin cambios */}
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