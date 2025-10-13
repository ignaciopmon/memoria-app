import { Button } from "@/components/ui/button"
import { Brain } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Brain className="h-16 w-16" />
          <h1 className="text-5xl font-bold tracking-tight md:text-6xl">Memoria</h1>
        </div>
        <div className="flex gap-4">
          <Button asChild size="lg" variant="outline">
            <Link href="/auth/login">Log In</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/auth/signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}