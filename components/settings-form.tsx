"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Sparkles, Clock, Save, Loader2 } from "lucide-react"

interface Settings {
  id?: string
  again_interval_minutes: number
  hard_interval_days: number
  good_interval_days: number
  easy_interval_days: number
  enable_ai_suggestions: boolean
}

interface SettingsFormProps {
  settings: Settings | null
}

// AQUÍ ESTÁ LA CLAVE: Tiene que decir "export function SettingsForm"
export function SettingsForm({ settings: initialSettings }: SettingsFormProps) {
  const [settings, setSettings] = useState({
    again_interval_minutes: initialSettings?.again_interval_minutes ?? 1,
    hard_interval_days: initialSettings?.hard_interval_days ?? 1,
    good_interval_days: initialSettings?.good_interval_days ?? 3,
    easy_interval_days: initialSettings?.easy_interval_days ?? 7,
    enable_ai_suggestions: initialSettings?.enable_ai_suggestions ?? true,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
  const router = useRouter()

  useEffect(() => {
    setSettings({
      again_interval_minutes: initialSettings?.again_interval_minutes ?? 1,
      hard_interval_days: initialSettings?.hard_interval_days ?? 1,
      good_interval_days: initialSettings?.good_interval_days ?? 3,
      easy_interval_days: initialSettings?.easy_interval_days ?? 7,
      enable_ai_suggestions: initialSettings?.enable_ai_suggestions ?? true,
    });
  }, [initialSettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const numValue = Math.max(1, Number(value));
    setSettings((prev) => ({ ...prev, [name]: numValue }))
  }

  const handleSave = async () => {
    setIsLoading(true)
    setMessage(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setMessage({ text: "You must be logged in to save settings.", type: "error" })
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.from("user_settings").upsert({
        user_id: user.id,
        ...settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      if (error) throw error

      setMessage({ text: "Settings saved successfully!", type: "success" })
      router.refresh()
    } catch (error) {
      setMessage({ text: "Error saving settings.", type: "error" })
      console.error(error)
    } finally {
      setIsLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-md border-purple-200 dark:border-purple-900/50 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-background dark:from-purple-950/20 dark:to-background border-b border-purple-100 dark:border-purple-900/50 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 dark:bg-purple-900/50 p-2.5 rounded-xl">
              <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-xl">AI-Powered Scheduling</CardTitle>
              <CardDescription className="mt-1">Allow AI to optimize your study schedule.</CardDescription>
            </div>
          </div>
          <Switch
              checked={settings.enable_ai_suggestions}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enable_ai_suggestions: checked }))}
              className="data-[state=checked]:bg-purple-600"
          />
        </div>
        <CardContent className="p-6 bg-muted/10 text-sm text-muted-foreground leading-relaxed">
          When enabled, the AI will analyze your performance in Practice Tests and automatically adjust the next review dates for the cards you struggled with, helping you focus on what matters most.
        </CardContent>
      </Card>

      <Card className="shadow-md border-muted">
        <CardHeader className="border-b bg-muted/10 pb-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle>Spaced Repetition Intervals</CardTitle>
          </div>
          <CardDescription>
            Set the base time added to a card's review date when you select a rating during a study session.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="grid gap-2 p-4 rounded-xl border bg-background shadow-sm hover:border-primary/50 transition-colors focus-within:border-primary">
              <Label htmlFor="again_interval_minutes" className="text-destructive font-semibold">"Again" Interval</Label>
              <div className="flex items-center gap-3">
                <Input id="again_interval_minutes" name="again_interval_minutes" type="number" value={settings.again_interval_minutes} onChange={handleInputChange} min="1" className="w-24 text-center font-mono" />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>

            <div className="grid gap-2 p-4 rounded-xl border bg-background shadow-sm hover:border-primary/50 transition-colors focus-within:border-primary">
              <Label htmlFor="hard_interval_days" className="text-orange-600 dark:text-orange-500 font-semibold">"Hard" Interval</Label>
              <div className="flex items-center gap-3">
                <Input id="hard_interval_days" name="hard_interval_days" type="number" value={settings.hard_interval_days} onChange={handleInputChange} min="1" className="w-24 text-center font-mono" />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>

            <div className="grid gap-2 p-4 rounded-xl border bg-background shadow-sm hover:border-primary/50 transition-colors focus-within:border-primary">
              <Label htmlFor="good_interval_days" className="text-blue-600 dark:text-blue-500 font-semibold">"Good" Interval</Label>
              <div className="flex items-center gap-3">
                <Input id="good_interval_days" name="good_interval_days" type="number" value={settings.good_interval_days} onChange={handleInputChange} min="1" className="w-24 text-center font-mono" />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>

            <div className="grid gap-2 p-4 rounded-xl border bg-background shadow-sm hover:border-primary/50 transition-colors focus-within:border-primary">
              <Label htmlFor="easy_interval_days" className="text-green-600 dark:text-green-500 font-semibold">"Easy" Interval</Label>
              <div className="flex items-center gap-3">
                <Input id="easy_interval_days" name="easy_interval_days" type="number" value={settings.easy_interval_days} onChange={handleInputChange} min="1" className="w-24 text-center font-mono" />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between border-t bg-muted/10 p-6">
          <div className="h-6">
            {message && (
              <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
                {message.text}
              </p>
            )}
          </div>
          <Button onClick={handleSave} disabled={isLoading} className="shadow-md">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}