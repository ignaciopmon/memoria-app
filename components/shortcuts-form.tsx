"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { Keyboard, Save, Loader2, Monitor, Brain, CheckCircle2, AlertCircle } from "lucide-react"

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
  <div className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <kbd className="pointer-events-none inline-flex h-7 min-w-[1.75rem] select-none items-center justify-center rounded border bg-muted px-2 font-mono text-[11px] font-medium text-muted-foreground shadow-sm">
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
    // Guardamos solo el último carácter introducido y lo ponemos en minúscula
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

      setMessage({ text: "Shortcuts saved successfully", type: "success" })
      router.refresh()
    } catch (error) {
      setMessage({ text: "Error saving shortcuts", type: "error" })
      console.error(error)
    } finally {
      setIsLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-xl">Keyboard Shortcuts</CardTitle>
        </div>
        <CardDescription>
          Speed up your workflow and study sessions with custom keyboard bindings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        
        {/* Atajos Fijos */}
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-foreground mb-4">
                <Monitor className="h-4 w-4" />
                <h4 className="font-semibold text-sm">Global Shortcuts</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ShortcutDisplay label="Go to Dashboard" value="D" />
              <ShortcutDisplay label="Flip Card (Study)" value="SPACE" />
            </div>
        </div>

        {/* Atajos Personalizables */}
        <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-foreground mb-1">
                <Brain className="h-4 w-4" />
                <h4 className="font-semibold text-sm">Study Mode Ratings</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Click inside the input and press the desired key to assign it.</p>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="flex flex-col space-y-2 rounded-lg border bg-card p-4 shadow-sm transition-all focus-within:ring-1 focus-within:ring-primary">
                  <Label htmlFor="rate_again" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rate Again</Label>
                  <Input 
                    id="rate_again" name="rate_again" 
                    value={shortcuts.rate_again} onChange={handleInputChange} 
                    className="h-10 text-center font-mono text-base font-bold uppercase transition-shadow focus-visible:ring-0 bg-muted/50"
                  />
                </div>

                <div className="flex flex-col space-y-2 rounded-lg border bg-card p-4 shadow-sm transition-all focus-within:ring-1 focus-within:ring-primary">
                  <Label htmlFor="rate_hard" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rate Hard</Label>
                  <Input 
                    id="rate_hard" name="rate_hard" 
                    value={shortcuts.rate_hard} onChange={handleInputChange} 
                    className="h-10 text-center font-mono text-base font-bold uppercase transition-shadow focus-visible:ring-0 bg-muted/50"
                  />
                </div>

                <div className="flex flex-col space-y-2 rounded-lg border bg-card p-4 shadow-sm transition-all focus-within:ring-1 focus-within:ring-primary">
                  <Label htmlFor="rate_good" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rate Good</Label>
                  <Input 
                    id="rate_good" name="rate_good" 
                    value={shortcuts.rate_good} onChange={handleInputChange} 
                    className="h-10 text-center font-mono text-base font-bold uppercase transition-shadow focus-visible:ring-0 bg-muted/50"
                  />
                </div>

                <div className="flex flex-col space-y-2 rounded-lg border bg-card p-4 shadow-sm transition-all focus-within:ring-1 focus-within:ring-primary">
                  <Label htmlFor="rate_easy" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rate Easy</Label>
                  <Input 
                    id="rate_easy" name="rate_easy" 
                    value={shortcuts.rate_easy} onChange={handleInputChange} 
                    className="h-10 text-center font-mono text-base font-bold uppercase transition-shadow focus-visible:ring-0 bg-muted/50"
                  />
                </div>

            </div>
        </div>
      </CardContent>
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
          {isLoading ? "Saving..." : "Save Shortcuts"}
        </Button>
      </CardFooter>
    </Card>
  )
}