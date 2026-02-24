/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'btadajavtmwrvzeuuenb.supabase.co',
        port: '',
        // Se hace más permisivo el acceso a todo el bucket para evitar imágenes rotas
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig;