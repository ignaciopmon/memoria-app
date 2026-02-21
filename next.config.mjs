/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
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
  // Añadimos pdfjs-dist por si acaso
  serverExternalPackages: ['@cyber2024/pdf-parse-fixed', 'pdfjs-dist'],
  
  // SOLUCIÓN: Le decimos a Webpack que ignore el módulo "canvas"
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    // Opcional: ignorar otros módulos nativos que a veces dan problemas con PDFs
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      canvas: false,
      encoding: false
    };
    return config;
  },
}

export default nextConfig;