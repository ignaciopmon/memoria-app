"use client"

import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Maximize2 } from "lucide-react"

interface ImageViewerDialogProps {
  src: string
  alt: string
  triggerClassName?: string
}

export function ImageViewerDialog({ src, alt, triggerClassName }: ImageViewerDialogProps) {
  if (!src) return null

  return (
    <Dialog>
      <DialogTrigger className={`group relative flex items-center justify-center overflow-hidden cursor-zoom-in ${triggerClassName}`}>
        {/* Usamos <img> estándar. Es a prueba de fallos con Supabase */}
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
          <Maximize2 className="text-foreground/70 w-6 h-6 drop-shadow-md bg-background/50 p-1 rounded-full" />
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[90vw] h-[80vh] p-2 bg-transparent border-none shadow-none flex justify-center items-center">
        <img 
          src={src} 
          alt={alt} 
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        />
      </DialogContent>
    </Dialog>
  )
}