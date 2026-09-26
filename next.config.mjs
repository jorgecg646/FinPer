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
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
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
    // ─── Static asset caching ────────────────────────────────────────────────
    {
      source: "/:all*(svg|jpg|png|webp|ico|woff2)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    // ─── Security headers for all routes ────────────────────────────────────
    {
      source: "/:path*",
      headers: [
        // Prevent MIME-type sniffing
        { key: "X-Content-Type-Options", value: "nosniff" },
        // Prevent clickjacking
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        // Reduce referrer info leakage
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Restrict browser feature access
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=()",
        },
        // Force HTTPS for 1 year (only effective in production)
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
        // Content Security Policy
        // Allows: self, Google Fonts, Netlify Identity, TradingView, Vercel Analytics, flagcdn
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://identity.netlify.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://s3.tradingview.com https://s.tradingview.com https://*.tradingview.com https://www.tradingview-widget.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.tradingview.com",
            "font-src 'self' https://fonts.gstatic.com https://*.tradingview.com",
            "img-src 'self' data: blob: https://s3-symbol-logo.tradingview.com https://*.tradingview.com https://flagcdn.com https://www.google.com https://lh3.googleusercontent.com",
            "connect-src 'self' https://budgetnext.netlify.app https://scanner.tradingview.com https://symbol-search.tradingview.com https://news.google.com https://search.cnbc.com https://api.coingecko.com wss: https:",
            "frame-src 'self' https://s.tradingview.com https://*.tradingview.com https://www.tradingview-widget.com https://www.tradingview.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      ],
    },
  ],
}

export default nextConfig
