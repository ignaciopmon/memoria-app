/** @type {import('next').NextConfig} */
const nextConfig = {
  // Se han eliminado los "ignore" de eslint y typescript para garantizar 
  // que a producción solo suba código seguro y sin errores.
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
}

export default nextConfig;