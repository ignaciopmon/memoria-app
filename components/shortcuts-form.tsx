// components/shortcuts-form.tsx
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"

export type Shortcuts = {
  id?: string
  flip_card: string
  rate_again: string
  rate_hard: string
  rate_good: string
  rate_easy: string
  to_dashboard: string
}

interface ShortcutsFormProps {
  shortcuts: Shortcuts | null
}

export function ShortcutsForm({ shortcuts: initialShortcuts }: ShortcutsFormProps) {
  const defaultShortcuts: Shortcuts = {
    flip_card: ' ',
    rate_again: '1',
    rate_hard: '2',
    rate_good: '3',
    rate_easy: '4',
    to_dashboard: 'd',
  }

  const [shortcuts, setShortcuts] = useState<Shortcuts>(initialShortcuts || defaultShortcuts)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    // Permitimos solo el primer carácter, y para el espacio, guardamos ' '
    const key = value.length > 1 ? value.slice(-1) : value
    setShortcuts((prev) => ({ ...prev, [name]: key }))
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
      const { error } = await supabase.from("user_shortcuts").upsert({
        user_id: user.id,
        ...shortcuts,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      if (error) throw error

      setMessage("Shortcuts saved successfully!")
      router.refresh()
    } catch (error) {
      setMessage("Error saving shortcuts.")
      console.error(error)
    } finally {
      setIsLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const displayValue = (key: string) => key === ' ' ? 'Space' : key.toUpperCase()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyboard Shortcuts</CardTitle>
        <CardDescription>
          Customize your shortcuts for a faster study experience.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="flip_card">Flip Card</Label>
          <Input id="flip_card" name="flip_card" value={displayValue(shortcuts.flip_card)} onChange={handleInputChange} maxLength={1} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="to_dashboard">Go to Dashboard</Label>
          <Input id="to_dashboard" name="to_dashboard" value={displayValue(shortcuts.to_dashboard)} onChange={handleInputChange} maxLength={1} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rate_again">Rate "Again"</Label>
          <Input id="rate_again" name="rate_again" value={displayValue(shortcuts.rate_again)} onChange={handleInputChange} maxLength={1} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rate_hard">Rate "Hard"</Label>
          <Input id="rate_hard" name="rate_hard" value={displayValue(shortcuts.rate_hard)} onChange={handleInputChange} maxLength={1} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rate_good">Rate "Good"</Label>
          <Input id="rate_good" name="rate_good" value={displayValue(shortcuts.rate_good)} onChange={handleInputChange} maxLength={1} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rate_easy">Rate "Easy"</Label>
          <Input id="rate_easy" name="rate_easy" value={displayValue(shortcuts.rate_easy)} onChange={handleInputChange} maxLength={1} />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <Button onClick={handleSave} disabled={isLoading} className="ml-auto">
          {isLoading ? "Saving..." : "Save Shortcuts"}
        </Button>
      </CardFooter>
    </Card>
  )
}