// components/rename-dialog.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface RenameDialogProps {
  item: { id: string; name: string; is_folder: boolean }
  isOpen: boolean
  onClose: () => void
}

export function RenameDialog({ item, isOpen, onClose }: RenameDialogProps) {
  const [newName, setNewName] = useState(item.name)
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    if (!newName.trim() || newName === item.name) {
      onClose()
      return
    }
    setIsProcessing(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("decks")
      .update({ name: newName })
      .eq("id", item.id)

    if (error) {
      alert("Error renaming item.")
    } else {
      router.refresh()
    }
    setIsProcessing(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {item.is_folder ? "Folder" : "Deck"}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="name">New Name</Label>
          <Input
            id="name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}