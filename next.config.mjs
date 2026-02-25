/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, // <-- Esto evita que Vercel rompa las imágenes de Supabase
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'btadajavtmwrvzeuuenb.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig;