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
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Le decimos a Webpack que ignore estos módulos de Node.js
      // cuando esté construyendo la versión para el navegador (cliente).
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        net: false,      // Necesario para Azure Speech
        tls: false,      // Necesario para Azure Speech
        child_process: false,
        dgram: false,
        os: false,
        https: false,
        http: false,
        vm: false,
        stream: false,
        constants: false,
      }
    }
    return config
  },
}

export default nextConfig