// components/folder-card.tsx
"use client"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Folder } from "lucide-react"
import Link from "next/link"

interface FolderCardProps {
  folder: {
    id: string
    name: string
    color: string | null
  }
  isEditMode?: boolean
}

export function FolderCard({ folder, isEditMode = false }: FolderCardProps) {
  const folderColor = folder.color || 'hsl(var(--primary))';

  const content = (
    <Card className={`group relative flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-primary/30 ${isEditMode ? 'opacity-75 cursor-move border-dashed' : 'hover:-translate-y-1 bg-gradient-to-b from-muted/30 to-background'}`}>
      <div className="absolute top-0 left-0 w-full h-1.5 opacity-80" style={{ backgroundColor: folderColor }} />
      
      <CardContent className="flex flex-col items-center justify-center flex-1 p-6 text-center gap-4 min-h-[180px]">
         <div className="p-4 rounded-2xl bg-background shadow-sm border transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md">
            <Folder className="h-10 w-10 transition-colors" style={{ color: folderColor !== 'hsl(var(--primary))' ? folderColor : 'hsl(var(--primary))' }} fill={folderColor !== 'hsl(var(--primary))' ? folderColor : 'hsl(var(--primary))'} fillOpacity={0.2} />
         </div>
         <div>
            <CardTitle className="line-clamp-2 text-xl font-bold tracking-tight">
              {folder.name}
            </CardTitle>
            <div className="flex items-center justify-center gap-1.5 mt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Open Folder</span>
            </div>
         </div>
      </CardContent>
    </Card>
  );

  if (isEditMode) return content;

  return (
    <Link href={`/folder/${folder.id}`} className="block h-full">
      {content}
    </Link>
  );
}