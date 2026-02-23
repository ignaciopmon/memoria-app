import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Brain, ArrowLeft, HelpCircle, Settings as SettingsIcon } from "lucide-react"
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
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
         <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Brain className="h-6 w-6 text-primary" />
           <span className="text-xl font-bold select-none">Memoria</span>
         </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">{user.email}</span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit" className="hover:bg-destructive/10 hover:text-destructive">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Cabecera de la página */}
        <div className="relative border-b bg-background pt-12 pb-10 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          <div className="container relative z-10 mx-auto max-w-5xl px-4">
            <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground hover:text-foreground">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <div className="flex items-center gap-4 mb-2">
              <div className="rounded-xl bg-primary/10 p-3 ring-1 ring-primary/20">
                <SettingsIcon className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight">Settings</h1>
            </div>
            <p className="text-lg text-muted-foreground mt-2 max-w-xl">
              Manage your account settings, study preferences, and customize your experience.
            </p>
          </div>
        </div>

        {/* Contenido principal con Sidebar de Pestañas */}
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <Tabs defaultValue="study" className="flex flex-col md:flex-row gap-8 w-full">
            
            {/* Sidebar Menú (TabsList) */}
            <TabsList className="flex flex-row md:flex-col justify-start h-auto w-full md:w-64 bg-transparent p-0 space-y-0 md:space-y-2 space-x-2 md:space-x-0 overflow-x-auto md:overflow-visible">
              <TabsTrigger 
                value="study" 
                className="w-full justify-start px-4 py-2.5 text-base data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted"
              >
                Study & AI
              </TabsTrigger>
              <TabsTrigger 
                value="shortcuts" 
                className="w-full justify-start px-4 py-2.5 text-base data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted"
              >
                Keyboard Shortcuts
              </TabsTrigger>
              <TabsTrigger 
                value="appearance" 
                className="w-full justify-start px-4 py-2.5 text-base data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted"
              >
                Appearance
              </TabsTrigger>
            </TabsList>

            {/* Contenedores de las opciones */}
            <div className="flex-1 w-full max-w-3xl">
              <TabsContent value="study" className="mt-0 animate-in fade-in slide-in-from-right-4 duration-500">
                <SettingsForm settings={settings} />
              </TabsContent>

              <TabsContent value="shortcuts" className="mt-0 animate-in fade-in slide-in-from-right-4 duration-500">
                <ShortcutsForm shortcuts={shortcuts as Shortcuts | null} />
              </TabsContent>
              
              <TabsContent value="appearance" className="mt-0 animate-in fade-in slide-in-from-right-4 duration-500">
                <Card className="shadow-md border-muted">
                  <CardHeader className="border-b bg-muted/10 pb-6">
                    <CardTitle>Appearance</CardTitle>
                    <CardDescription>Customize the look and feel of Memoria.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border p-5 bg-background shadow-sm">
                      <div className="mb-4 sm:mb-0">
                        <h3 className="font-semibold text-foreground">Color Theme</h3>
                        <p className="text-sm text-muted-foreground mt-1">Select your preferred color theme for the interface.</p>
                      </div>
                      <ThemeToggle />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>

          <div className="mt-12 flex justify-center border-t pt-8">
            <Button variant="outline" asChild className="text-muted-foreground hover:text-foreground rounded-full">
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