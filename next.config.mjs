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
        hostname: 'btadajavtmwrvzeuuenb.supabase.co', // Tu Supabase
        port: '',
        pathname: '/storage/v1/object/public/card-images/**',
      },
    ],
  }
}

export default nextConfig