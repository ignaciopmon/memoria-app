import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Brain, Menu, LayoutDashboard, Activity } from "lucide-react"
import { DashboardClient } from "@/components/dashboard-client"
import { StudyStats } from "@/components/study-stats"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Obtener Mazos
  const { data: allItems, error } = await supabase
    .from("decks")
    .select(`
      id, name, description, color, position, created_at,
      cards!inner(count)
    `)
    .is("deleted_at", null)
    .eq("is_folder", false)
    .is('cards.deleted_at', null)
    .order("position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  // Obtener Revisiones para Estadísticas (últimos 60 días)
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const { data: reviews } = await supabase
    .from("card_reviews")
    .select("rating, reviewed_at")
    .gte("reviewed_at", sixtyDaysAgo.toISOString());

  const itemsWithCount = allItems?.map((item) => ({
    ...item,
    cardCount: item.cards && item.cards.length > 0 ? item.cards[0].count : 0,
    is_folder: false,
    parent_id: null,
  })) || []

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
         <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Brain className="h-6 w-6 text-primary" />
           <span className="text-xl font-bold select-none">Memoria</span>
         </Link>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" size="sm" asChild><Link href="/upcoming">Upcoming</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/trash">Trash</Link></Button>
            <span className="h-6 border-l mx-1"></span>
            <Button variant="ghost" size="sm" asChild><Link href="/settings">Settings</Link></Button>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">Sign Out</Button>
            </form>
          </div>

          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
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
          
          <Tabs defaultValue="decks" className="w-full space-y-6">
            
            {/* Pestañas de Selección */}
            <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-2">
              <TabsTrigger value="decks" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                My Decks
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
            </TabsList>

            {/* Contenido: Mazos */}
            <TabsContent value="decks" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <DashboardClient initialItems={itemsWithCount} />
            </TabsContent>

            {/* Contenido: Estadísticas */}
            <TabsContent value="activity" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="mb-8 flex flex-col gap-1">
                 <h2 className="text-3xl font-bold">Your Activity</h2>
                 <p className="text-muted-foreground">Track your study progress, retention, and learning streaks.</p>
              </div>
              <StudyStats reviews={reviews || []} />
            </TabsContent>

          </Tabs>

        </div>
      </main>
    </div>
  )
}