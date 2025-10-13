"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Trash2 } from "lucide-react"

interface DeleteFolderDialogProps {
  folder: { id: string; name: string }
  decksInFolder: Array<{ id: string }>
  onDelete: (deletedIds: string[]) => void
}

export function DeleteFolderDialog({ folder, decksInFolder, onDelete }: DeleteFolderDialogProps) {
  const [open, setOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleDeleteFolderOnly = async () => {
    setIsProcessing(true)
    const supabase = createClient()
    try {
      if (decksInFolder.length > 0) {
        const deckIds = decksInFolder.map(d => d.id)
        const { error: updateError } = await supabase
          .from("decks")
          .update({ parent_id: null })
          .in("id", deckIds)
        if (updateError) throw updateError
      }
      
      const { error: deleteError } = await supabase
        .from("decks")
        .delete()
        .eq("id", folder.id)
      if (deleteError) throw deleteError

      onDelete([folder.id])
      setOpen(false)
    } catch (error) {
      alert("Error deleting folder.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteFolderAndContents = async () => {
    setIsProcessing(true)
    const supabase = createClient()
    try {
      const idsToTrash = [folder.id, ...decksInFolder.map(d => d.id)]
      const { error } = await supabase
        .from("decks")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", idsToTrash)
      if (error) throw error

      onDelete(idsToTrash)
      setOpen(false)
    } catch (error) {
      alert("Error sending items to trash.")
    } finally {
      setIsProcessing(false)
    }
  }

  const isEmpty = decksInFolder.length === 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete folder "{folder.name}"?</DialogTitle>
          <DialogDescription>
            {isEmpty
              ? "This action will permanently delete this empty folder. This cannot be undone."
              : "Choose how you want to delete this folder and its contents."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          {!isEmpty && (
            <Button variant="outline" onClick={handleDeleteFolderOnly} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Folder Only (Move {decksInFolder.length} decks to root)
            </Button>
          )}
          <Button variant="destructive" onClick={isEmpty ? handleDeleteFolderOnly : handleDeleteFolderAndContents} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEmpty ? "Delete Permanently" : "Delete Folder and Contents (Move to Trash)"}
          </Button>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}