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
import { FolderCard } from "./folder-card";
import { MoveToFolderDialog } from "./move-to-folder-dialog";
import { Button } from "./ui/button";
import {
  GripVertical, Trash2, Edit, Loader2, BookOpen, Info, GraduationCap
} from "lucide-react";
import { RenameDialog } from "./rename-dialog";
import { ColorPopover } from "./color-popover";
import { CreateDeckDialog } from "./create-deck-dialog";
import { CreateAIDeckDialog } from "./create-ai-deck-dialog";
import { CreateFolderDialog } from "./create-folder-dialog";
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

export type Item = {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
  color: string | null;
  position: number | null;
  created_at?: string;
  is_folder: boolean;
  parent_id: string | null;
};

function DraggableDeckItem({
  item,
  isEditMode,
  onUpdate,
  availableFolders
}: {
  item: Item;
  isEditMode: boolean;
  onUpdate: (updater: (prev: Item[]) => Item[]) => void;
  availableFolders: any[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !isEditMode });
  const { toast } = useToast();
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (isDragging) {
    return (
      <div ref={setNodeRef} style={{ transition }} className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 h-full min-h-[180px] w-full" />
    );
  }

  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleDelete = async () => {
    setIsDeleting(true);
    const supabase = createClient();
    
    // Si es una carpeta, mandar sus hijos a la papelera también
    if (item.is_folder) {
        await supabase.from("decks").update({ deleted_at: new Date().toISOString() }).eq("parent_id", item.id);
    }
    const { error } = await supabase.from("decks").update({ deleted_at: new Date().toISOString() }).eq("id", item.id);
      
    if (error) {
      setIsDeleting(false);
      toast({ variant: "destructive", title: "Error deleting item." });
    } else {
      onUpdate((prevItems) => prevItems.filter((i) => i.id !== item.id));
      toast({ title: "Moved to trash." });
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group touch-manipulation h-full">
      {isRenaming && (
        <RenameDialog item={item} isOpen={isRenaming} onClose={() => setIsRenaming(false)} />
      )}
      
      {isEditMode && (
         <div {...listeners} {...attributes} className="absolute top-1/2 -left-3 transform -translate-y-1/2 z-20 p-2 cursor-grab active:cursor-grabbing touch-none bg-background/80 border rounded-full shadow-md hover:bg-accent transition-colors" title="Move Position">
            <GripVertical className="h-5 w-5 text-foreground" />
          </div>
      )}

      {isEditMode && (
        <div className="absolute top-3 right-3 z-20 flex items-center bg-background/95 backdrop-blur-md rounded-lg border shadow-lg p-1 gap-1 animate-in fade-in zoom-in-95 duration-200">
            {/* Solo se permite mover mazos o carpetas vacías (para evitar bugs de recursión), en este caso dejamos mover a todos */}
            {!item.is_folder && (
                <MoveToFolderDialog 
                    item={item} 
                    availableFolders={availableFolders.filter(f => f.id !== item.id)} 
                    onMoved={(id) => {
                        onUpdate((prev) => prev.filter((i) => i.id !== id));
                        toast({ title: "Moved successfully!" });
                    }} 
                />
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => setIsRenaming(true)} title="Rename" > <Edit className="h-4 w-4" /> </Button>
            <ColorPopover itemId={item.id} currentColor={item.color} onColorChange={(color) => { onUpdate((prev) => prev.map((it) => (it.id === item.id ? { ...it, color } : it)) ); }} />
            <div className="w-px h-4 bg-border mx-1" />
            <AlertDialog>
                <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" title="Delete" disabled={isDeleting} >
                    {isDeleting ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<Trash2 className="h-4 w-4" />)}
                </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                <AlertDialogHeader> <AlertDialogTitle>Delete "{item.name}"?</AlertDialogTitle> <AlertDialogDescription> This will move it to the trash. {item.is_folder && "Everything inside this folder will also be deleted."} </AlertDialogDescription> </AlertDialogHeader>
                <AlertDialogFooter> <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel> <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" > {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Move to Trash </AlertDialogAction> </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      )}
      
      {item.is_folder ? (
          <FolderCard folder={item} isEditMode={isEditMode} />
      ) : (
          <DeckCard deck={item} isEditMode={isEditMode} />
      )}
    </div>
  );
}

export function DashboardClient({ initialItems, availableFolders, currentFolderId = null }: { initialItems: Item[], availableFolders: any[], currentFolderId?: string | null }) {
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

        if (!currentFolderId) {
          const hasSeenPopup = localStorage.getItem('hasSeenWelcomePopup');
          if (!hasSeenPopup && sortedDecks.length > 0) {
              setShowWelcomePopup(true);
              localStorage.setItem('hasSeenWelcomePopup', 'true');
          }
        }
     }, [initialItems, currentFolderId]);

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
            toast({ title: "Success", description: "Order saved." });
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
         <div> 
             <h1 className="text-3xl font-bold">{currentFolderId ? "Inside Folder" : "My Decks"}</h1> 
             <p className="text-muted-foreground">{currentFolderId ? "Manage decks inside this folder" : "Manage your study flashcard decks"}</p> 
         </div>
        <div className="flex flex-wrap items-center gap-2">
            <Button variant={isEditMode ? "default" : "outline"} onClick={() => setIsEditMode((prev) => !prev)} className={isEditMode ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}> 
              <Edit className="mr-2 h-4 w-4" /> {isEditMode ? "Done Editing" : "Edit / Move"} 
            </Button>
            <Button asChild variant="outline" className="border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary hover:text-primary">
                <Link href="/ai-test"><GraduationCap className="mr-2 h-4 w-4" />Practice Test</Link>
            </Button>
            <CreateFolderDialog parentId={currentFolderId} />
            <CreateAIDeckDialog size="default" parentId={currentFolderId} />
            <CreateDeckDialog onDeckCreated={() => router.refresh()} size="default" parentId={currentFolderId} />
         </div>
      </div>

      {items.length === 0 && !isEditMode ? (
         <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
            <div className="bg-muted/30 p-6 rounded-full mb-6">
                <BookOpen className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">{currentFolderId ? "This folder is empty" : "Your dashboard is empty"}</h2>
            <p className="mb-6 text-muted-foreground max-w-sm"> Create your first deck manually or let our AI generate one for you in seconds. </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <CreateDeckDialog onDeckCreated={() => router.refresh()} size="lg" parentId={currentFolderId} />
                <span className="text-sm text-muted-foreground font-medium">OR</span>
                <CreateAIDeckDialog size="lg" parentId={currentFolderId} />
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-stretch">
              {items.map((item) => (
                <DraggableDeckItem
                  key={item.id}
                  item={item}
                  isEditMode={isEditMode}
                  onUpdate={setItems}
                  availableFolders={availableFolders}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
              {activeDragItem ? (
                    <div className="shadow-2xl scale-105 cursor-grabbing opacity-90 rotate-2">
                      {activeDragItem.is_folder ? <FolderCard folder={activeDragItem} isEditMode={true} /> : <DeckCard deck={activeDragItem} isEditMode={true} />}
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