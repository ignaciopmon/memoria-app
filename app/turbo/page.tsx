// app/turbo/page.tsx
import { TurboStudyFlow } from "@/components/turbo-study-flow";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TurboPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Obtenemos los mazos para pasárselos al componente (para guardar las tarjetas)
  const { data: decks } = await supabase
    .from("decks")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="container mx-auto py-8 px-4 h-screen flex flex-col">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Turbo Study (Beta)</h1>
        <p className="text-muted-foreground">Chatea con tus documentos y genera material de repaso instantáneo.</p>
      </div>
      
      {/* Pasamos los mazos como prop */}
      <TurboStudyFlow userDecks={decks || []} />
    </div>
  );
}