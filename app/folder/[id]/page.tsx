// app/folder/[id]/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Brain, ArrowLeft, FolderOpen, LayoutDashboard } from "lucide-react"
import { DashboardClient } from "@/components/dashboard-client"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Obtener Info de la carpeta actual
  const { data: folder } = await supabase.from("decks").select("*").eq("id", id).eq("is_folder", true).single()
  if (!folder) notFound()

  // Obtener elementos dentro de esta carpeta
  const { data: allItems } = await supabase
    .from("decks")
    .select(`
      id, name, description, color, position, created_at, is_folder, parent_id,
      cards!left(count)
    `)
    .eq("parent_id", id)
    .is("deleted_at", null)
    .order("position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  // Obtener TODAS las carpetas disponibles (Para el menú de Mover, excluyendo la actual para no crear bucles)
  const { data: availableFolders } = await supabase
    .from("decks")
    .select("id, name")
    .eq("is_folder", true)
    .is("deleted_at", null)
    .neq("id", id); 

  const itemsWithCount = allItems?.map((item) => ({
    ...item,
    cardCount: item.cards && item.cards.length > 0 ? item.cards[0].count : 0,
  })) || []

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center px-4 gap-4">
         <Link href="/dashboard" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Brain className="h-6 w-6 text-primary" />
           <span className="text-xl font-bold select-none hidden sm:block">Memoria</span>
         </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          
          <div className="mb-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard" className="flex items-center gap-1"><LayoutDashboard className="h-3.5 w-3.5"/> Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="flex items-center gap-1 font-semibold text-primary"><FolderOpen className="h-4 w-4"/> {folder.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <DashboardClient 
            initialItems={itemsWithCount} 
            availableFolders={availableFolders || []} 
            currentFolderId={folder.id} 
          />
        </div>
      </main>
    </div>
  )
}