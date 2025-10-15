// components/image-viewer-dialog.tsx
"use client"

import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface ImageViewerDialogProps {
  src: string;
  alt: string;
  triggerClassName?: string;
}

export function ImageViewerDialog({ src, alt, triggerClassName }: ImageViewerDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className={cn("relative mx-auto h-32 w-full cursor-pointer sm:h-48", triggerClassName)}>
          <Image 
            src={src} 
            alt={alt} 
            layout="fill" 
            objectFit="contain" 
            className="rounded-md" 
          />
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-transparent border-0 shadow-none p-2" showCloseButton={false}>
        <div className="relative w-full h-[80vh]">
           <Image 
            src={src} 
            alt={alt} 
            layout="fill" 
            objectFit="contain" 
            className="rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}