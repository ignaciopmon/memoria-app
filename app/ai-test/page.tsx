import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AITestFlow } from "@/components/ai-test-flow"; // Componente que crearemos ahora
import { Brain } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AITestPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Necesitamos los mazos para el paso final (guardar errores)
  const { data: decks } = await supabase
    .from("decks")
    .select("id, name")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
            <Brain className="h-6 w-6 text-primary" />
            <span>Memoria</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 max-w-3xl">
         <AITestFlow userDecks={decks || []} />
      </main>
    </div>
  );
}