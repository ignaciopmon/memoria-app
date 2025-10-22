// app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Brain, Menu } from "lucide-react"
import { DashboardClient } from "@/components/dashboard-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // --- CORRECCIÓN EN LA CONSULTA ---
  // Modificar la consulta para contar solo las tarjetas NO borradas
  const { data: allItems, error } = await supabase
    .from("decks")
    .select(`
      id,
      name,
      description,
      color,
      position,
      created_at,
      cards!inner(count)
    `)                             // Selecciona explícitamente y pide el count de 'cards'
    .is("deleted_at", null)      // Asegura que el deck no esté borrado
    .eq("is_folder", false)     // Asegura que no sea una carpeta
    .is('cards.deleted_at', null) // <<< FILTRA LAS TARJETAS QUE SE CUENTAN
    .order("position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  // --- FIN DE LA CORRECCIÓN ---

  if (error) {
    console.error("Error fetching decks with active card count:", error)
    // Considera devolver un estado de error o un array vacío si prefieres
  }

  // El mapeo sigue funcionando porque la estructura devuelta es la misma,
  // pero el 'count' ahora está filtrado por la consulta.
  const itemsWithCount = allItems?.map((item) => ({
    ...item,
    cardCount: item.cards && item.cards.length > 0 ? item.cards[0].count : 0, // Ajuste para manejar el caso donde cards puede ser [] si no hay activas
    // Asegurarse de que las propiedades esperadas por DraggableDeckItem estén presentes
    is_folder: false, // Añadir explícitamente si es necesario en el componente hijo
    parent_id: null,  // Añadir explícitamente si es necesario en el componente hijo
  })) || []

return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
         <Link href="/" className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
           <span className="text-xl font-bold select-none">Memoria</span>
         </Link>

          {/* Navegación Desktop */}
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/upcoming">Upcoming</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/trash">Trash</Link>
            </Button>
            <span className="h-6 border-l"></span>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings">Settings</Link>
            </Button>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Sign Out
              </Button>
            </form>
          </div>

          {/* Menú Móvil */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><Link href="/upcoming">Upcoming</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/trash">Trash</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/settings">Settings</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                   <form action="/auth/signout" method="post" className="w-full">
                      <button type="submit" className="w-full text-left">Sign Out</button>
                    </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Pasar los items con el conteo ya corregido */}
          <DashboardClient initialItems={itemsWithCount} />
        </div>
      </main>
    </div>
  )
}