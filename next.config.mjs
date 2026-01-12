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
      // Aquí le decimos a Webpack que ignore todos estos módulos de Node.js
      // cuando esté preparando la versión para el navegador.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        net: false,
        tls: false,
        child_process: false,
        dgram: false,
        os: false,
        https: false,
        http: false,
        vm: false,
        stream: false,
      }
    }
    return config
  },
}

export default nextConfig