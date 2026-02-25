import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Brain, ArrowLeft, HelpCircle, Settings as SettingsIcon, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { SettingsForm } from "@/components/settings-form"
import { ShortcutsForm, type Shortcuts } from "@/components/shortcuts-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch user's settings (intervals and AI toggle)
  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single()
    
  // Fetch user's shortcuts settings
  const { data: shortcuts } = await supabase
    .from("user_shortcuts")
    .select("rate_again, rate_hard, rate_good, rate_easy")
    .eq("user_id", user.id)
    .single()

  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/10">
      {/* Navbar Minimalista */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-8">
         <Link href="/dashboard" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Brain className="h-5 w-5" />
            </div>
           <span className="text-lg font-bold tracking-tight">Memoria</span>
         </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-medium text-muted-foreground sm:inline-block">{user.email}</span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Cabecera de la página */}
        <div className="border-b bg-muted/30 pt-12 pb-8">
          <div className="container mx-auto max-w-5xl px-4 sm:px-8">
            <Button variant="ghost" asChild className="mb-6 -ml-3 text-muted-foreground hover:bg-background">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <div className="flex items-center gap-3 mb-2">
              <SettingsIcon className="h-8 w-8 text-foreground" strokeWidth={1.5} />
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
            </div>
            <p className="text-base text-muted-foreground max-w-2xl">
              Manage your account preferences, configure spaced repetition intervals, and customize your study experience.
            </p>
          </div>
        </div>

        {/* Contenido principal con Sidebar de Pestañas */}
        <div className="container mx-auto max-w-5xl px-4 sm:px-8 py-10">
          <Tabs defaultValue="study" className="flex flex-col md:flex-row gap-8 lg:gap-12 w-full items-start">
            
            {/* Menú Lateral */}
            <TabsList className="flex flex-row md:flex-col justify-start h-auto w-full md:w-56 bg-transparent p-0 space-y-0 md:space-y-1 space-x-2 md:space-x-0 overflow-x-auto md:overflow-visible border-b md:border-b-0 pb-2 md:pb-0">
              <TabsTrigger 
                value="study" 
                className="w-full justify-start px-3 py-2 text-sm font-medium transition-all data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground data-[state=active]:shadow-none hover:bg-muted/50 rounded-md"
              >
                Study & AI
              </TabsTrigger>
              <TabsTrigger 
                value="shortcuts" 
                className="w-full justify-start px-3 py-2 text-sm font-medium transition-all data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground data-[state=active]:shadow-none hover:bg-muted/50 rounded-md"
              >
                Keyboard Shortcuts
              </TabsTrigger>
              <TabsTrigger 
                value="appearance" 
                className="w-full justify-start px-3 py-2 text-sm font-medium transition-all data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground data-[state=active]:shadow-none hover:bg-muted/50 rounded-md"
              >
                Appearance
              </TabsTrigger>
            </TabsList>

            {/* Contenedores de las opciones */}
            <div className="flex-1 w-full min-w-0">
              <TabsContent value="study" className="mt-0 outline-none animate-in fade-in-50 duration-500">
                <SettingsForm settings={settings} />
              </TabsContent>

              <TabsContent value="shortcuts" className="mt-0 outline-none animate-in fade-in-50 duration-500">
                <ShortcutsForm shortcuts={shortcuts as Shortcuts | null} />
              </TabsContent>
              
              <TabsContent value="appearance" className="mt-0 outline-none animate-in fade-in-50 duration-500">
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl">Appearance</CardTitle>
                    <CardDescription>Customize the look and feel of Memoria.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border bg-card p-4 shadow-sm">
                      <div className="mb-4 sm:mb-0 space-y-1">
                        <h3 className="font-medium text-foreground">Color Theme</h3>
                        <p className="text-sm text-muted-foreground">Select your preferred lighting environment.</p>
                      </div>
                      <ThemeToggle />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>

          <div className="mt-16 flex justify-center border-t pt-8">
            <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
              <Link href="/help">
                <HelpCircle className="mr-2 h-4 w-4" />
                How does Memoria work?
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}