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
  }
}

export function CardItem({ card }: CardItemProps) {
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
  
  const imageToShow = showBack ? card.back_image_url : card.front_image_url;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Contenedor de la Imagen */}
          {imageToShow && (
            <div className="relative h-28 w-28 flex-shrink-0 rounded-md bg-muted">
              <Image 
                src={imageToShow} 
                alt={showBack ? "Back image" : "Front image"} 
                layout="fill" 
                objectFit="cover" 
                className="rounded-md" 
              />
            </div>
          )}

          {/* Contenedor de Texto y Acciones */}
          <div className="flex flex-1 flex-col">
            <div className="flex justify-between">
              {/* Textos */}
              <div className="flex-1 space-y-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">FRONT</p>
                  <p className="text-base">{card.front}</p>
                </div>
                <div>
                  <button onClick={() => setShowBack(!showBack)} className="mb-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                    BACK {showBack ? "▼" : "▶"}
                  </button>
                  {showBack && <p className="text-base text-muted-foreground">{card.back}</p>}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-1">
                <EditCardDialog card={card} />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete card?</AlertDialogTitle>
                      <AlertDialogDescription>This action cannot be undone. This will permanently delete this card.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {isDeleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}