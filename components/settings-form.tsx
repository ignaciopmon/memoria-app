"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"

interface Settings {
  id?: string
  again_interval_minutes: number
  hard_interval_days: number
  good_interval_days: number
  easy_interval_days: number
}

interface SettingsFormProps {
  settings: Settings | null
}

export function SettingsForm({ settings: initialSettings }: SettingsFormProps) {
  const [settings, setSettings] = useState<Settings>({
    again_interval_minutes: initialSettings?.again_interval_minutes ?? 1,
    hard_interval_days: initialSettings?.hard_interval_days ?? 1,
    good_interval_days: initialSettings?.good_interval_days ?? 3,
    easy_interval_days: initialSettings?.easy_interval_days ?? 7,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSettings((prev) => ({ ...prev, [name]: Number(value) }))
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
        <CardTitle>Review Intervals</CardTitle>
        <CardDescription>
          Set the time until a card is shown again after you rate it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
      <CardFooter className="flex justify-between">
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <Button onClick={handleSave} disabled={isLoading} className="ml-auto">
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </CardFooter>
    </Card>
  )
}