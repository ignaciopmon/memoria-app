// app/page.tsx

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, Zap, GraduationCap } from "lucide-react";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/20">
      {/* Navbar simple */}
      <header className="px-6 h-16 flex items-center justify-between border-b bg-background/50 backdrop-blur fixed w-full z-50">
         <div className="flex items-center gap-2 font-bold text-xl">
            <Brain className="h-6 w-6 text-primary" />
            <span>Memoria</span>
         </div>
         <div className="flex gap-4">
            <Button variant="ghost" asChild>
                <Link href="/auth/login">Log in</Link>
            </Button>
            <Button asChild>
                <Link href="/auth/signup">Sign up free</Link>
            </Button>
         </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col pt-32 pb-12 px-6 items-center text-center gap-8 relative overflow-hidden">
        
        {/* Decorative background blobs */}
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl -z-10 animate-pulse" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10" />

        <div className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium bg-muted/50 backdrop-blur">
            <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />
            <span>Powered by Gemini 2.5 Flash AI</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl text-balance bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent pb-2">
          Master any subject with <br className="hidden md:block"/> Spaced Repetition.
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl text-balance leading-relaxed">
          Create flashcards instantly from PDFs or topics using AI. Study smarter, not harder, with an algorithm designed to make you remember forever.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm pt-4">
          <Button asChild size="lg" className="text-lg h-12 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
            <Link href="/auth/signup">Get Started for Free</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-lg h-12 bg-background/50 backdrop-blur">
            <Link href="/auth/login">I have an account</Link>
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-5xl text-left">
            <div className="p-6 rounded-2xl border bg-card/50 backdrop-blur hover:bg-card/80 transition-colors">
                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Zap className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">Instant AI Decks</h3>
                <p className="text-muted-foreground">Upload a PDF or type a topic. Our AI generates comprehensive flashcards in seconds.</p>
            </div>
             <div className="p-6 rounded-2xl border bg-card/50 backdrop-blur hover:bg-card/80 transition-colors">
                <div className="h-10 w-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                    <Brain className="h-5 w-5 text-blue-500" />
                </div>
                <h3 className="font-bold text-lg mb-2">Smart Algorithm</h3>
                <p className="text-muted-foreground">We handle the scheduling. You just review. The most efficient way to convert short-term memory into long-term.</p>
            </div>
             <div className="p-6 rounded-2xl border bg-card/50 backdrop-blur hover:bg-card/80 transition-colors">
                <div className="h-10 w-10 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
                    <GraduationCap className="h-5 w-5 text-green-500" />
                </div>
                <h3 className="font-bold text-lg mb-2">AI Exams</h3>
                <p className="text-muted-foreground">Test your knowledge with AI-generated multiple choice exams based on your decks.</p>
            </div>
        </div>
      </main>

      <footer className="py-8 text-center text-sm text-muted-foreground border-t">
        <p>&copy; {new Date().getFullYear()} Memoria App. Built for students.</p>
      </footer>
    </div>
  );
}