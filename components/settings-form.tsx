"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { Keyboard, Save, Loader2, Monitor } from "lucide-react"

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
  <div className="flex items-center justify-between rounded-xl border bg-background p-4 shadow-sm">
      <p className="font-medium text-foreground">{label}</p>
      <kbd className="pointer-events-none inline-flex h-8 min-w-[2rem] select-none items-center justify-center rounded-md border border-b-4 bg-muted px-2 font-mono text-sm font-bold text-muted-foreground shadow-sm">
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
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    // Guardamos solo el último carácter introducido
    const key = value.slice(-1).toLowerCase() 
    setShortcuts((prev) => ({ ...prev, [name]: key }))
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
      const { error } = await supabase.from("user_shortcuts").upsert({
        user_id: user.id,
        ...shortcuts,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      if (error) throw error

      setMessage({ text: "Shortcuts saved successfully!", type: "success" })
      router.refresh()
    } catch (error) {
      setMessage({ text: "Error saving shortcuts.", type: "error" })
      console.error(error)
    } finally {
      setIsLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <Card className="shadow-md border-muted">
      <CardHeader className="border-b bg-muted/10 pb-6">
        <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            <CardTitle>Keyboard Shortcuts</CardTitle>
        </div>
        <CardDescription>
          Speed up your workflow and study sessions with custom keyboard bindings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-10 pt-8">
        
        {/* Atajos Fijos */}
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground border-b pb-2">
                <Monitor className="h-4 w-4" />
                <h4 className="font-semibold text-sm uppercase tracking-wider">Global App Shortcuts</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ShortcutDisplay label="Go to Dashboard" value="D" />
              <ShortcutDisplay label="Flip Card (Study)" value="SPACE" />
            </div>
        </div>

        {/* Atajos Personalizables */}
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground border-b pb-2">
                <Brain className="h-4 w-4" />
                <h4 className="font-semibold text-sm uppercase tracking-wider">Study Mode Ratings</h4>
            </div>
            <p className="text-sm text-muted-foreground">Click the input and press the key you want to assign.</p>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
                
                <div className="flex flex-col gap-2 p-4 rounded-xl border bg-background shadow-sm items-center text-center focus-within:ring-2 focus-within:ring-destructive/20 focus-within:border-destructive">
                  <Label htmlFor="rate_again" className="text-destructive font-semibold">Rate "Again"</Label>
                  <Input 
                    id="rate_again" name="rate_again" 
                    value={shortcuts.rate_again} onChange={handleInputChange} 
                    className="h-14 w-14 text-2xl font-bold uppercase text-center border-2 border-b-4 bg-muted shadow-sm rounded-lg mt-2 cursor-pointer focus-visible:ring-0"
                  />
                </div>

                <div className="flex flex-col gap-2 p-4 rounded-xl border bg-background shadow-sm items-center text-center focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500">
                  <Label htmlFor="rate_hard" className="text-orange-600 dark:text-orange-500 font-semibold">Rate "Hard"</Label>
                  <Input 
                    id="rate_hard" name="rate_hard" 
                    value={shortcuts.rate_hard} onChange={handleInputChange} 
                    className="h-14 w-14 text-2xl font-bold uppercase text-center border-2 border-b-4 bg-muted shadow-sm rounded-lg mt-2 cursor-pointer focus-visible:ring-0"
                  />
                </div>

                <div className="flex flex-col gap-2 p-4 rounded-xl border bg-background shadow-sm items-center text-center focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                  <Label htmlFor="rate_good" className="text-blue-600 dark:text-blue-500 font-semibold">Rate "Good"</Label>
                  <Input 
                    id="rate_good" name="rate_good" 
                    value={shortcuts.rate_good} onChange={handleInputChange} 
                    className="h-14 w-14 text-2xl font-bold uppercase text-center border-2 border-b-4 bg-muted shadow-sm rounded-lg mt-2 cursor-pointer focus-visible:ring-0"
                  />
                </div>

                <div className="flex flex-col gap-2 p-4 rounded-xl border bg-background shadow-sm items-center text-center focus-within:ring-2 focus-within:ring-green-500/20 focus-within:border-green-500">
                  <Label htmlFor="rate_easy" className="text-green-600 dark:text-green-500 font-semibold">Rate "Easy"</Label>
                  <Input 
                    id="rate_easy" name="rate_easy" 
                    value={shortcuts.rate_easy} onChange={handleInputChange} 
                    className="h-14 w-14 text-2xl font-bold uppercase text-center border-2 border-b-4 bg-muted shadow-sm rounded-lg mt-2 cursor-pointer focus-visible:ring-0"
                  />
                </div>

            </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t bg-muted/10 p-6 mt-4">
        <div className="h-6">
            {message && (
              <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
                {message.text}
              </p>
            )}
        </div>
        <Button onClick={handleSave} disabled={isLoading} className="shadow-md">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isLoading ? "Saving..." : "Save Shortcuts"}
        </Button>
      </CardFooter>
    </Card>
  )
}