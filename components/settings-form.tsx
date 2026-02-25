"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Sparkles, Clock, Save, Loader2, GraduationCap, AlertCircle, CheckCircle2 } from "lucide-react"

interface Settings {
  id?: string
  again_interval_minutes: number
  hard_interval_days: number
  good_interval_days: number
  easy_interval_days: number
  enable_ai_suggestions: boolean
  enable_max_interval: boolean
  max_interval_days: number
}

interface SettingsFormProps {
  settings: Settings | null
}

export function SettingsForm({ settings: initialSettings }: SettingsFormProps) {
  const [settings, setSettings] = useState({
    again_interval_minutes: initialSettings?.again_interval_minutes ?? 1,
    hard_interval_days: initialSettings?.hard_interval_days ?? 1,
    good_interval_days: initialSettings?.good_interval_days ?? 3,
    easy_interval_days: initialSettings?.easy_interval_days ?? 7,
    enable_ai_suggestions: initialSettings?.enable_ai_suggestions ?? true,
    enable_max_interval: initialSettings?.enable_max_interval ?? false,
    max_interval_days: initialSettings?.max_interval_days ?? 30,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (initialSettings) {
      setSettings({
        again_interval_minutes: initialSettings.again_interval_minutes ?? 1,
        hard_interval_days: initialSettings.hard_interval_days ?? 1,
        good_interval_days: initialSettings.good_interval_days ?? 3,
        easy_interval_days: initialSettings.easy_interval_days ?? 7,
        enable_ai_suggestions: initialSettings.enable_ai_suggestions ?? true,
        enable_max_interval: initialSettings.enable_max_interval ?? false,
        max_interval_days: initialSettings.max_interval_days ?? 30,
      });
    }
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

      setMessage({ text: "Settings saved successfully", type: "success" })
      router.refresh()
    } catch (error) {
      setMessage({ text: "Error saving settings", type: "error" })
      console.error(error)
    } finally {
      setIsLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <div className="space-y-8">
      {/* AI Settings */}
      <Card className="border-border shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 gap-4">
          <div className="flex items-start gap-4">
            <div className="mt-1 bg-primary/10 p-2 rounded-md">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">AI-Powered Scheduling</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Automatically adjust review dates for challenging cards based on your Practice Test performance.
              </p>
            </div>
          </div>
          <Switch
            checked={settings.enable_ai_suggestions}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enable_ai_suggestions: checked }))}
          />
        </div>
      </Card>

      {/* Spaced Repetition Settings */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-xl">Spaced Repetition Intervals</CardTitle>
          </div>
          <CardDescription>
            Configure the base time added to a card's review date when you select a rating.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 rounded-lg border bg-card p-4">
              <Label htmlFor="again_interval_minutes" className="text-sm font-medium">"Again" Interval</Label>
              <div className="flex items-center gap-2">
                <Input id="again_interval_minutes" name="again_interval_minutes" type="number" value={settings.again_interval_minutes} onChange={handleInputChange} min="1" className="w-24 font-mono bg-background" />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-card p-4">
              <Label htmlFor="hard_interval_days" className="text-sm font-medium">"Hard" Interval</Label>
              <div className="flex items-center gap-2">
                <Input id="hard_interval_days" name="hard_interval_days" type="number" value={settings.hard_interval_days} onChange={handleInputChange} min="1" className="w-24 font-mono bg-background" />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-card p-4">
              <Label htmlFor="good_interval_days" className="text-sm font-medium">"Good" Interval</Label>
              <div className="flex items-center gap-2">
                <Input id="good_interval_days" name="good_interval_days" type="number" value={settings.good_interval_days} onChange={handleInputChange} min="1" className="w-24 font-mono bg-background" />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-card p-4">
              <Label htmlFor="easy_interval_days" className="text-sm font-medium">"Easy" Interval</Label>
              <div className="flex items-center gap-2">
                <Input id="easy_interval_days" name="easy_interval_days" type="number" value={settings.easy_interval_days} onChange={handleInputChange} min="1" className="w-24 font-mono bg-background" />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
          </div>
        </CardContent>

        <div className="border-t bg-muted/20 p-6">
          <div className="flex flex-col space-y-4">
            <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded-md">
                  <GraduationCap className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <Label htmlFor="enable_max_interval" className="text-base font-semibold cursor-pointer">
                    Exam Mode
                  </Label>
                  <p className="text-sm text-muted-foreground mt-0.5 max-w-lg">
                    Set a hard limit cap for intervals. Ideal when studying for a specific upcoming exam.
                  </p>
                </div>
              </div>
              <Switch
                id="enable_max_interval"
                checked={settings.enable_max_interval}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enable_max_interval: checked }))}
              />
            </div>

            {settings.enable_max_interval && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-background p-4 rounded-lg border shadow-sm animate-in fade-in slide-in-from-top-2 mt-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <Label htmlFor="max_interval_days" className="font-medium whitespace-nowrap text-sm">Maximum interval cap:</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="max_interval_days" 
                    name="max_interval_days" 
                    type="number" 
                    value={settings.max_interval_days} 
                    onChange={handleInputChange} 
                    min="1" 
                    className="w-20 text-center font-mono bg-background h-9" 
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t bg-muted/10 p-6">
          <div className="w-full sm:w-auto flex-1 h-6 flex items-center">
            {message && (
              <div className={`flex items-center gap-2 text-sm font-medium ${message.type === 'success' ? 'text-green-600 dark:text-green-500' : 'text-destructive'}`}>
                {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {message.text}
              </div>
            )}
          </div>
          <Button onClick={handleSave} disabled={isLoading} className="w-full sm:w-auto px-8 transition-all">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isLoading ? "Saving..." : "Save Preferences"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}