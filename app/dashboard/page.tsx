// app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Brain } from "lucide-react"
import { DashboardClient } from "@/components/dashboard-client"

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
          <DashboardClient initialItems={itemsWithCount} />
        </div>
      </main>
    </div>
  )
}