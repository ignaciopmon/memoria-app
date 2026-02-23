"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

interface ExportButtonProps {
  deckName: string;
  cards: Array<{ front: string; back: string }>;
}

export function ExportButton({ deckName, cards }: ExportButtonProps) {
  const handleExport = () => {
    if (!cards || cards.length === 0) {
      alert("No cards to export.");
      return;
    }

    // Cabeceras del CSV
    let csvContent = "Front,Back\n";

    // Procesar cada tarjeta para el CSV escapando comillas y saltos de línea
    cards.forEach(card => {
      const escapeCell = (text: string) => {
        if (!text) return '""';
        const escaped = text.replace(/"/g, '""');
        return `"${escaped}"`;
      };

      const front = escapeCell(card.front);
      const back = escapeCell(card.back);
      csvContent += `${front},${back}\n`;
    });

    // Crear un blob y forzar la descarga
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    // Nombre del archivo limpio
    const safeDeckName = deckName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute("download", `${safeDeckName}_export.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={!cards || cards.length === 0}>
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  )
}