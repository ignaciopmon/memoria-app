"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

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

export function SettingsForm({ settings: initialSettings }: SettingsFormProps) {
  // El estado inicial se basa en las props, con valores por defecto
  const [settings, setSettings] = useState({
    again_interval_minutes: initialSettings?.again_interval_minutes ?? 1,
    hard_interval_days: initialSettings?.hard_interval_days ?? 1,
    good_interval_days: initialSettings?.good_interval_days ?? 3,
    easy_interval_days: initialSettings?.easy_interval_days ?? 7,
    enable_ai_suggestions: initialSettings?.enable_ai_suggestions ?? true,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  // ***** INICIO DE LA CORRECCIÓN *****
  // Sincroniza el estado si las props (initialSettings) cambian
  // (por ejemplo, después de un router.refresh())
  // APLICA LA MISMA LÓGICA DE VALOR POR DEFECTO que el useState
  useEffect(() => {
    setSettings({
      again_interval_minutes: initialSettings?.again_interval_minutes ?? 1,
      hard_interval_days: initialSettings?.hard_interval_days ?? 1,
      good_interval_days: initialSettings?.good_interval_days ?? 3,
      easy_interval_days: initialSettings?.easy_interval_days ?? 7,
      enable_ai_suggestions: initialSettings?.enable_ai_suggestions ?? true,
    });
  }, [initialSettings]);
  // ***** FIN DE LA CORRECCIÓN *****

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    // Asegura que el valor no sea negativo
    const numValue = Math.max(1, Number(value));
    setSettings((prev) => ({ ...prev, [name]: numValue }))
  }

  const handleSave = async () => {
    setIsLoading(true)
    setMessage(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setMessage("You must be logged in to save settings.")
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

      setMessage("Settings saved successfully!")
      router.refresh()
    } catch (error) {
      setMessage("Error saving settings.")
      console.error(error)
    } finally {
      setIsLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Study Settings</CardTitle>
        <CardDescription>
          Customize your learning experience, from review intervals to AI features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* SECCIÓN DE IA */}
        <div className="space-y-4">
            <h4 className="font-medium text-sm">Artificial Intelligence</h4>
             <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <h3 className="font-medium">AI-Powered Scheduling</h3>
                  <p className="text-sm text-muted-foreground">Allow AI to automatically reschedule cards based on your test results.</p>
                </div>
                <Switch
                    checked={settings.enable_ai_suggestions}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enable_ai_suggestions: checked }))}
                    aria-label="Toggle AI-powered scheduling"
                />
            </div>
        </div>

        <Separator />

        {/* SECCIÓN DE INTERVALOS */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Review Intervals</h4>
           <p className="text-sm text-muted-foreground">
              Set the time until a card is shown again after you rate it in Study Mode.
            </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 pt-2">
            <div className="grid gap-2">
              <Label htmlFor="again_interval_minutes">"Again" Interval (minutes)</Label>
              <Input
                id="again_interval_minutes"
                name="again_interval_minutes"
                type="number"
                value={settings.again_interval_minutes}
                onChange={handleInputChange}
                min="1"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hard_interval_days">"Hard" Interval (days)</Label>
              <Input
                id="hard_interval_days"
                name="hard_interval_days"
                type="number"
                value={settings.hard_interval_days}
                onChange={handleInputChange}
                min="1"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="good_interval_days">"Good" Interval (days)</Label>
              <Input
                id="good_interval_days"
                name="good_interval_days"
                type="number"
                value={settings.good_interval_days}
                onChange={handleInputChange}
                min="1"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="easy_interval_days">"Easy" Interval (days)</Label>
              <Input
                id="easy_interval_days"
                name="easy_interval_days"
                type="number"
                value={settings.easy_interval_days}
                onChange={handleInputChange}
                min="1"
              />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t px-6 pt-6">
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <Button onClick={handleSave} disabled={isLoading} className="ml-auto">
          {isLoading ? "Saving..." : "Save Settings"}
        </Button>
      </CardFooter>
    </Card>
  )
}