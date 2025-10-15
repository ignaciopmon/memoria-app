import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Brain, ArrowLeft, HelpCircle, Palette, Timer, Keyboard } from "lucide-react"
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

  // Fetch user's interval settings
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
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            <span className="text-xl font-bold">Memoria</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Customize your study experience.</p>
          </div>

          <Tabs defaultValue="appearance" className="w-full">
            {/* Pestañas para Escritorio (como antes) */}
            <TabsList className="hidden w-full grid-cols-3 md:grid">
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="intervals">Intervals</TabsTrigger>
              <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
            </TabsList>

            {/* Pestañas para Móvil (verticales) */}
            <TabsList className="grid w-full grid-cols-1 md:hidden">
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="intervals">Intervals</TabsTrigger>
              <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
            </TabsList>
            
            {/* El contenido de las pestañas no cambia */}
            <TabsContent value="appearance">
              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>
                    Customize the look and feel of the application.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <h3 className="font-medium">Theme</h3>
                      <p className="text-sm text-muted-foreground">Select your preferred color theme.</p>
                    </div>
                    <ThemeToggle />
                  </div>
                   <p className="text-xs text-muted-foreground">
                    If the theme doesn't apply correctly, try reloading the page.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="intervals">
              <SettingsForm settings={settings} />
            </TabsContent>
            
            <TabsContent value="shortcuts">
              <ShortcutsForm shortcuts={shortcuts as Shortcuts | null} />
            </TabsContent>
          </Tabs>

          <div className="mt-8 flex justify-center">
            <Button variant="link" asChild className="text-muted-foreground">
              <Link href="/help">
                <HelpCircle className="mr-2 h-4 w-4" />
                How does it work?
              </Link>
            </Button>
          </div>

        </div>
      </main>
    </div>
  )
}