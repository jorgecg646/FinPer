import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { DataMutationListener } from '@/components/finance/refresh-on-navigate'
import { PwaInstaller } from '@/components/finance/pwa-installer'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
})

export const metadata: Metadata = {
  title: 'BudgetNext — Finanzas Personales',
  description: 'Gestiona tus finanzas personales: presupuestos, suscripciones, ingresos, gastos y transacciones.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BudgetNext',
  },
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#16241d' },
    { media: '(prefers-color-scheme: dark)', color: '#16241d' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`bg-background ${jakarta.variable}`} suppressHydrationWarning>
      <head>
        {/* Preconnect to external image & API CDNs for instant loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://flagcdn.com" />
        <link rel="preconnect" href="https://s3-symbol-logo.tradingview.com" />
        <link rel="dns-prefetch" href="https://scanner.tradingview.com" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BudgetNext" />
      </head>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <DataMutationListener />
        {children}
        <PwaInstaller />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
