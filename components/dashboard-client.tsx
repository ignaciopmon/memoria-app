// components/dashboard-client.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  useDroppable,
  DragOverlay,
  // --- MODIFICACIÓN: Cambiar a closestCorners para mejorar la detección de carpetas ---
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  verticalListSortingStrategy, // <-- NUEVO: Usar esta estrategia para la lista principal (carpetas y mazos raíz)
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

// --- Componente FolderView (MODIFICADO para usar SortableContext para sus decks) ---
function FolderView({
  folder,
  decks,
  isEditMode,
  onUpdate,
  isDraggingOver, // Se mantiene para el resaltado visual
  activeDragItem, // Añadido para lógica de drop
}: {
  folder: Item;
  decks: Item[];
  isEditMode: boolean;
  onUpdate: (updater: (prev: Item[]) => Item[]) => void;
  isDraggingOver: boolean;
  activeDragItem: Item | null; // <-- NUEVO
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true); // <-- Expandido por defecto en modo edición

  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef, // <-- Ref para el elemento carpeta (arrastrable en la lista raíz)
    transform,
    transition,
    isDragging: isFolderDragging,
  } = useSortable({ id: folder.id, disabled: !isEditMode });

  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({ // 'isOver' detecta si se está arrastrando *sobre* esta carpeta
    id: folder.id,
    disabled: !isEditMode || isFolderDragging, // Deshabilitar drop si la carpeta misma se está arrastrando
  });

  const folderColor = folder.color || "hsl(var(--border))";

  // Combina los refs
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

  // Determinar si resaltar esta carpeta como zona de drop
  const shouldHighlightDrop = isEditMode && isOver && activeDragItem && !activeDragItem.is_folder && activeDragItem.parent_id !== folder.id;

  return (
    <>
      {isRenaming && (
        <RenameDialog
          item={folder}
          isOpen={isRenaming}
          onClose={() => setIsRenaming(false)}
        />
      )}
      {/* --- Aplicar estilo de arrastre y ref combinado --- */}
      <Card
        ref={combinedRef}
        style={style}
        className={cn(
          "transition-all duration-150 ease-out border-2 relative group", // <-- Añadido relative group
          shouldHighlightDrop ? "border-primary ring-2 ring-primary ring-offset-2 bg-primary/5" : `border-[${folderColor}]`,
          isEditMode && !shouldHighlightDrop ? "hover:border-muted-foreground/50" : ""
        )}
      >
        {/* --- Añadir el handle de arrastre para la carpeta --- */}
        {isEditMode && (
          <div {...listeners} {...attributes} className="absolute top-1/2 -left-3 transform -translate-y-1/2 z-10 p-1 cursor-grab touch-none opacity-0 group-hover:opacity-100 transition-opacity" title="Move Folder">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
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
        {/* --- Usar SortableContext para los decks *dentro* de la carpeta --- */}
        {(isEditMode || isExpanded) && (
          <CardContent className={cn("pt-0", isEditMode ? "p-4 min-h-[80px]" : "p-4")}>
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

// --- Componente DraggableDeckItem (ligeramente modificado para el handle) ---
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
      {/* --- Mover el handle de arrastre fuera de los botones de acción --- */}
      {isEditMode && (
         <div {...listeners} {...attributes} className="absolute top-1/2 -left-3 transform -translate-y-1/2 z-10 p-1 cursor-grab touch-none opacity-0 group-hover:opacity-100 transition-opacity" title="Move Deck">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
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
          {/* --- El handle se movió fuera --- */}
        </div>
      )}
      <DeckCard deck={item} isEditMode={isEditMode} />
    </div>
  );
}

// ---- Componente Principal del Dashboard (MUY MODIFICADO) ----
// Define un ID constante para el área raíz
const ROOT_DROPPABLE_ID = 'root-drop-area';

export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null); // Usar UniqueIdentifier

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Exigir mover un poco más antes de iniciar el arrastre
        distance: 10,
      },
    })
  );

   // --- NUEVO: Orden inicial mejorado ---
   useEffect(() => {
    const sortedInitial = [...initialItems].sort((a, b) => {
      // Prioridad: Carpetas primero, luego mazos raíz
      if (a.is_folder && !b.is_folder) return -1;
      if (!a.is_folder && b.is_folder) return 1;

      // Orden secundario: por posición (nulls/Infinity al final)
      const posA = a.position ?? Infinity;
      const posB = b.position ?? Infinity;
      if (posA !== posB) return posA - posB;

      // Orden terciario: por fecha de creación (los más nuevos primero si position es igual)
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
    setItems(sortedInitial);

    // Lógica del popup sin cambios
    const hasSeenPopup = localStorage.getItem('hasSeenWelcomePopup');
    if (!hasSeenPopup && initialItems.length > 0) {
      setShowWelcomePopup(true);
      localStorage.setItem('hasSeenWelcomePopup', 'true');
    }
  }, [initialItems]);

  // --- REFACTORIZADO: Separar la lógica de cálculo de listas ---
  const { folders, rootDecks, decksInFolders, rootItemIds } = useMemo(() => {
    const foldersMap = new Map<string, Item>();
    const rootDecksList: Item[] = [];
    const decksInFoldersMap = new Map<string, Item[]>();

    // Ordenar primero por posición (nulls al final), luego por creación
    const sortedItems = [...items].sort((a, b) => {
        const posA = a.position ?? Infinity;
        const posB = b.position ?? Infinity;
        if (posA !== posB) return posA - posB;
        return (b.created_at ?? "").localeCompare(a.created_at ?? ""); // Más nuevos primero si no hay posición
    });


    for (const item of sortedItems) {
      if (item.is_folder) {
        foldersMap.set(item.id, item);
        if (!decksInFoldersMap.has(item.id)) {
          decksInFoldersMap.set(item.id, []);
        }
      } else if (item.parent_id) {
        if (!decksInFoldersMap.has(item.parent_id)) {
          // Si la carpeta padre no existe (raro), lo tratamos como raíz por seguridad
           console.warn(`Deck ${item.id} has parent_id ${item.parent_id} but folder not found. Treating as root.`);
           rootDecksList.push(item);
        } else {
          decksInFoldersMap.get(item.parent_id)!.push(item);
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

    // Crear una lista combinada de IDs en el nivel raíz (carpetas + mazos raíz) para SortableContext
    const combinedRootItemIds = [...sortedFolders.map(f => f.id), ...rootDecksList.map(d => d.id)];


    return {
      folders: sortedFolders,
      rootDecks: rootDecksList, // Ya están ordenados por la clasificación inicial
      decksInFolders: decksInFoldersMap,
      rootItemIds: combinedRootItemIds, // IDs ordenados para el nivel raíz
    };
  }, [items]);


  // --- Draggable items son TODOS los items (carpetas y mazos) ---
  const draggableItemIds = useMemo(() => items.map(item => item.id), [items]);

  const handleDragStart = (event: DragStartEvent) => {
    if (!isEditMode) return;
    const { active } = event;
    const item = items.find((i) => i.id === active.id);
    setActiveDragItem(item || null);
    setOverId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? over.id : null);
  };

  // --- Droppable para el área raíz ---
  const { setNodeRef: setRootDroppableNodeRef, isOver: isOverRootArea } = useDroppable({
    id: ROOT_DROPPABLE_ID, // Usar el ID constante
    disabled: !isEditMode,
  });

  // --- Función auxiliar para calcular posición (sin cambios) ---
 const calculateNewPosition = (
    prevPos: number | null | undefined,
    nextPos: number | null | undefined,
    currentIndex: number // <-- Añadido índice actual para desempate inicial/final
  ): number => {
    const defaultIncrement = 1000; // Incremento base para el espaciado
    let newPos: number;

    if (prevPos === null || prevPos === undefined) {
      // Es el primer elemento
      if (nextPos !== null && nextPos !== undefined) {
        newPos = nextPos / 2; // Colocar a la mitad del espacio antes del siguiente
      } else {
        newPos = defaultIncrement; // Es el único elemento
      }
    } else if (nextPos === null || nextPos === undefined) {
      // Es el último elemento
      newPos = prevPos + defaultIncrement; // Colocar después del anterior
    } else {
      // Está entre dos elementos
      newPos = prevPos + (nextPos - prevPos) / 2; // Colocar a la mitad del espacio entre ellos
    }

    // Asegurarse de que la posición sea un número válido y positivo
    return Math.max(1, Math.round(newPos));
  };


  // --- handleDragEnd REFACTORIZADO ---
 const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id;
    const overIdResolved = over?.id; // Puede ser null si se suelta fuera

    setActiveDragItem(null);
    setOverId(null);

    const activeItem = items.find((item) => item.id === activeId);

    // Validaciones iniciales
    if (!activeItem || !isEditMode || activeId === overIdResolved) {
      return; // No hacer nada si no hay item activo, no estamos en modo edición, o se suelta sobre sí mismo
    }

    const supabase = createClient();
    let newItems = [...items];
    const updatesMap: Record<string, Partial<Item>> = {}; // Para guardar cambios de BD
    let successMessage = "";
    let errorMessage = "Failed to update item."; // Mensaje genérico

    const oldIndex = newItems.findIndex((item) => item.id === activeId);

    try {
      // --- Determinar el contenedor de destino ---
      let targetParentId: string | null = null;
      let targetContainerItems: Item[] = []; // Items en el contenedor de destino
      let targetContainerType: 'root' | 'folder' = 'root';

      if (overIdResolved === ROOT_DROPPABLE_ID) {
        // Soltado explícitamente en el área raíz
        targetParentId = null;
        targetContainerItems = newItems.filter(item => !item.parent_id); // Incluye carpetas y mazos raíz
        targetContainerType = 'root';
      } else {
        const overItem = items.find((item) => item.id === overIdResolved);
        if (overItem) {
          if (overItem.is_folder) {
            // Soltado sobre una carpeta (o dentro de ella si DND Kit lo resuelve así)
             if (!activeItem.is_folder) { // Solo mover mazos a carpetas
                targetParentId = overItem.id;
                targetContainerItems = newItems.filter(item => item.parent_id === overItem.id);
                targetContainerType = 'folder';
             } else {
                 // No permitir mover carpetas dentro de otras carpetas por ahora
                 console.log("Cannot move folders into other folders.");
                 return;
             }
          } else {
            // Soltado sobre un item (mazo o carpeta raíz)
            targetParentId = overItem.parent_id; // Hereda el padre del item sobre el que se soltó
            targetContainerItems = newItems.filter(item => item.parent_id === targetParentId);
            targetContainerType = targetParentId ? 'folder' : 'root';
          }
        } else {
           // Soltado fuera de cualquier área válida, probablemente mover a la raíz por defecto
           targetParentId = null;
           targetContainerItems = newItems.filter(item => !item.parent_id);
           targetContainerType = 'root';
        }
      }

       // --- Lógica de movimiento y reordenación ---
        const isMovingContainer = activeItem.parent_id !== targetParentId;
        const targetIndex = overIdResolved && overIdResolved !== ROOT_DROPPABLE_ID
            ? newItems.findIndex((item) => item.id === overIdResolved)
            : newItems.length -1; // Si no hay 'over' específico, intentar poner al final

        let finalIndex = targetIndex;

      if (isMovingContainer) {
          // Mover entre contenedores (raíz <-> carpeta)
          const movedItem = { ...newItems[oldIndex], parent_id: targetParentId };
          newItems.splice(oldIndex, 1); // Quitar del origen

          // Encontrar dónde insertar en el destino
          // Si targetContainerType es 'folder', añadimos al final de esa carpeta
          // Si es 'root', usamos el targetIndex calculado antes (puede ser sobre otro item raíz)
          if (targetContainerType === 'folder') {
             // Encontrar el índice del último item de esa carpeta o la carpeta misma
              const lastItemIndexInFolder = newItems.findLastIndex(item => item.parent_id === targetParentId || item.id === targetParentId);
              finalIndex = lastItemIndexInFolder >= 0 ? lastItemIndexInFolder + 1 : newItems.length;
          } else {
               // Ya tenemos targetIndex, ajustarlo si el índice original afectaba
                finalIndex = oldIndex < targetIndex ? targetIndex : targetIndex + 1;
          }

          finalIndex = Math.max(0, Math.min(finalIndex, newItems.length)); // Asegurar límites
          newItems.splice(finalIndex, 0, movedItem);

          updatesMap[activeId] = { parent_id: targetParentId };
          successMessage = targetParentId ? "Deck moved into folder." : "Deck moved to root.";

      } else {
           // Reordenar dentro del mismo contenedor
            const overItemIndex = newItems.findIndex((item) => item.id === overIdResolved);
            if (overItemIndex === -1) return; // No se encontró el item sobre el que se soltó
            finalIndex = overItemIndex;

            newItems = arrayMove(newItems, oldIndex, finalIndex);
            successMessage = activeItem.is_folder ? "Folder reordered." : "Deck reordered.";
      }

      // --- Recalcular posiciones para el contenedor afectado ---
      const itemsToReposition = newItems.filter(item => item.parent_id === targetParentId);
      for (let i = 0; i < itemsToReposition.length; i++) {
        const currentItem = itemsToReposition[i];
        const prevItem = itemsToReposition[i - 1];
        const nextItem = itemsToReposition[i + 1];
        const calculatedPos = calculateNewPosition(prevItem?.position, nextItem?.position, i);

        // Solo actualizar si la posición cambió o es el item movido
        if (currentItem.position !== calculatedPos || currentItem.id === activeId) {
             updatesMap[currentItem.id] = { ...updatesMap[currentItem.id], position: calculatedPos };
             // Actualizar también en el array local para la siguiente iteración
            const idxInNewItems = newItems.findIndex(it => it.id === currentItem.id);
            if (idxInNewItems !== -1) {
                newItems[idxInNewItems].position = calculatedPos;
            }
        }
      }

      // Aplicar estado local final (asegurándose de que el item movido tenga la posición correcta)
       const finalMovedItemIndex = newItems.findIndex(it => it.id === activeId);
       if (finalMovedItemIndex !== -1 && updatesMap[activeId]?.position) {
           newItems[finalMovedItemIndex].position = updatesMap[activeId].position;
           newItems[finalMovedItemIndex].parent_id = targetParentId;
       }


      setItems(newItems); // Actualizar UI inmediatamente

      // Enviar actualizaciones a BD
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
      // Revertir al estado inicial en caso de error
      setItems(initialItems);
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
        // Mensaje de dashboard vacío sin cambios
         <div className="flex h-[60vh] flex-col items-center justify-center text-center"> <BookOpen className="mb-4 h-16 w-16 text-muted-foreground" /> <h2 className="text-2xl font-semibold">Your dashboard is empty</h2> <p className="mb-6 text-muted-foreground"> Create your first deck to get started. </p> <div className="flex gap-2"> <CreateDeckDialog onDeckCreated={() => router.refresh()} size="lg" /> <CreateAIDeckDialog /> </div> </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners} // <-- Usar closestCorners
          onDragStart={handleDragStart}
          onDragOver={handleDragOver} // Necesario para detectar sobre qué se está arrastrando
          onDragEnd={handleDragEnd}
        >
          {/* --- Usar SortableContext para la lista raíz (carpetas y mazos raíz) --- */}
          <SortableContext items={rootItemIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-8">
              {/* Renderizar carpetas y mazos raíz en el orden correcto */}
              {rootItemIds.map(id => {
                const item = items.find(i => i.id === id);
                if (!item) return null;

                if (item.is_folder) {
                  const decksInCurrentFolder = decksInFolders.get(item.id) || [];
                  return (
                    <FolderView
                      key={item.id}
                      folder={item}
                      decks={decksInCurrentFolder}
                      isEditMode={isEditMode}
                      onUpdate={setItems}
                      isDraggingOver={overId === item.id}
                      activeDragItem={activeDragItem} // Pasar item activo
                    />
                  );
                } else {
                  // Renderizar mazo raíz directamente
                  return (
                     <div key={item.id} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"> {/* Ajusta el grid según necesites */}
                        <DraggableDeckItem
                            item={item}
                            isEditMode={isEditMode}
                            onUpdate={setItems}
                        />
                     </div>
                  );
                }
              })}

               {/* Renderizar mazos raíz que podrían no estar en rootItemIds si hubo un error de orden */}
               {rootDecks.filter(d => !rootItemIds.includes(d.id)).map(deck => (
                    <div key={deck.id} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         <DraggableDeckItem
                            item={deck}
                            isEditMode={isEditMode}
                            onUpdate={setItems}
                         />
                    </div>
               ))}


            </div>
          </SortableContext>

          {/* Área de drop en la raíz (MODIFICADA para mejor visibilidad) */}
          <div
            id={ROOT_DROPPABLE_ID}
            ref={setRootDroppableNodeRef}
            className={cn(
              "mt-12 rounded-lg border-2 border-dashed transition-all duration-150 ease-out", // Más margen superior
              isEditMode ? "min-h-[120px] border-border p-6" : "min-h-0 border-transparent p-0", // Más alto
              // Resaltar si se está arrastrando sobre ella Y el item viene de una carpeta
              isEditMode && isOverRootArea && activeDragItem && activeDragItem.parent_id && "border-primary ring-2 ring-primary ring-offset-2 bg-primary/5"
            )}
          >
            {isEditMode && (
              <p className="flex items-center justify-center h-full text-center text-sm text-muted-foreground pointer-events-none">
                Drop decks here to move them out of folders.
              </p>
            )}
          </div>

          <DragOverlay>
            {activeDragItem ? (
                 activeDragItem.is_folder ? (
                    // Placeholder visual para arrastrar carpeta (simplificado)
                     <Card className="opacity-75 border-2 border-dashed border-muted-foreground bg-muted/30">
                        <CardHeader className="flex-row items-center gap-4 p-4">
                             <Folder className="h-6 w-6 text-muted-foreground" />
                             <CardTitle>{activeDragItem.name}</CardTitle>
                        </CardHeader>
                     </Card>
                 ) : (
                    // Usar DeckCard para arrastrar mazos
                    <DeckCard deck={activeDragItem} isEditMode={isEditMode} />
                 )
            ) : null}
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