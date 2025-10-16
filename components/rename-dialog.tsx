// components/rename-dialog.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea" // <-- 1. IMPORTAR TEXTAREA

interface RenameDialogProps {
  item: { 
    id: string; 
    name: string; 
    description?: string | null; // <-- 2. AÑADIR DESCRIPCIÓN (opcional)
    is_folder: boolean 
  }
  isOpen: boolean
  onClose: () => void
}

export function RenameDialog({ item, isOpen, onClose }: RenameDialogProps) {
  const [newName, setNewName] = useState(item.name)
  // --- 3. AÑADIR ESTADO PARA DESCRIPCIÓN ---
  const [newDescription, setNewDescription] = useState(item.description || "") 
  // ---
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    // Comprobar si hay cambios, si no, solo cerrar.
    if (!newName.trim() || (newName === item.name && newDescription === (item.description || ""))) {
      onClose()
      return
    }
    
    setIsProcessing(true)
    const supabase = createClient()
    
    // --- 4. ACTUALIZAR LÓGICA DE GUARDADO ---
    const { error } = await supabase
      .from("decks")
      .update({ 
        name: newName,
        description: newDescription || null // Guardar string vacío como null
      })
      .eq("id", item.id)
    // ---

    if (error) {
      alert("Error updating item.")
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
           {/* 5. TÍTULO ACTUALIZADO */}
          <DialogTitle>Edit {item.is_folder ? "Folder" : "Deck"}</DialogTitle>
        </DialogHeader>
        {/* 6. FORMULARIO ACTUALIZADO CON AMBOS CAMPOS */}
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          {!item.is_folder && ( // Solo mostrar descripción si NO es una carpeta
             <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
              />
            </div>
          )}
        </div>
        {/* --- */}
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