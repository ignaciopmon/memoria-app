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
  rate_again: string
  rate_hard: string
  rate_good: string
  rate_easy: string
}

interface ShortcutsFormProps {
  shortcuts: Omit<Shortcuts, 'id'> | null
}

const ShortcutDisplay = ({ label, value }: { label: string, value: string }) => (
  <div className="flex items-center justify-between rounded-lg border p-4">
      <p className="font-medium">{label}</p>
      <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-sm font-medium text-muted-foreground">
        {value.toUpperCase()}
      </kbd>
  </div>
);

export function ShortcutsForm({ shortcuts: initialShortcuts }: ShortcutsFormProps) {
  const defaultShortcuts: Omit<Shortcuts, 'id'> = {
    rate_again: '1',
    rate_hard: '2',
    rate_good: '3',
    rate_easy: '4',
  }
  
  const [shortcuts, setShortcuts] = useState(initialShortcuts || defaultShortcuts)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const key = value.slice(-1) 
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyboard Shortcuts</CardTitle>
        <CardDescription>
          Customize your shortcuts for a faster study experience.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Atajos Fijos */}
        <div className="space-y-4">
            <h4 className="font-medium px-1">Global Shortcuts</h4>
            <div className="space-y-2">
              <ShortcutDisplay label="Go to Dashboard" value="D" />
              <ShortcutDisplay label="Flip Card (in Study/Practice)" value="SPACE" />
            </div>
        </div>

        {/* Atajos Personalizables */}
        <div className="space-y-4">
            <h4 className="font-medium px-1">Study Mode Shortcuts</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="rate_again">Rate "Again"</Label>
                  <Input id="rate_again" name="rate_again" value={shortcuts.rate_again} onChange={handleInputChange} maxLength={1} className="font-mono text-center"/>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rate_hard">Rate "Hard"</Label>
                  <Input id="rate_hard" name="rate_hard" value={shortcuts.rate_hard} onChange={handleInputChange} maxLength={1} className="font-mono text-center"/>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rate_good">Rate "Good"</Label>
                  <Input id="rate_good" name="rate_good" value={shortcuts.rate_good} onChange={handleInputChange} maxLength={1} className="font-mono text-center"/>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rate_easy">Rate "Easy"</Label>
                  <Input id="rate_easy" name="rate_easy" value={shortcuts.rate_easy} onChange={handleInputChange} maxLength={1} className="font-mono text-center"/>
                </div>
            </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t px-6 pt-6">
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <Button onClick={handleSave} disabled={isLoading} className="ml-auto">
          {isLoading ? "Saving..." : "Save Shortcuts"}
        </Button>
      </CardFooter>
    </Card>
  )
}