/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Remove the deprecated serverComponentsExternalPackages
    // Use serverExternalPackages instead
  },
  serverExternalPackages: [
    'mapbox-gl'
  ],
  webpack: (config, { isServer }) => {
    // Handle mapbox-gl for client-side builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }

    return config
  },
  images: {
    domains: ['placeholder.com'],
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
    GRAPHHOPPER_API_KEY: process.env.GRAPHHOPPER_API_KEY,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
