// app/manifest.ts
import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Memoria App',
    short_name: 'Memoria',
    description: 'Learn faster with spaced repetition',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon.svg', // Usa el logo que ya tienes
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}