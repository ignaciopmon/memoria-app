// components/dashboard-client.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  useDroppable,
  DragOverlay,
  closestCorners, // Usaremos closestCorners
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier,
  // Modificadores para suavizar (opcional)
  // import { restrictToParentElement } from '@dnd-kit/modifiers';
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
  LogIn, // <-- Icono para "entrar"
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

// Tipos y Constantes (sin cambios)
type Item = { id: string; name: string; description: string | null; cardCount: number; is_folder: boolean; parent_id: string | null; color: string | null; position: number | null; created_at?: string; };
const ROOT_DROPPABLE_ID = 'root-drop-area';
const ROOT_DECKS_CONTAINER_ID = 'root-decks-container';
// --- NUEVO: Prefijo para IDs de zonas de drop internas de carpetas ---
const FOLDER_CONTENT_DROP_ID_PREFIX = 'folder-content-';

// --- Componente FolderView (REDISEÑADO SIGNIFICATIVAMENTE) ---
function FolderView({
  folder,
  decks,
  isEditMode,
  onUpdate,
  activeDragItem,
}: {
  folder: Item;
  decks: Item[];
  isEditMode: boolean;
  onUpdate: (updater: (prev: Item[]) => Item[]) => void;
  activeDragItem: Item | null;
}) {
    const [isRenaming, setIsRenaming] = useState(false);
    // Expandido siempre en modo edición, colapsable fuera
    const [isExpanded, setIsExpanded] = useState(isEditMode);

    // Sortable para la carpeta en la lista raíz
    const {
        attributes,
        listeners,
        setNodeRef: setSortableNodeRef,
        transform,
        transition,
        isDragging: isFolderDragging,
    } = useSortable({ id: folder.id, disabled: !isEditMode });

    // --- NUEVO: Droppable para el ÁREA DE CONTENIDO INTERNA ---
    const folderContentDropId = `${FOLDER_CONTENT_DROP_ID_PREFIX}${folder.id}`;
    const { setNodeRef: setContentDroppableNodeRef, isOver: isOverContentArea } = useDroppable({
        id: folderContentDropId,
        disabled: !isEditMode || isFolderDragging, // No se puede soltar si la carpeta se está moviendo
        data: { folderId: folder.id }, // Pasar el ID de la carpeta
    });

    // --- Droppable para la TARJETA EXTERNA (para reordenar carpetas, no para meter decks) ---
    const { setNodeRef: setCardDroppableNodeRef } = useDroppable({
        id: folder.id,
        disabled: !isEditMode || isFolderDragging,
    });


    const folderColor = folder.color || "hsl(var(--muted-foreground))";

    // Combina refs para la tarjeta externa
    const combinedCardRef = (node: HTMLElement | null) => {
        setSortableNodeRef(node);
        setCardDroppableNodeRef(node);
    };

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isFolderDragging ? 'none' : transition,
        opacity: isFolderDragging ? 0.5 : 1,
        zIndex: isFolderDragging ? 10 : undefined,
    };

    // Resaltar el ÁREA DE CONTENIDO si se arrastra un mazo sobre ella
    const shouldHighlightContentDrop = isEditMode && isOverContentArea && activeDragItem && !activeDragItem.is_folder && activeDragItem.parent_id !== folder.id;

    // Expandir si se arrastra sobre la tarjeta externa o el contenido
    useEffect(() => {
        if (isEditMode && (shouldHighlightContentDrop) && !isExpanded) {
            setIsExpanded(true);
        }
    }, [isEditMode, shouldHighlightContentDrop, isExpanded]);

  return (
    <>
      {isRenaming && <RenameDialog item={folder} isOpen={isRenaming} onClose={() => setIsRenaming(false)} />}
      {/* --- Contenedor Principal de la Carpeta (Sortable y Droppable Externo) --- */}
      <div
        ref={combinedCardRef}
        style={style}
        className={cn(
          "transition-colors duration-150 ease-out border-2 rounded-xl relative group bg-card", // Usar rounded-xl y bg-card
          `border-[${folderColor}]`,
           // Resaltado sutil si se arrastra algo sobre la tarjeta externa (para reordenar)
           // isDraggingOverCard && !shouldHighlightContentDrop ? "ring-1 ring-muted-foreground ring-offset-1" : ""
        )}
      >
        {isEditMode && ( /* Handle */
          <div {...listeners} {...attributes} className="absolute top-1/2 -left-3 transform -translate-y-1/2 z-10 p-1 cursor-grab touch-none opacity-0 group-hover:opacity-100 transition-opacity" title="Move Folder">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        {/* --- Cabecera de la Carpeta (igual que antes) --- */}
        <CardHeader
          className="flex-row items-center justify-between space-y-0 p-4 cursor-pointer rounded-t-lg" // Añadido rounded-t-lg
           // onClick para colapsar/expandir fuera de modo edición
          onClick={() => !isEditMode && setIsExpanded(!isExpanded)}
        >
          {/* ... (Icono, Título, Botones Edit/Color/Delete/Expand) ... */}
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
        </CardHeader>

        {/* --- Contenido Interno (siempre visible en modo edición o si está expandido) --- */}
        {(isEditMode || isExpanded) && (
           // --- ESTA ES EL ÁREA DROPPABLE INTERNA ---
          <div
            ref={setContentDroppableNodeRef}
            className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden", // Transición suave para el contenido
              // Estilos base del área de contenido
              "p-4 border-t", // Separador visual
               // Estilos específicos MODO EDICIÓN
               isEditMode && "min-h-[150px] bg-muted/30 rounded-b-lg", // Fondo diferente y más altura
               // Estilos cuando es un TARGET DE DROP VÁLIDO
               shouldHighlightContentDrop && "border-primary border-2 border-dashed bg-primary/10 ring-2 ring-primary ring-offset-2",
               // Estilos cuando NO está expandido fuera de modo edición
               !isEditMode && !isExpanded && "max-h-0 p-0 border-t-0", // Colapsado
               !isEditMode && isExpanded && "max-h-[1000px]" // Animación de expansión (ajusta max-h si es necesario)
            )}
          >
            {/* SortableContext para los decks *dentro* de la carpeta */}
            <SortableContext items={decks.map(d => d.id)} strategy={rectSortingStrategy}>
              {decks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-6">
                   {/* Mensaje más claro en modo edición */}
                  {isEditMode ? (
                    <>
                      <LogIn className="h-8 w-8 mb-2 opacity-50"/>
                      <span>Drop decks here</span>
                    </>
                  ) : (
                    <span>This folder is empty</span>
                  )}
                </div>
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
          </div>
        )}
      </div>
    </>
  );
}


// --- DraggableDeckItem (sin cambios respecto a la versión anterior) ---
function DraggableDeckItem({ /* ...props... */
    item,
    isEditMode,
    onUpdate,
}: {
  item: Item;
  isEditMode: boolean;
  onUpdate: (updater: (prev: Item[]) => Item[]) => void;
}) {
    // ... (Hooks, style, handleDelete)
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
        transition: isDragging ? 'none' : transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
    };

    const handleDelete = async () => { /* ... */
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
      {isRenaming && ( /* ... */
        <RenameDialog
          item={item}
          isOpen={isRenaming}
          onClose={() => setIsRenaming(false)}
        />
       )}
      {isEditMode && ( /* Handle */
         <div {...listeners} {...attributes} className="absolute top-1/2 -left-3 transform -translate-y-1/2 z-10 p-1 cursor-grab touch-none opacity-0 group-hover:opacity-100 transition-opacity" title="Move Deck">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
      )}
      {isEditMode && ( /* Botones */
        <div className="absolute top-2 right-2 z-20 flex items-center bg-background/80 backdrop-blur-sm rounded-full border p-0.5 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
             {/* ... */}
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

// ---- Componente Principal (MODIFICADO `handleDragEnd`) ----
export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
    // ... (Estados y Sensores sin cambios respecto a la última versión) ...
    const [items, setItems] = useState<Item[]>(initialItems);
    const [activeDragItem, setActiveDragItem] = useState<Item | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const router = useRouter();
    const { toast } = useToast();
    const [showWelcomePopup, setShowWelcomePopup] = useState(false);
    const [overId, setOverId] = useState<UniqueIdentifier | null>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8, }}),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6, }}),
        useSensor(PointerSensor, { activationConstraint: { distance: 10, }})
    );
     // Orden inicial y separación (sin cambios)
     useEffect(() => { /* ... */
         const sortedInitial = [...initialItems].sort((a, b) => {
            const posA = a.position ?? Infinity;
            const posB = b.position ?? Infinity;
            if (posA !== posB) return posA - posB;
            return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        });
        setItems(sortedInitial);
        const hasSeenPopup = localStorage.getItem('hasSeenWelcomePopup');
        if (!hasSeenPopup && initialItems.length > 0) { setShowWelcomePopup(true); localStorage.setItem('hasSeenWelcomePopup', 'true'); }
     }, [initialItems]);
     const { folders, rootDecks, decksInFolders, rootLevelIds } = useMemo(() => { /* ... */
        const foldersMap = new Map<string, Item>();
        const rootDecksList: Item[] = [];
        const decksInFoldersMap = new Map<string, Item[]>();
        const sortedItems = [...items].sort((a, b) => { /* ... */
            const posA = a.position ?? Infinity;
            const posB = b.position ?? Infinity;
            if (posA !== posB) return posA - posB;
            return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        });
        for (const item of sortedItems) { /* ... */
             if (item.is_folder) {
                foldersMap.set(item.id, item);
                if (!decksInFoldersMap.has(item.id)) decksInFoldersMap.set(item.id, []);
            } else if (item.parent_id) {
                if (!decksInFoldersMap.has(item.parent_id)) {
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
        const sortedFolders = Array.from(foldersMap.values()).sort((a, b) => { /* ... */
            const posA = a.position ?? Infinity;
            const posB = b.position ?? Infinity;
            if (posA !== posB) return posA - posB;
            return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        });
        const combinedRootLevelIds = [...sortedFolders.map(f => f.id), ROOT_DECKS_CONTAINER_ID];
        return { folders: sortedFolders, rootDecks: rootDecksList, decksInFolders: decksInFoldersMap, rootLevelIds: combinedRootLevelIds };
     }, [items]);
     const draggableItemIds = useMemo(() => items.map(item => item.id), [items]);

    const handleDragStart = (event: DragStartEvent) => { /* ... */
         if (!isEditMode) return;
        const { active } = event;
        const item = items.find((i) => i.id === active.id);
        setActiveDragItem(item || null);
        setOverId(null);
     };
    const handleDragOver = (event: DragOverEvent) => { /* ... */
         const { over } = event;
         setOverId(over ? over.id : null);
     };
    const { setNodeRef: setRootDroppableNodeRef, isOver: isOverRootArea } = useDroppable({ /* ... */
        id: ROOT_DROPPABLE_ID,
        disabled: !isEditMode,
     });
    const calculateNewPosition = ( /* ... */
        prevPos: number | null | undefined,
        nextPos: number | null | undefined,
        currentIndex: number
    ): number => {
        const defaultIncrement = 1000;
        let newPos: number;
        if (prevPos === null || prevPos === undefined) newPos = nextPos !== null && nextPos !== undefined ? nextPos / 2 : defaultIncrement * (currentIndex + 1);
        else if (nextPos === null || nextPos === undefined) newPos = prevPos + defaultIncrement;
        else newPos = prevPos + (nextPos - prevPos) / 2;
        return Math.max(1, Math.round(newPos));
    };


   // --- handleDragEnd REFINADO para usar ID de contenido de carpeta ---
   const handleDragEnd = async (event: DragEndEvent) => {
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
    // --- NUEVO: Comprobar si se soltó sobre un área de contenido de carpeta ---
    const isOverFolderContent = typeof overIdResolved === 'string' && overIdResolved.startsWith(FOLDER_CONTENT_DROP_ID_PREFIX);
    const targetFolderIdFromContent = isOverFolderContent ? over?.data?.current?.folderId as string | undefined : undefined;


    const sourceContainerId = activeItem.parent_id;
    let targetContainerId: string | null = null;

    // --- LÓGICA DE DETECCIÓN DE DESTINO MEJORADA ---
    // 1. Prioridad MÁXIMA: ¿Se soltó DENTRO del área de contenido de una carpeta? (y es un mazo)
    if (isOverFolderContent && targetFolderIdFromContent && !activeItem.is_folder) {
        targetContainerId = targetFolderIdFromContent;
        console.log(`Target determined: Folder Content Area ${targetContainerId}`);
    }
    // 2. ¿Se soltó sobre la tarjeta de una carpeta? (y es un mazo)
    else if (overItem?.is_folder && !activeItem.is_folder) {
        targetContainerId = overItem.id;
        console.log(`Target determined: Folder Card ${overItem.id}`);
    }
    // 3. ¿Se soltó sobre el área raíz explícita?
    else if (overIdResolved === ROOT_DROPPABLE_ID) {
        targetContainerId = null;
        console.log("Target determined: Root Area (explicit)");
    }
    // 4. ¿Se soltó sobre OTRO ITEM (mazo o carpeta)? Hereda su contenedor.
    else if (overItem) {
        // PERO, si es un mazo y el `overItem` es una carpeta, NO heredar (ya cubierto en paso 2)
        if (!(overItem.is_folder && !activeItem.is_folder)) {
            targetContainerId = overItem.parent_id;
            console.log(`Target determined: Inherited from overItem ${overItem.id} -> parent ${overItem.parent_id}`);
        } else {
             console.log(`Drop over folder card ${overItem.id}, target already set.`);
             targetContainerId = overItem.id; // Confirmar que es la carpeta
        }
    }
    // 5. ¿Se soltó en espacio vacío Y venía de una carpeta? Mover a la raíz.
    else if (!overItem && activeItem.parent_id) {
        targetContainerId = null;
        console.log("Target determined: Root Area (implicit from folder)");
    }
     // 6. ¿Se soltó en espacio vacío Y YA ESTABA en la raíz? Potencial reordenamiento al final.
     else if (!overItem && !activeItem.parent_id) {
         targetContainerId = null; // Sigue siendo raíz
         console.log("Target determined: Root Area (implicit, potentially reorder to end)");
     }
    else {
        // Caso no manejado o inválido
        console.log("Target determination failed or invalid drop.");
        return;
    }


    try {
        const isMovingContainer = sourceContainerId !== targetContainerId;
        const overIndex = overIdResolved && !isOverFolderContent // No usar overIndex si es sobre contenido
            ? newItems.findIndex(item => item.id === overIdResolved)
            : -1;

        if (isMovingContainer) {
             const movedItem = { ...newItems[oldIndex], parent_id: targetContainerId, position: null };
             newItems.splice(oldIndex, 1);

            let targetInsertionIndex: number;
             if (targetContainerId === null) { // Moviendo a la raíz
                 if (overIndex !== -1 && (!newItems[overIndex]?.parent_id || newItems[overIndex]?.is_folder)) { // Sobre item raíz
                     targetInsertionIndex = oldIndex < overIndex ? overIndex : overIndex + 1;
                 } else { // Área raíz o final
                    const lastRootIndex = newItems.findLastIndex(item => !item.parent_id || item.is_folder);
                    targetInsertionIndex = lastRootIndex + 1;
                }
             } else { // Moviendo a una carpeta
                const lastInFolderIndex = newItems.findLastIndex(item => item.parent_id === targetContainerId);
                const folderItemIndex = newItems.findIndex(item => item.id === targetContainerId);
                targetInsertionIndex = lastInFolderIndex !== -1 ? lastInFolderIndex + 1 : folderItemIndex + 1;
            }

            targetInsertionIndex = Math.max(0, Math.min(targetInsertionIndex, newItems.length));
            newItems.splice(targetInsertionIndex, 0, movedItem);

            updatesMap[activeId] = { parent_id: targetContainerId };
            successMessage = targetContainerId ? `Deck "${activeItem.name}" moved into folder.` : `Deck "${activeItem.name}" moved to root.`;

        } else if (overIndex !== -1 && targetContainerId === sourceContainerId) {
             // Reordenar dentro del mismo contenedor
             if(oldIndex === overIndex) return;
            newItems = arrayMove(newItems, oldIndex, overIndex);
            successMessage = activeItem.is_folder ? "Folder reordered." : "Deck reordered.";
        } else if (!overIdResolved && targetContainerId === null && !activeItem.parent_id){
             // Reordenar raíz soltando en vacío (mover al final)
             const lastActualRootIndex = newItems.findLastIndex(item => !item.parent_id || item.is_folder);
             if (oldIndex === lastActualRootIndex) return;
             newItems = arrayMove(newItems, oldIndex, lastActualRootIndex);
             successMessage = activeItem.is_folder ? "Folder reordered." : "Deck reordered.";
        }
         else {
             console.log("Drag end condition not met for update (reorder/move).");
             return;
         }


        // --- Recalcular Posiciones ---
        // Contenedor de destino
        const itemsToRepositionTarget = newItems.filter(item => item.parent_id === targetContainerId);
        for (let i = 0; i < itemsToRepositionTarget.length; i++) {
             const currentItem = itemsToRepositionTarget[i];
             const prevItem = itemsToRepositionTarget[i - 1];
             const nextItem = itemsToRepositionTarget[i + 1];
             const calculatedPos = calculateNewPosition(prevItem?.position, nextItem?.position, i);
             if (currentItem.position !== calculatedPos || currentItem.id === activeId) {
                 updatesMap[currentItem.id] = { ...updatesMap[currentItem.id], position: calculatedPos };
                 const idxInNewItems = newItems.findIndex(it => it.id === currentItem.id);
                 if (idxInNewItems !== -1) newItems[idxInNewItems].position = calculatedPos;
             }
        }
         // Contenedor de origen (si se movió entre contenedores)
         if (isMovingContainer && sourceContainerId !== null) {
            const itemsToRepositionSource = newItems.filter(item => item.parent_id === sourceContainerId);
             for (let i = 0; i < itemsToRepositionSource.length; i++) {
                 const currentItem = itemsToRepositionSource[i];
                 const prevItem = itemsToRepositionSource[i - 1];
                 const nextItem = itemsToRepositionSource[i + 1];
                 const calculatedPos = calculateNewPosition(prevItem?.position, nextItem?.position, i);
                 if (currentItem.position !== calculatedPos) { // No actualizar el item activo aquí si ya se movió
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
        } else {
             console.log("No database updates needed.");
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
         /* Mensaje vacío sin cambios */
         <div className="flex h-[60vh] flex-col items-center justify-center text-center"> <BookOpen className="mb-4 h-16 w-16 text-muted-foreground" /> <h2 className="text-2xl font-semibold">Your dashboard is empty</h2> <p className="mb-6 text-muted-foreground"> Create your first deck to get started. </p> <div className="flex gap-2"> <CreateDeckDialog onDeckCreated={() => router.refresh()} size="lg" /> <CreateAIDeckDialog /> </div> </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners} // <-- closestCorners
          onDragStart={handleDragStart}
          onDragOver={handleDragOver} // Necesario para `overId`
          onDragEnd={handleDragEnd}
          // modifiers={[restrictToParentElement]} // Opcional
        >
          <SortableContext items={rootLevelIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-8">
              {/* Renderizar Carpetas y Contenedor de Mazos Raíz */}
               {rootLevelIds.map(id => {
                 if (id === ROOT_DECKS_CONTAINER_ID) {
                   return ( /* Contenedor de mazos raíz */
                     <div id={ROOT_DECKS_CONTAINER_ID} key={ROOT_DECKS_CONTAINER_ID} className="root-decks-container">
                       <SortableContext items={rootDecks.map(d => d.id)} strategy={rectSortingStrategy}>
                         <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                           {rootDecks.map((deck) => (
                             <DraggableDeckItem key={deck.id} item={deck} isEditMode={isEditMode} onUpdate={setItems} />
                           ))}
                         </div>
                         {isEditMode && rootDecks.length === 0 && ( /* Placeholder */
                           <div className="py-10 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg min-h-[100px] flex items-center justify-center">
                             Decks outside folders will appear here.
                           </div>
                         )}
                       </SortableContext>
                     </div>
                   );
                 }
                 const item = items.find(i => i.id === id);
                 if (item?.is_folder) { // Es una carpeta
                     const decksInCurrentFolder = decksInFolders.get(item.id) || [];
                     return (
                         <FolderView key={item.id} folder={item} decks={decksInCurrentFolder} isEditMode={isEditMode} onUpdate={setItems} activeDragItem={activeDragItem} />
                     );
                 }
                 return null;
               })}
            </div>
          </SortableContext>

          {/* Área de drop en la raíz */}
          <div
            id={ROOT_DROPPABLE_ID}
            ref={setRootDroppableNodeRef}
            className={cn(/* ... clases ... */
                "mt-12 rounded-lg border-2 border-dashed transition-colors duration-150 ease-out",
                isEditMode ? "min-h-[120px] border-border p-6" : "min-h-0 border-transparent p-0",
                isEditMode && isOverRootArea && activeDragItem && !activeDragItem.is_folder && activeDragItem.parent_id && "border-primary bg-primary/5"
            )}
           >
             {isEditMode && ( /* ... */
                <p className="flex items-center justify-center h-full text-center text-sm text-muted-foreground pointer-events-none">
                    Drop decks here to move them out of folders.
                </p>
             )}
          </div>

          <DragOverlay dropAnimation={null}>
             {/* ... (Overlay sin cambios) ... */}
              {activeDragItem ? (
                 activeDragItem.is_folder ? (
                    <Card className="opacity-75 border-2 border-dashed border-muted-foreground bg-muted/30 shadow-lg">
                        <CardHeader className="flex-row items-center gap-4 p-4">
                             <Folder className="h-6 w-6 text-muted-foreground" />
                             <CardTitle>{activeDragItem.name}</CardTitle>
                        </CardHeader>
                     </Card>
                 ) : (
                    <div className="shadow-xl rounded-xl">
                      <DeckCard deck={activeDragItem} isEditMode={isEditMode} />
                    </div>
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