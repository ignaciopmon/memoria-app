// components/move-to-folder-dialog.tsx
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FolderOutput, Loader2 } from "lucide-react"

export function MoveToFolderDialog({ item, availableFolders, onMoved }: { item: any, availableFolders: any[], onMoved: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string>("root")
  const [isProcessing, setIsProcessing] = useState(false)

  const handleMove = async () => {
    setIsProcessing(true)
    const supabase = createClient()
    const targetParentId = selectedFolder === "root" ? null : selectedFolder;

    const { error } = await supabase
      .from("decks")
      .update({ parent_id: targetParentId })
      .eq("id", item.id)

    setIsProcessing(false)
    if (!error) {
      setOpen(false)
      onMoved(item.id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" title="Move to Folder">
          <FolderOutput className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move "{item.name}"</DialogTitle>
          <DialogDescription>Select where you want to move this item.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger>
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">🏠 Dashboard (Root)</SelectItem>
              {availableFolders.map(f => (
                <SelectItem key={f.id} value={f.id}>📁 {f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleMove} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Move Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}