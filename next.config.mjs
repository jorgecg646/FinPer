/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Turbopack (Next.js 16 default) — pdf-parse works without custom aliases
  turbopack: {},
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb", // Allow large bank PDF uploads
    },
  },
}

export default nextConfig
