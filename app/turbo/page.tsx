// app/turbo/page.tsx
import { TurboStudyFlow } from "@/components/turbo-study-flow";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TurboPage() {
  const supabase = await createClient();
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
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Pass decks as prop */}
      <TurboStudyFlow userDecks={decks || []} />
    </div>
  );
}