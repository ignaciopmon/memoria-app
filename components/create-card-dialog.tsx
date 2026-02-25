"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Plus, X, Keyboard, Image as ImageIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface CreateCardDialogProps {
  deckId: string
}

export function CreateCardDialog({ deckId }: CreateCardDialogProps) {
  const [open, setOpen] = useState(false)
  const [front, setFront] = useState("")
  const [back, setBack] = useState("")
  const [frontImage, setFrontImage] = useState<File | null>(null)
  const [backImage, setBackImage] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [backPreview, setBackPreview] = useState<string | null>(null)
  const [isTypingEnabled, setIsTypingEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (frontPreview) URL.revokeObjectURL(frontPreview)
      if (backPreview) URL.revokeObjectURL(backPreview)
    }
  }, [frontPreview, backPreview])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'back') => {
    const file = e.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)

    if (type === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview)
      setFrontImage(file)
      setFrontPreview(previewUrl)
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview)
      setBackImage(file)
      setBackPreview(previewUrl)
    }
  }

  const uploadImage = async (file: File): Promise<string> => {
    const supabase = createClient()
    const fileExt = file.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${fileExt}`
    
    const { data, error } = await supabase.storage.from('card-images').upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })
    
    if (error) {
      throw new Error(`Fallo al subir imagen: ${error.message}`)
    }
    
    const { data: { publicUrl } } = supabase.storage.from('card-images').getPublicUrl(data.path)
    return publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      let frontImageUrl: string | null = null
      let backImageUrl: string | null = null

      if (frontImage) frontImageUrl = await uploadImage(frontImage)
      if (backImage) backImageUrl = await uploadImage(backImage)

      const supabase = createClient()
      const { error } = await supabase.from("cards").insert({
        deck_id: deckId,
        front,
        back,
        front_image_url: frontImageUrl,
        back_image_url: backImageUrl,
        is_typing_enabled: isTypingEnabled,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString(),
      })

      if (error) throw error

      setFront(""); setBack(""); setFrontImage(null); setBackImage(null);
      setFrontPreview(null); setBackPreview(null); setIsTypingEnabled(false);
      setOpen(false)
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error creando la tarjeta")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create new card</DialogTitle>
            <DialogDescription>Add a new study card to this deck.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            
            <div className="flex items-center space-x-2 rounded-lg border p-3 shadow-sm">
              <Switch 
                id="typing-mode" 
                checked={isTypingEnabled} 
                onCheckedChange={setIsTypingEnabled} 
              />
              <Label htmlFor="typing-mode" className="flex flex-col gap-1 cursor-pointer">
                <span className="flex items-center gap-2 font-medium">
                  <Keyboard className="h-4 w-4 text-muted-foreground" />
                  Require Typed Answer
                </span>
                <span className="text-xs text-muted-foreground">
                  Adds a text box during practice to let you type and compare your answer. Ideal for image labels.
                </span>
              </Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="front">Front (Question) *</Label>
              <Textarea id="front" placeholder="E.g., What is photosynthesis?" value={front} onChange={(e) => setFront(e.target.value)} required rows={3} />
              {frontPreview && (
                <div className="relative mt-2 h-24 w-24">
                  {/* Imagen estándar en lugar de next/image */}
                  <img src={frontPreview} alt="Front preview" className="w-full h-full object-cover rounded-md bg-muted/50 border" />
                  <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => { setFrontImage(null); setFrontPreview(null); if (frontInputRef.current) frontInputRef.current.value = ""; }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Button type="button" variant="outline" size="sm" className="mt-2 w-fit" onClick={() => frontInputRef.current?.click()}>
                <ImageIcon className="mr-2 h-4 w-4" /> Add Image
              </Button>
              <input type="file" ref={frontInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'front')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="back">Back (Answer) *</Label>
              <Textarea id="back" placeholder="E.g., The process by which plants convert sunlight into chemical energy." value={back} onChange={(e) => setBack(e.target.value)} required rows={4} />
              {backPreview && (
                 <div className="relative mt-2 h-24 w-24">
                  <img src={backPreview} alt="Back preview" className="w-full h-full object-cover rounded-md bg-muted/50 border" />
                  <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => { setBackImage(null); setBackPreview(null); if (backInputRef.current) backInputRef.current.value = ""; }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
               <Button type="button" variant="outline" size="sm" className="mt-2 w-fit" onClick={() => backInputRef.current?.click()}>
                <ImageIcon className="mr-2 h-4 w-4" /> Add Image
              </Button>
              <input type="file" ref={backInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'back')} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !front.trim() || !back.trim()}>
              {isLoading ? "Creating..." : "Create Card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}