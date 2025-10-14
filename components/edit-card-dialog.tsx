"use client"

import type React from "react"
import { useState, useRef } from "react"
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
import { Edit, Image as ImageIcon, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"

interface EditCardDialogProps {
  card: {
    id: string
    front: string
    back: string
    front_image_url: string | null
    back_image_url: string | null
  }
}

export function EditCardDialog({ card }: EditCardDialogProps) {
  const [open, setOpen] = useState(false)
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [frontImage, setFrontImage] = useState<File | null>(null)
  const [backImage, setBackImage] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(card.front_image_url)
  const [backPreview, setBackPreview] = useState<string | null>(card.back_image_url)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'back') => {
    const file = e.target.files?.[0]
    if (!file) return;
    const reader = new FileReader()
    reader.onloadend = () => {
      if (type === 'front') {
        setFrontImage(file)
        setFrontPreview(reader.result as string)
      } else {
        setBackImage(file)
        setBackPreview(reader.result as string)
      }
    }
    reader.readAsDataURL(file)
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    const supabase = createClient()
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${fileName}`
    const { data, error } = await supabase.storage.from('card-images').upload(filePath, file)
    if (error) throw new Error(`Image upload failed: ${error.message}`)
    const { data: { publicUrl } } = supabase.storage.from('card-images').getPublicUrl(data.path)
    return publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      let frontImageUrl = card.front_image_url
      if (frontImage) { // New image to upload
        frontImageUrl = await uploadImage(frontImage)
      } else if (!frontPreview) { // Image was removed
        frontImageUrl = null
      }

      let backImageUrl = card.back_image_url
      if (backImage) {
        backImageUrl = await uploadImage(backImage)
      } else if (!backPreview) {
        backImageUrl = null
      }

      const supabase = createClient()
      const { error } = await supabase
        .from("cards")
        .update({
          front,
          back,
          front_image_url: frontImageUrl,
          back_image_url: backImageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", card.id)

      if (error) throw error

      setOpen(false)
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error updating the card")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit card</DialogTitle>
            <DialogDescription>Modify the content of this card.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="front">Front (Question) *</Label>
              <Textarea id="front" value={front} onChange={(e) => setFront(e.target.value)} required rows={3} />
              {frontPreview && (
                 <div className="relative mt-2 h-24 w-24">
                  <Image src={frontPreview} alt="Front preview" fill style={{ objectFit: 'cover' }} className="rounded-md" />
                  <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => { setFrontImage(null); setFrontPreview(null); if (frontInputRef.current) frontInputRef.current.value = ""; }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
               <Button type="button" variant="outline" size="sm" className="mt-2 w-fit" onClick={() => frontInputRef.current?.click()}>
                <ImageIcon className="mr-2 h-4 w-4" /> {frontPreview ? "Change" : "Add"} Image
              </Button>
              <input type="file" ref={frontInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'front')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="back">Back (Answer) *</Label>
              <Textarea id="back" value={back} onChange={(e) => setBack(e.target.value)} required rows={4} />
              {backPreview && (
                <div className="relative mt-2 h-24 w-24">
                  <Image src={backPreview} alt="Back preview" fill style={{ objectFit: 'cover' }} className="rounded-md" />
                  <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => { setBackImage(null); setBackPreview(null); if (backInputRef.current) backInputRef.current.value = ""; }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Button type="button" variant="outline" size="sm" className="mt-2 w-fit" onClick={() => backInputRef.current?.click()}>
                <ImageIcon className="mr-2 h-4 w-4" /> {backPreview ? "Change" : "Add"} Image
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
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}