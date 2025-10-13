// app/page.tsx

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Brain, Zap, TrendingUp, Clock } from "lucide-react";
import Link from "next/link";

export default async function HomePage() {
  // 1. Creamos un cliente de Supabase en el servidor
  const supabase = await createClient();

  // 2. Comprobamos si hay un usuario con sesión activa
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3. Si hay un usuario, lo redirigimos al dashboard
  if (user) {
    redirect("/dashboard");
  }

  // 4. Si NO hay usuario, mostramos la página de bienvenida normal
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            <span className="text-xl font-bold">Memoria</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <div className="mx-auto max-w-3xl space-y-6">
            <h1 className="text-balance text-5xl font-bold tracking-tight md:text-6xl">
              Learn faster with spaced repetition
            </h1>
            <p className="text-pretty text-xl text-muted-foreground">
              Memoria uses a spaced repetition algorithm to help you memorize information efficiently and for the long term.
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <Button asChild size="lg">
                <Link href="/auth/signup">Get Started for Free</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/50 py-24">
          <div className="container mx-auto px-4">
            <div className="grid gap-12 md:grid-cols-3">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Efficient Learning</h3>
                <p className="text-muted-foreground">Study only what you need to review, when you need to.</p>
              </div>

              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Measurable Progress</h3>
                <p className="text-muted-foreground">Visualize your progress and stay motivated.</p>
              </div>

              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Save Time</h3>
                <p className="text-muted-foreground">Memorize more in less time with scientific techniques.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 Memoria. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}