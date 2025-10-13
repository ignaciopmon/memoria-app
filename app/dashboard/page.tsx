// app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Brain, BookOpen, Edit } from "lucide-react"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { CreateFolderDialog } from "@/components/create-folder-dialog"
import { DashboardClient } from "@/components/dashboard-client"
import { cookies } from "next/headers"

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
        {/* ... Tu código de header ... */}
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Decks</h1>
              <p className="text-muted-foreground">Manage your study flashcard decks</p>
            </div>
            <div className="flex items-center gap-2">
                <form action={async () => {
                    "use server"
                    cookies().set("editMode", String(!isEditMode))
                    redirect("/dashboard")
                }}>
                    <Button variant={isEditMode ? "default" : "outline"} type="submit">
                        <Edit className="mr-2 h-4 w-4" />
                        {isEditMode ? "Done" : "Edit"}
                    </Button>
                </form>
              {isEditMode && (
                <>
                    <CreateFolderDialog />
                    <CreateDeckDialog />
                </>
              )}
            </div>
          </div>

          {itemsWithCount.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">You don't have any items yet</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  Click 'Edit' to create your first folder or deck.
                </p>
              </CardContent>
            </Card>
          ) : (
            <DashboardClient initialItems={itemsWithCount} isEditMode={isEditMode} />
          )}
        </div>
      </main>
    </div>
  )
}