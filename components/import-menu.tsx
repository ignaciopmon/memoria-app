"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
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

  // Esta función es la clave de la solución.
  // Evita el conflicto entre el menú y el diálogo.
  const handleSelect = (setter: (isOpen: boolean) => void) => {
    // Usamos un pequeño retraso para asegurar que el menú se cierre
    // antes de que el diálogo intente abrirse.
    setTimeout(() => {
      setter(true)
    }, 100) // 100 milisegundos es suficiente para que la animación del menú termine.
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
          {/* El 'onSelect' ahora llama a nuestra función segura */}
          <DropdownMenuItem onSelect={() => handleSelect(setCsvOpen)}>
            From CSV file...
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleSelect(setXlsxOpen)}>
            From XLSX file...
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleSelect(setTxtOpen)}>
            From TXT file...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Los diálogos no cambian, siguen esperando a que su estado 'open' sea true */}
      <ImportCSVDialog deckId={deckId} open={csvOpen} onOpenChange={setCsvOpen} />
      <ImportXLSXDialog deckId={deckId} open={xlsxOpen} onOpenChange={setXlsxOpen} />
      <ImportTxtDialog deckId={deckId} open={txtOpen} onOpenChange={setTxtOpen} />
    </>
  )
}