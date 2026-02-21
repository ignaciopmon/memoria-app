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
  // Le decimos a Next.js 15 que estas librerías de servidor son externas
  serverExternalPackages: ['@cyber2024/pdf-parse-fixed', 'pdfjs-dist'],
  
  webpack: (config) => {
    // Evita que el parseador de PDF busque el módulo canvas y rompa Vercel
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    
    return config;
  },
}

export default nextConfig;