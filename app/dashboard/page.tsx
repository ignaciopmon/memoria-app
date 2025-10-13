// app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Brain, BookOpen } from "lucide-react"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { CreateFolderDialog } from "@/components/create-folder-dialog"
import { DashboardClient } from "@/components/dashboard-client"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch all decks and folders
  const { data: allItems, error } = await supabase
    .from("decks")
    .select(`
      *,
      cards:cards(count)
    `)
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
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Decks</h1>
              <p className="text-muted-foreground">Manage your study flashcard decks</p>
            </div>
            <div className="flex gap-2">
              <CreateFolderDialog />
              <CreateDeckDialog />
            </div>
          </div>

          {itemsWithCount.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">You don't have any decks yet</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  Create your first folder or deck to start studying
                </p>
                <div className="flex gap-2">
                   <CreateFolderDialog />
                   <CreateDeckDialog />
                </div>
              </CardContent>
            </Card>
          ) : (
            <DashboardClient initialItems={itemsWithCount} />
          )}
        </div>
      </main>
    </div>
  )
}