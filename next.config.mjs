/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {},
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "clsx",
      "tailwind-merge",
      "jspdf",
      "xlsx",
    ],
    serverActions: {
      bodySizeLimit: "20mb", // Allow large bank PDF uploads
    },
  },
  headers: async () => [
    {
      source: "/:all*(svg|jpg|png|webp|ico|woff2)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
  ],
}

export default nextConfig
