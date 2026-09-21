/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
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
      "html-to-image",
      "@visx/shape",
      "@visx/group",
      "@visx/curve",
      "@visx/gradient",
      "@visx/scale",
      "@visx/axis",
      "@visx/grid",
      "@visx/tooltip",
      "@visx/responsive",
      "@visx/legend",
      "@visx/event",
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
