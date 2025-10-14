// app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { cookies } from "next/headers"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Brain, BookOpen, Edit } from "lucide-react"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { CreateFolderDialog } from "@/components/create-folder-dialog"
import { DashboardClient } from "@/components/dashboard-client"

export default async function DashboardPage() {
  const cookieStore = cookies()
  const isEditMode = cookieStore.get("editMode")?.value === "true"

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
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            <span className="text-xl font-bold">Memoria</span>
          </div>
          <div className="flex items-center gap-2">
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
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* === LÓGICA CONDICIONAL AÑADIDA AQUÍ === */}
          {itemsWithCount.length === 0 ? (
            // VISTA CUANDO NO HAY MAZOS
            <div className="flex h-[60vh] flex-col items-center justify-center text-center">
              <BookOpen className="mb-4 h-16 w-16 text-muted-foreground" />
              <h2 className="text-2xl font-semibold">Your dashboard is empty</h2>
              <p className="mb-6 text-muted-foreground">Create your first deck to get started.</p>
              <CreateDeckDialog />
            </div>
          ) : (
            // VISTA NORMAL CUANDO SÍ HAY MAZOS
            <>
              <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold">My Decks</h1>
                  <p className="text-muted-foreground">Manage your study flashcard decks</p>
                </div>
                <div className="flex items-center gap-2">
                    <form action={async () => {
                        "use server"
                        // El estado se guarda en una cookie para persistir entre recargas
                        const currentMode = cookies().get("editMode")?.value === "true"
                        cookies().set("editMode", String(!currentMode))
                        redirect("/dashboard")
                    }}>
                        <Button variant={isEditMode ? "default" : "outline"} type="submit">
                            <Edit className="mr-2 h-4 w-4" />
                            {isEditMode ? "Done" : "Edit"}
                        </Button>
                    </form>
                  {isEditMode && <CreateFolderDialog />}
                  <CreateDeckDialog />
                </div>
              </div>
              <DashboardClient initialItems={itemsWithCount} isEditMode={isEditMode} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}