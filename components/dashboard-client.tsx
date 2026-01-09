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
import { Button } from "./ui/button";
import {
  GripVertical,
  Trash2,
  Edit,
  Loader2,
  BookOpen,
  Info,
} from "lucide-react";
import { RenameDialog } from "./rename-dialog";
import { ColorPopover } from "./color-popover";
import { CreateDeckDialog } from "./create-deck-dialog";
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
  color: string | null;
  position: number | null;
  created_at?: string;
  // Campos "is_folder" eliminados para limpieza
};

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
          item={{...item, is_folder: false}} 
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
      <DeckCard deck={{...item, is_folder: false, parent_id: null}} isEditMode={isEditMode} />
    </div>
  );
}

export function DashboardClient({ initialItems }: { initialItems: Item[] }) {
    // Estado solo con mazos, eliminada la lógica compleja de carpetas
    const [items, setItems] = useState<Item[]>(initialItems);
    const [activeDragItem, setActiveDragItem] = useState<Item | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const router = useRouter();
    const { toast } = useToast();
    const [showWelcomePopup, setShowWelcomePopup] = useState(false);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 }}),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 }}),
        useSensor(PointerSensor, { activationConstraint: { distance: 10 }})
    );

     useEffect(() => {
         const sortedDecks = [...initialItems].sort((a, b) => {
            const posA = a.position ?? Infinity;
            const posB = b.position ?? Infinity;
            if (posA !== posB) return posA - posB;
            return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        });
        setItems(sortedDecks);

        const hasSeenPopup = localStorage.getItem('hasSeenWelcomePopup');
        if (!hasSeenPopup && sortedDecks.length > 0) {
            setShowWelcomePopup(true);
            localStorage.setItem('hasSeenWelcomePopup', 'true');
        }
     }, [initialItems]);

    const itemIds = useMemo(() => items.map(item => item.id), [items]);

    const handleDragStart = (event: DragStartEvent) => {
         if (!isEditMode) return;
        const { active } = event;
        const item = items.find((i) => i.id === active.id);
        setActiveDragItem(item || null);
     };

    const calculateNewPosition = (prevPos: number | null | undefined, nextPos: number | null | undefined, idx: number): number => {
        const defaultIncrement = 1000;
        if (prevPos == null) return nextPos ? nextPos / 2 : defaultIncrement * (idx + 1);
        if (nextPos == null) return prevPos + defaultIncrement;
        return prevPos + (nextPos - prevPos) / 2;
    };

   const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) {
        setActiveDragItem(null);
        return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    const supabase = createClient();
    let initialSnapshot = [...items];
    const newOrder = arrayMove(items, oldIndex, newIndex);
    const updatesMap: Record<string, Partial<Item>> = {};

    try {
        for (let i = 0; i < newOrder.length; i++) {
            const current = newOrder[i];
            const prev = newOrder[i - 1];
            const next = newOrder[i + 1];
            const newPos = calculateNewPosition(prev?.position, next?.position, i);

            if (current.position !== newPos) {
                 updatesMap[current.id] = { position: newPos };
                 newOrder[i].position = newPos;
             }
        }

        setItems(newOrder);
        setActiveDragItem(null);

        if (Object.keys(updatesMap).length > 0) {
            const promises = Object.entries(updatesMap).map(([id, data]) =>
                supabase.from("decks").update(data).eq("id", id)
            );
            await Promise.all(promises);
            toast({ title: "Success", description: "Deck order saved." });
        }

    } catch (error: any) {
        console.error("Reorder error:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to save order." });
        setItems(initialSnapshot);
    }
   };

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
         <div> <h1 className="text-3xl font-bold">My Decks</h1> <p className="text-muted-foreground"> Manage your study flashcard decks </p> </div>
        <div className="flex items-center gap-2">
            <Button variant={isEditMode ? "default" : "outline"} onClick={() => setIsEditMode((prev) => !prev)} > <Edit className="mr-2 h-4 w-4" /> {isEditMode ? "Done" : "Edit"} </Button>
            <CreateAIDeckDialog />
            <CreateDeckDialog onDeckCreated={() => router.refresh()} />
         </div>
      </div>

      {items.length === 0 && !isEditMode ? (
         <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
            <div className="bg-muted/30 p-6 rounded-full mb-6">
                <BookOpen className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Your dashboard is empty</h2>
            <p className="mb-6 text-muted-foreground max-w-sm"> Create your first deck manually or let our AI generate one for you in seconds. </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <CreateDeckDialog onDeckCreated={() => router.refresh()} size="lg" />
                <span className="text-sm text-muted-foreground font-medium">OR</span>
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

          <DragOverlay dropAnimation={null}>
              {activeDragItem ? (
                    <div className="shadow-2xl rounded-xl scale-105 cursor-grabbing">
                      <DeckCard deck={{...activeDragItem, is_folder: false, parent_id: null}} isEditMode={isEditMode} />
                    </div>
              ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <AlertDialog open={showWelcomePopup} onOpenChange={setShowWelcomePopup}>
            <AlertDialogContent> <AlertDialogHeader> <AlertDialogTitle className="flex items-center gap-2"> <Info className="h-5 w-5 text-primary" /> Welcome to Memoria! </AlertDialogTitle> <AlertDialogDescription> Memoria helps you learn faster using spaced repetition. To get the most out of it, check out the Help page to discover all the features and how it works. </AlertDialogDescription> </AlertDialogHeader> <AlertDialogFooter> <AlertDialogCancel>Dismiss</AlertDialogCancel> <AlertDialogAction asChild> <Link href="/help">Go to Help Page</Link> </AlertDialogAction> </AlertDialogFooter> </AlertDialogContent>
      </AlertDialog>
    </>
  );
}