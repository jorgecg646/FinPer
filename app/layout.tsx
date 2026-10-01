import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import Script from 'next/script'
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
        url: '/BudgetNext.png',
        type: 'image/png',
      },
    ],
    apple: '/BudgetNext.png',
    shortcut: '/BudgetNext.png',
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
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
        />
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){
  try {
    if (typeof Element !== 'undefined' && Element.prototype && Element.prototype.setAttribute) {
      var origSetAttr = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name, value) {
        if (name && typeof name === 'string' && name.indexOf('bis_') === 0) return;
        return origSetAttr.apply(this, arguments);
      };
    }
  } catch(e) {}
  try {
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      var obs = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type === 'attributes' && m.attributeName && m.attributeName.indexOf('bis_') === 0) {
            m.target.removeAttribute(m.attributeName);
          }
        }
      });
      obs.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['bis_skin_checked', 'bis_register'] });
    }
  } catch(e) {}
  try {
    var t = localStorage.getItem("finflow-theme");
    if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme:dark)").matches)) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
  } catch(e) {}
})()`,
          }}
        />
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
