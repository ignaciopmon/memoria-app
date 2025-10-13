// components/theme-toggle.tsx
"use client"

import * as React from "react"
import { Moon, Sun, Paintbrush } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Evita problemas de hidratación en el servidor
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const renderIcon = () => {
    if (!mounted) {
      // Muestra un icono genérico mientras carga para evitar el "salto" visual
      return <Sun className="h-[1.2rem] w-[1.2rem]" />
    }
    switch (theme) {
      case "light":
        return <Sun className="h-[1.2rem] w-[1.2rem] transition-transform duration-300 transform rotate-0 scale-100" />
      case "dark":
        return <Moon className="h-[1.2rem] w-[1.2rem] transition-transform duration-300 transform rotate-0 scale-100" />
      case "pastel":
        return <Paintbrush className="h-[1.2rem] w-[1.2rem] transition-transform duration-300 transform rotate-0 scale-100" />
      default: // System u otro
        return <Sun className="h-[1.2rem] w-[1.2rem]" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          {renderIcon()}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("pastel")}>
          Pastel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}