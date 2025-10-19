// app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Brain, Menu } from "lucide-react" // Importa el icono del menú
import { DashboardClient } from "@/components/dashboard-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu" // Importa los componentes del menú

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: allItems, error } = await supabase
    .from("decks")
    .select(`*, cards:cards(count)`)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching decks and folders:", error)
  }

  const itemsWithCount = allItems?.map((item) => ({
    ...item,
    cardCount: item.cards?.[0]?.count || 0,
  })) || []

return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
         <Link href="/" className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
           <span className="text-xl font-bold select-none">Memoria</span> {/* Texto no seleccionable */}
         </Link>
         
          {/* NAVEGACIÓN PARA ESCRITORIO (se oculta en móvil) */}
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

          {/* MENÚ DESPLEGABLE PARA MÓVIL (se oculta en escritorio) */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/upcoming">Upcoming</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/trash">Trash</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                   <form action="/auth/signout" method="post" className="w-full">
                      <button type="submit" className="w-full text-left">
                        Sign Out
                      </button>
                    </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <DashboardClient initialItems={itemsWithCount} />
        </div>
      </main>
    </div>
  )
}