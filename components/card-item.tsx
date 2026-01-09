// components/card-item.tsx
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Edit, ChevronDown, ChevronRight, Image as ImageIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
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
} from "@/components/ui/alert-dialog"
import { EditCardDialog } from "@/components/edit-card-dialog"
import { Badge } from "@/components/ui/badge"
import { ImageViewerDialog } from "./image-viewer-dialog" // Importante: Funcionalidad de Zoom

interface CardItemProps {
  card: {
    id: string
    front: string
    back: string
    front_image_url: string | null
    back_image_url: string | null
    ease_factor: number
    interval: number
    repetitions: number
    next_review_date: string
    created_at: string
  }
  isNew: boolean
}

export function CardItem({ card, isNew }: CardItemProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showBack, setShowBack] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from("cards")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", card.id)
      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error("Error sending card to trash:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="overflow-hidden transition-colors hover:border-primary/50">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          
          {/* CONTENIDO PRINCIPAL (FRONT) */}
          <div className="flex-1 p-4 md:p-5 space-y-3">
             <div className="flex justify-between items-start gap-4">
                <div className="space-y-2 w-full">
                    {/* Header pequeña */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded">
                            Question
                        </span>
                        {isNew && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-green-500 text-green-600 bg-green-50">
                                NEW
                            </Badge>
                        )}
                    </div>
                    
                    {/* Imagen Frontal con Zoom */}
                    {card.front_image_url && (
                        <div className="mt-2">
                             <ImageViewerDialog 
                                src={card.front_image_url} 
                                alt="Front image" 
                                triggerClassName="relative h-32 w-full md:w-48 rounded-lg border overflow-hidden bg-muted/50 hover:opacity-90 transition-opacity"
                             />
                        </div>
                    )}

                    <p className="text-base font-medium leading-relaxed">{card.front}</p>
                </div>

                {/* Acciones */}
                <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">
                    <EditCardDialog card={card} />
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Delete Card</AlertDialogTitle>
                            <AlertDialogDescription>Are you sure? This action sends the card to the trash.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground">
                                Delete
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
             </div>
          </div>

          {/* SEPARADOR / TOGGLE RESPUESTA */}
          {/* Si está expandido mostramos la respuesta, si no un botón sutil */}
          <div className={`border-t md:border-t-0 md:border-l bg-muted/10 transition-all duration-300 ${showBack ? 'flex-1' : 'md:w-12 flex items-center justify-center cursor-pointer hover:bg-muted/30'}`} onClick={() => !showBack && setShowBack(true)}>
             
             {!showBack ? (
                 <button className="w-full h-full p-2 flex md:flex-col items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors" title="Show Answer">
                    <ChevronRight className="h-4 w-4 md:rotate-0 rotate-90" />
                    <span className="md:vertical-rl md:rotate-180">ANSWER</span>
                 </button>
             ) : (
                <div className="p-4 md:p-5 h-full bg-muted/20 animate-in fade-in slide-in-from-top-1 md:slide-in-from-left-1 duration-200">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-background px-1.5 py-0.5 rounded shadow-sm">
                            Answer
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => {e.stopPropagation(); setShowBack(false);}}>
                            <ChevronDown className="h-4 w-4 md:rotate-90 rotate-180" />
                        </Button>
                    </div>

                    {/* Imagen Trasera con Zoom */}
                    {card.back_image_url && (
                        <div className="mb-3">
                            <ImageViewerDialog 
                                src={card.back_image_url} 
                                alt="Back image" 
                                triggerClassName="relative h-32 w-full rounded-lg border overflow-hidden bg-background hover:opacity-90 transition-opacity"
                            />
                        </div>
                    )}

                    <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">{card.back}</p>
                </div>
             )}
          </div>

        </div>
      </CardContent>
    </Card>
  )
}