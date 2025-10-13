import { Button } from "@/components/ui/button"
import { Brain, Zap, TrendingUp, Clock } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
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
              <Link href="/auth/login">Iniciar sesión</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/signup">Registrarse</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <div className="mx-auto max-w-3xl space-y-6">
            <h1 className="text-balance text-5xl font-bold tracking-tight md:text-6xl">
              Aprende más rápido con repetición espaciada
            </h1>
            <p className="text-pretty text-xl text-muted-foreground">
              Memoria utiliza un algoritmo de repetición espaciada para ayudarte a memorizar información de manera
              eficiente y duradera.
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <Button asChild size="lg">
                <Link href="/auth/signup">Comenzar gratis</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/login">Iniciar sesión</Link>
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
                <h3 className="text-xl font-semibold">Aprendizaje eficiente</h3>
                <p className="text-muted-foreground">Estudia solo lo que necesitas repasar, cuando lo necesitas</p>
              </div>

              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Progreso medible</h3>
                <p className="text-muted-foreground">Visualiza tu avance y mantén la motivación alta</p>
              </div>

              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Ahorra tiempo</h3>
                <p className="text-muted-foreground">Memoriza más en menos tiempo con técnicas científicas</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 Memoria. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
