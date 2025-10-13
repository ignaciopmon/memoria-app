// components/color-popover.tsx
"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Paintbrush } from "lucide-react"

const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"]

interface ColorPopoverProps {
  folderId: string
  currentColor: string | null
}

export function ColorPopover({ folderId, currentColor }: ColorPopoverProps) {
  const router = useRouter()

  const handleColorSelect = async (color: string | null) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("decks")
      .update({ color: color })
      .eq("id", folderId)

    if (error) {
      alert("Error updating color.")
    } else {
      router.refresh()
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Paintbrush className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <div className="flex gap-2">
          <Button
            variant={!currentColor ? "outline" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => handleColorSelect(null)}
          />
          {colors.map((color) => (
            <Button
              key={color}
              variant={currentColor === color ? "outline" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-full"
              style={{ backgroundColor: color }}
              onClick={() => handleColorSelect(color)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}