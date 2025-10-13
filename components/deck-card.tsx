"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Trash2, Play } from "lucide-react"
import Link from "next/link"
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

interface DeckCardProps {
  deck: {
    id: string
    name: string
    description: string | null
    cardCount: number
    created_at: string
  }
}

export function DeckCard({ deck }: DeckCardProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from("decks").delete().eq("id", deck.id)

      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error("[v0] Error deleting deck:", error)
      alert("Error al eliminar el mazo")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="line-clamp-1">{deck.name}</CardTitle>
            <CardDescription className="line-clamp-2">{deck.description || "Sin descripción"}</CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar mazo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminarán todas las tarjetas asociadas a este mazo.
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
      </CardHeader>
      <CardContent className="flex-1">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span>{deck.cardCount} tarjetas</span>
        </div>
        <div className="flex gap-2">
          <Button asChild className="flex-1 bg-transparent" variant="outline">
            <Link href={`/deck/${deck.id}`}>Ver Tarjetas</Link>
          </Button>
          {deck.cardCount > 0 && (
            <Button asChild className="flex-1">
              <Link href={`/study/${deck.id}`}>
                <Play className="mr-2 h-4 w-4" />
                Estudiar
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
