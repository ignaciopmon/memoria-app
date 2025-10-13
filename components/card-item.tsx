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

interface CardItemProps {
  card: {
    id: string
    front: string
    back: string
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
      const { error } = await supabase.from("cards").delete().eq("id", card.id)

      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error("[v0] Error deleting card:", error)
      alert("Error al eliminar la tarjeta")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">FRENTE</p>
              <p className="text-base">{card.front}</p>
            </div>
            <div>
              <button
                onClick={() => setShowBack(!showBack)}
                className="mb-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                REVERSO {showBack ? "▼" : "▶"}
              </button>
              {showBack && <p className="text-base text-muted-foreground">{card.back}</p>}
            </div>
          </div>
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
                  <AlertDialogTitle>¿Eliminar tarjeta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará permanentemente esta tarjeta.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Eliminando..." : "Eliminar"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
