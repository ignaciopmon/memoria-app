// components/card-item.tsx
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
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
import Image from "next/image"
import { Badge } from "@/components/ui/badge" // <-- 1. IMPORTAR BADGE

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
    created_at: string // <-- Asegurarse de que 'created_at' está en el tipo (viene de select("*"))
  }
  isNew: boolean // <-- 2. AÑADIR 'isNew' A LAS PROPS
}

export function CardItem({ card, isNew }: CardItemProps) { // <-- 3. RECIBIR 'isNew'
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
      alert("Error sending card to trash")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        {/* Main container: stacks vertically on mobile, horizontally on desktop */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          
          {/* Columna de Imágenes (ahora se adapta) */}
          {(card.front_image_url || card.back_image_url) && (
             <div className="flex flex-row gap-2 md:flex-col md:w-32 flex-shrink-0">
                {card.front_image_url && (
                    <div className="relative h-24 w-full">
                        <Image src={card.front_image_url} alt="Front image" layout="fill" objectFit="cover" className="rounded-md bg-muted" />
                    </div>
                )}
                {showBack && card.back_image_url && (
                    <div className="relative h-24 w-full">
                        <Image src={card.back_image_url} alt="Back image" layout="fill" objectFit="cover" className="rounded-md bg-muted" />
                    </div>
                )}
             </div>
          )}

          {/* Columna de Texto y Acciones */}
          <div className="flex-1 space-y-4">
            <div className="flex justify-between">
              <div>
                {/* --- 4. AÑADIR LÓGICA DE BADGE --- */}
                <div className="flex items-center gap-2">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">FRONT</p>
                  {isNew && (
                    <Badge 
                      variant="outline" 
                      className="h-auto px-1.5 py-0 text-xs font-medium text-green-600 border-green-500 bg-green-500/10"
                    >
                      NEW
                    </Badge>
                  )}
                </div>
                {/* --- FIN DE LÓGICA DE BADGE --- */}
                <p className="text-base">{card.front}</p>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <EditCardDialog card={card} />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                     <AlertDialogTitle>Move card to trash?</AlertDialogTitle>
                     <AlertDialogDescription>
                       This will move the card to the trash. You can restore it later or delete it permanently from there.
                     </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {isDeleting ? "Moving..." : "Move to Trash"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            
            <div>
              <button onClick={() => setShowBack(!showBack)} className="mb-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                BACK {showBack ? "▼" : "▶"}
              </button>
              {showBack && <p className="text-base text-muted-foreground">{card.back}</p>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}