"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FileUp } from "lucide-react"
import { ImportCSVDialog } from "./import-csv-dialog"
import { ImportXLSXDialog } from "./import-xlsx-dialog"
import { ImportTxtDialog } from "./import-txt-dialog"

interface ImportMenuProps {
  deckId: string
}

export function ImportMenu({ deckId }: ImportMenuProps) {
  const [csvOpen, setCsvOpen] = useState(false)
  const [xlsxOpen, setXlsxOpen] = useState(false)
  const [txtOpen, setTxtOpen] = useState(false)

  // Esta función previene el comportamiento por defecto del menú y usa un pequeño retraso
  // para evitar que el diálogo y el menú "choquen", lo que causaba el bug de bloqueo.
  const handleSelect = (setter: (isOpen: boolean) => void) => (e: Event) => {
    e.preventDefault()
    setTimeout(() => setter(true), 0)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <FileUp className="mr-2 h-4 w-4" />
            Import
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={handleSelect(setCsvOpen)}>
            From CSV file...
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleSelect(setXlsxOpen)}>
            From XLSX file...
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleSelect(setTxtOpen)}>
            From TXT file...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ImportCSVDialog deckId={deckId} open={csvOpen} onOpenChange={setCsvOpen} />
      <ImportXLSXDialog deckId={deckId} open={xlsxOpen} onOpenChange={setXlsxOpen} />
      <ImportTxtDialog deckId={deckId} open={txtOpen} onOpenChange={setTxtOpen} />
    </>
  )
}