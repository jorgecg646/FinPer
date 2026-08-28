"use client"

import { useEffect, useState } from "react"
import { Download, X, Smartphone, Sparkles } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PwaInstaller() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // 1. Register Service Worker for ultra-fast caching & PWA
    if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // SW registered successfully
        })
        .catch(() => {
          // SW registration ignored in dev
        })
    }

    // 2. Check if already installed / running in standalone mode
    if (typeof window !== "undefined") {
      const isRunningStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
      setIsStandalone(Boolean(isRunningStandalone))

      // Check for iOS
      const userAgent = window.navigator.userAgent.toLowerCase()
      const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
      setIsIos(isIosDevice)

      // 3. Listen for Android / Chrome / Edge install prompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault()
        setInstallPrompt(e as BeforeInstallPromptEvent)
        // Show banner only if user hasn't dismissed it in this session
        const dismissed = sessionStorage.getItem("pwa_banner_dismissed")
        if (!dismissed && !isRunningStandalone) {
          setShowBanner(true)
        }
      }

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      }
    }
  }, [])

  async function handleInstallClick() {
    if (!installPrompt) return

    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice

    if (outcome === "accepted") {
      setInstallPrompt(null)
      setShowBanner(false)
    }
  }

  function handleDismiss() {
    setShowBanner(false)
    sessionStorage.setItem("pwa_banner_dismissed", "true")
  }

  if (isStandalone || !showBanner) {
    return null
  }

  return (
    <aside
      aria-label="Instalar aplicación"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 p-4 rounded-3xl bg-card/95 backdrop-blur-xl border border-primary/40 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/20 text-primary shrink-0">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
              <span>Instalar BudgetNext</span>
              <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                App
              </span>
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Acceso instantáneo desde tu pantalla de inicio en 0 ms
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
          aria-label="Cerrar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isIos ? (
        <p className="text-xs text-muted-foreground bg-secondary/60 p-2.5 rounded-xl border border-border/40 leading-relaxed">
          Para instalar en iPhone: pulsa el botón <strong>Compartir</strong> <span className="text-sm">⎋</span> en Safari y luego <strong>«Añadir a la pantalla de inicio»</strong> <span className="text-sm">⊞</span>.
        </p>
      ) : (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground font-black text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>Instalar en el Móvil</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-2.5 rounded-2xl bg-secondary/80 text-foreground font-bold text-xs hover:bg-secondary transition-colors cursor-pointer"
          >
            Ahora no
          </button>
        </div>
      )}
    </aside>
  )
}
