/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'btadajavtmwrvzeuuenb.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/card-images/**',
      },
    ],
  },
  // Le decimos a Next.js que estas librerías de servidor no deben empaquetarse
  serverExternalPackages: ['@cyber2024/pdf-parse-fixed', 'pdfjs-dist'],
  
  webpack: (config) => {
    // Esto es CLAVE para Vercel: Evita que el parseador de PDF intente
    // buscar el módulo 'canvas' (que no existe en Vercel) y rompa el build.
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    
    return config;
  },
}

export default nextConfig;