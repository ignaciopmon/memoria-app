// components/dashboard-client.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy, // <-- Única estrategia necesaria ahora
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { DeckCard } from "./deck-card";
import { Button } from "./ui/button";
import {
  GripVertical,
  Trash2,
  Edit,
  Paintbrush,
  Loader2,
  BookOpen,
  Info,
  FolderPlus, // <-- Mantenemos el icono por ahora
} from "lucide-react";
// Removidos imports de FolderView y DeleteFolderDialog
import { RenameDialog } from "./rename-dialog";
import { ColorPopover } from "./color-popover";
import { CreateDeckDialog } from "./create-deck-dialog";
// Importar CreateFolderDialog para el mensaje de mantenimiento
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

// Tipo Item simplificado (ya no necesita parent_id ni is_folder relevantemente)
type Item = {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
  // is_folder: boolean; // Ya no es necesario para la lógica principal
  // parent_id: string | null; // Ya no es necesario para la lógica principal
  color: string | null;
  position: number | null;
  created_at?: string;
};


// --- Componente DraggableDeckItem (Ajuste menor en handle y props) ---
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
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const supabase = createClient();
    // Actualizar para usar "update" y marcar como borrado en lugar de "delete"
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
      // Filtrar el item del estado local
      onUpdate((prevItems) => prevItems.filter((i) => i.id !== item.id));
      toast({ title: "Success", description: "Deck moved to trash." });
      // No necesitamos router.refresh() aquí si actualizamos el estado local
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group touch-manipulation">
      {isRenaming && (
        // Pasar is_folder como false o quitarlo si RenameDialog ya no lo necesita
        <RenameDialog
          item={{...item, is_folder: false}} // Asegurarse que se pasa como no-carpeta
          isOpen={isRenaming}
          onClose={() => setIsRenaming(false)}
        />
      )}
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
        </div>
      )}
      <DeckCard deck={item} isEditMode={isEditMode} />
    </div>
  );
}

// ---- Componente Principal ----
export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
    // Filtrar explícitamente las carpetas al inicio
    const initialDecksOnly = useMemo(() => initialItems.filter(item => !item.is_folder), [initialItems]);
    const [items, setItems] = useState<Item[]>(initialDecksOnly); // Estado solo con mazos

    const [activeDragItem, setActiveDragItem] = useState<Item | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const router = useRouter();
    const { toast } = useToast();
    const [showWelcomePopup, setShowWelcomePopup] = useState(false);

     const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8, }}),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6, }}),
        useSensor(PointerSensor, { activationConstraint: { distance: 10, }})
    );

     useEffect(() => {
         // Ordenar los mazos iniciales
         const sortedDecks = [...initialDecksOnly].sort((a, b) => {
            const posA = a.position ?? Infinity;
            const posB = b.position ?? Infinity;
            if (posA !== posB) return posA - posB;
            return (b.created_at ?? "").localeCompare(a.created_at ?? ""); // Más nuevos primero si no hay posición
        });
        setItems(sortedDecks);

        // Lógica del popup
        const hasSeenPopup = localStorage.getItem('hasSeenWelcomePopup');
        // Mostrar popup solo si hay mazos (o ajustar según prefieras)
        if (!hasSeenPopup && sortedDecks.length > 0) {
            setShowWelcomePopup(true);
            localStorage.setItem('hasSeenWelcomePopup', 'true');
        }
     }, [initialDecksOnly]); // Depender de initialDecksOnly

    // IDs de los items (solo mazos)
    const itemIds = useMemo(() => items.map(item => item.id), [items]);

    const handleDragStart = (event: DragStartEvent) => {
         if (!isEditMode) return;
        const { active } = event;
        // Asegurarse de que solo se pueden arrastrar mazos
        const item = items.find((i) => i.id === active.id /* && !i.is_folder */); // Comprobación extra (aunque ya no debería haber carpetas)
        setActiveDragItem(item || null);
     };

    const calculateNewPosition = (
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

   // --- handleDragEnd SIMPLIFICADO (solo reordenamiento de mazos) ---
   const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id;
    const overIdResolved = over?.id;

    setActiveDragItem(null);

    const activeItem = items.find((item) => item.id === activeId);

    // Solo proceder si se arrastró un mazo y se soltó sobre otro mazo
    if (!activeItem || !overIdResolved || activeId === overIdResolved) {
        console.log("DragEnd: No valid reorder action.");
        return;
    }

    const oldIndex = items.findIndex((item) => item.id === activeId);
    const newIndex = items.findIndex((item) => item.id === overIdResolved);

    if (oldIndex === newIndex) {
         console.log("DragEnd: Indices are the same.");
        return; // No hubo cambio
    }

    const supabase = createClient();
    let initialItemsSnapshot = [...items];
    const newItemsOrder = arrayMove(items, oldIndex, newIndex);
    const updatesMap: Record<string, Partial<Item>> = {};
    let successMessage = "Deck reordered.";
    let errorMessage = "Failed to reorder deck.";

    try {
        // Recalcular posiciones para todos los mazos en el nuevo orden
        for (let i = 0; i < newItemsOrder.length; i++) {
            const currentItem = newItemsOrder[i];
            const prevItem = newItemsOrder[i - 1];
            const nextItem = newItemsOrder[i + 1];
            const calculatedPos = calculateNewPosition(prevItem?.position, nextItem?.position, i);

            // Marcar para actualización si la posición calculada es diferente a la actual
            if (currentItem.position !== calculatedPos) {
                 updatesMap[currentItem.id] = { position: calculatedPos };
                 // Actualizar posición en el array de trabajo para cálculos siguientes
                 newItemsOrder[i].position = calculatedPos;
             }
        }

        // Aplicar estado local
        setItems(newItemsOrder);

        // Actualizar Base de Datos
        if (Object.keys(updatesMap).length > 0) {
            console.log("Updating DB positions:", updatesMap);
            const updatePromises = Object.entries(updatesMap).map(([id, updateData]) =>
                supabase.from("decks").update(updateData).eq("id", id)
            );
            const results = await Promise.all(updatePromises);
            const firstError = results.find((r) => r.error);

            if (firstError) {
                console.error("Supabase position update error:", firstError.error);
                throw new Error(errorMessage + ` (${firstError.error.message})`);
            } else {
                toast({ title: "Success", description: successMessage });
            }
        } else {
            console.log("No position updates needed for DB.");
        }

    } catch (error: any) {
        console.error("Error during drag end:", error);
        toast({ variant: "destructive", title: "Error", description: error.message || "An error occurred during reordering." });
        setItems(initialItemsSnapshot); // Revertir
    }
   };

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
         <div> <h1 className="text-3xl font-bold">My Decks</h1> <p className="text-muted-foreground"> Manage your study flashcard decks </p> </div>
        <div className="flex items-center gap-2">
            <Button variant={isEditMode ? "default" : "outline"} onClick={() => setIsEditMode((prev) => !prev)} > <Edit className="mr-2 h-4 w-4" /> {isEditMode ? "Done" : "Edit"} </Button>
            {/* --- Botón Crear Carpeta ahora usa el diálogo de mantenimiento --- */}
            {isEditMode && <CreateFolderDialog onFolderCreated={() => { /* No hacer nada aquí */ }} />}
            <CreateAIDeckDialog />
            <CreateDeckDialog onDeckCreated={() => router.refresh()} />
         </div>
      </div>

      {items.length === 0 && !isEditMode ? (
         // --- Mensaje de dashboard vacío con botones alineados ---
         <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <BookOpen className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Your dashboard is empty</h2>
            <p className="mb-6 text-muted-foreground"> Create your first deck to get started. </p>
            {/* Envolver botones en un div con flex para controlar alineación y espacio */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                {/* Asegurarse que ambos diálogos/botones usen el mismo tamaño */}
                <CreateDeckDialog onDeckCreated={() => router.refresh()} size="lg" />
                {/* Pasar size="lg" a CreateAIDeckDialog si es necesario (depende de su implementación interna) */}
                <CreateAIDeckDialog />
            </div>
         </div>
      ) : (
        // --- Contexto DND simplificado ---
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Único SortableContext para todos los mazos */}
          <SortableContext items={itemIds} strategy={rectSortingStrategy}>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {items.map((deck) => (
                <DraggableDeckItem
                  key={deck.id}
                  item={deck}
                  isEditMode={isEditMode}
                  onUpdate={setItems}
                />
              ))}
            </div>
          </SortableContext>

          {/* Overlay (sin cambios) */}
          <DragOverlay dropAnimation={null}>
              {activeDragItem && !activeDragItem.is_folder ? ( // Asegurarse que solo se muestre overlay para mazos
                    <div className="shadow-xl rounded-xl">
                      <DeckCard deck={activeDragItem} isEditMode={isEditMode} />
                    </div>
              ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Popup de bienvenida (sin cambios) */}
      <AlertDialog open={showWelcomePopup} onOpenChange={setShowWelcomePopup}>
            <AlertDialogContent> <AlertDialogHeader> <AlertDialogTitle className="flex items-center gap-2"> <Info className="h-5 w-5 text-blue-500" /> Welcome to Memoria! </AlertDialogTitle> <AlertDialogDescription> Memoria helps you learn faster using spaced repetition. To get the most out of it, check out the Help page to discover all the features and how it works. </AlertDialogDescription> </AlertDialogHeader> <AlertDialogFooter> <AlertDialogCancel>Dismiss</AlertDialogCancel> <AlertDialogAction asChild> <Link href="/help">Go to Help Page</Link> </AlertDialogAction> </AlertDialogFooter> </AlertDialogContent>
      </AlertDialog>
    </>
  );
}