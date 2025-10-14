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
          <DropdownMenuItem onSelect={() => setCsvOpen(true)}>
            From CSV file...
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setXlsxOpen(true)}>
            From XLSX file...
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTxtOpen(true)}>
            From TXT file...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Estos diálogos están ocultos hasta que su estado 'open' es true */}
      <ImportCSVDialog deckId={deckId} open={csvOpen} onOpenChange={setCsvOpen} />
      <ImportXLSXDialog deckId={deckId} open={xlsxOpen} onOpenChange={setXlsxOpen} />
      <ImportTxtDialog deckId={deckId} open={txtOpen} onOpenChange={setTxtOpen} />
    </>
  )
}