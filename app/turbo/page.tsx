// app/turbo/page.tsx
import { TurboStudyFlow } from "@/components/turbo-study-flow";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TurboPage() {
  const supabase = await createClient(); // FIX: Added await here
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch decks to pass to the component (for saving cards)
  const { data: decks } = await supabase
    .from("decks")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="container mx-auto py-8 px-4 h-screen flex flex-col">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Turbo Study (Beta)</h1>
        <p className="text-muted-foreground">Chat with your documents and generate instant review materials.</p>
      </div>
      
      {/* Pass decks as prop */}
      <TurboStudyFlow userDecks={decks || []} />
    </div>
  );
}