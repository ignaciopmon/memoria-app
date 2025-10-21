// components/create-folder-dialog.tsx
"use client"

import type React from "react"
import { useState } from "react"
// Removidos imports innecesarios: useRouter, createClient, Input, Label
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FolderPlus, Construction } from "lucide-react" // Añadido Construction

// Removido onFolderCreated de las props, ya no es necesario
export function CreateFolderDialog() {
  const [open, setOpen] = useState(false)
  // Removidos estados de name y isLoading

  // Removida función handleSubmit

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FolderPlus className="mr-2 h-4 w-4" />
          New Folder
        </Button>
      </DialogTrigger>
      {/* Contenido modificado para mostrar mensaje */}
      <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Construction className="h-5 w-5 text-orange-500"/>
                Feature Under Maintenance
            </DialogTitle>
            <DialogDescription>
                The folder organization feature is temporarily unavailable while we make improvements. Your existing decks remain accessible. We apologize for any inconvenience!
            </DialogDescription>
          </DialogHeader>
           {/* Solo botón para cerrar */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}