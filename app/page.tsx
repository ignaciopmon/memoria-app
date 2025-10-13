// app/page.tsx

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";
import Link from "next/link";

export default async function HomePage() {
  // 1. Comprobamos si el usuario ya ha iniciado sesión en el servidor
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Si hay un usuario, lo redirigimos al dashboard inmediatamente
  if (user) {
    redirect("/dashboard");
  }

  // 3. Si NO hay usuario, mostramos tu página de inicio simple y original
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Logo y Nombre */}
        <div className="flex items-center gap-3">
          <Brain className="h-10 w-10" />
          <h1 className="text-4xl font-bold">Memoria</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Learn faster with spaced repetition.
        </p>
        
        {/* Botones de Acción */}
        <div className="flex w-full max-w-xs flex-col gap-4 pt-4">
          <Button asChild size="lg">
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/auth/signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}