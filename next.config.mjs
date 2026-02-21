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
  // Next.js 15: Evita que Webpack intente procesar la librería de PDF
  serverExternalPackages: ['@cyber2024/pdf-parse-fixed'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Fallbacks necesarios para que las librerías de servidor no rompan el cliente
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
        constants: false,
        zlib: false,
      }
    }
    return config
  },
}

export default nextConfig;