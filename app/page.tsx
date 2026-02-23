// app/page.tsx

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, ArrowRight } from "lucide-react";
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

  // 3. UI Mejorada de la Landing Page
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      {/* Fondo decorativo (Cuadrícula y Gradiente estilo Vercel) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl xl:-top-6">
        <div className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-primary to-purple-500 opacity-20" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 text-center px-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        
        {/* Badge superior */}
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm">
          <Sparkles className="mr-2 h-4 w-4" />
          <span>Learn smarter with AI</span>
        </div>

        {/* Logo y Nombre */}
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-2xl bg-background p-4 shadow-lg ring-1 ring-border">
            <Brain className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Memoria
          </h1>
        </div>

        <p className="max-w-[500px] text-lg text-muted-foreground sm:text-xl">
          Master any topic faster using our smart spaced repetition algorithm. Study less, remember more.
        </p>
        
        {/* Botones de Acción */}
        <div className="flex w-full max-w-sm flex-col gap-4 sm:flex-row pt-4">
          <Button asChild size="lg" className="w-full sm:w-auto h-12 text-base px-8 shadow-lg hover:shadow-primary/25 transition-all">
            <Link href="/auth/signup">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto h-12 text-base px-8 bg-background/50 backdrop-blur-md">
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}