"use client"

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react"

declare global {
  interface Window {
    turnstile?: {
      ready: (callback: () => void) => void
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback?: (token: string) => void
          "error-callback"?: (errorCode: string) => void
          "expired-callback"?: () => void
          theme?: "auto" | "light" | "dark"
          size?: "normal" | "compact" | "flexible"
        }
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

export type TurnstileRef = {
  reset: () => void
}

interface TurnstileProps {
  onSuccess: (token: string) => void
  onExpire?: () => void
  onError?: (err: string) => void
  className?: string
  theme?: "auto" | "light" | "dark"
  size?: "normal" | "compact" | "flexible"
}

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(function Turnstile(
  { onSuccess, onExpire, onError, className = "", theme = "auto", size = "normal" },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current)
        } catch {
          // ignore
        }
      }
    },
  }))

  useEffect(() => {
    if (!siteKey || typeof window === "undefined") return

    let isMounted = true

    const initWidget = () => {
      const turnstile = window.turnstile
      if (!isMounted || !turnstile || !containerRef.current) return

      const doRender = () => {
        const activeTurnstile = window.turnstile
        if (!isMounted || !containerRef.current || !activeTurnstile) return

        // Clean up previous widget instance if present
        if (widgetIdRef.current) {
          try {
            activeTurnstile.remove(widgetIdRef.current)
          } catch {}
          widgetIdRef.current = null
        }

        try {
          console.log("[turnstile] Renderizando widget en contenedor...")
          const id = activeTurnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              console.log("[turnstile] ✅ Token generado por Cloudflare")
              if (isMounted) onSuccessRef.current(token)
            },
            "expired-callback": () => {
              console.warn("[turnstile] ⚠️ Token caducado")
              if (isMounted) onExpireRef.current?.()
            },
            "error-callback": (err: string) => {
              console.error("[turnstile] ❌ Error de Cloudflare:", err)
              if (isMounted) onErrorRef.current?.(err)
            },
            theme,
            size,
          })
          widgetIdRef.current = id
        } catch (err: any) {
          console.error("[turnstile] Error durante turnstile.render:", err)
          if (isMounted) onErrorRef.current?.(err?.message || "Error al inicializar")
        }
      }

      if (typeof turnstile.render === "function") {
        doRender()
      } else if (typeof turnstile.ready === "function") {
        turnstile.ready(doRender)
      }
    }

    if (window.turnstile) {
      initWidget()
      return () => {
        isMounted = false
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current)
          } catch {}
          widgetIdRef.current = null
        }
      }
    }

    // If script is still loading in layout, wait for it
    const timer = setInterval(() => {
      if (window.turnstile) {
        clearInterval(timer)
        initWidget()
      }
    }, 100)

    return () => {
      isMounted = false
      clearInterval(timer)
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {}
        widgetIdRef.current = null
      }
    }
  }, [siteKey, theme, size])

  if (!siteKey) {
    return null
  }

  return (
    <div className={`turnstile-wrapper flex justify-center ${className}`}>
      <div ref={containerRef} />
    </div>
  )
})
