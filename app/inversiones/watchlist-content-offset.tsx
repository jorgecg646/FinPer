"use client"

import { useState, useEffect, type ReactNode } from "react"

export const TOGGLE_EVENT = "finper-watchlist-toggle"
export const PANEL_W = 272

export function WatchlistContentOffset({ children }: { children: ReactNode }) {
  // Start as collapsed=true to avoid layout shift on first render and ensure minimized by default
  const [collapsed, setCollapsed] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1280px)")
    setIsDesktop(mql.matches)
    const mediaHandler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener("change", mediaHandler)

    const toggleHandler = (e: Event) => {
      const next = (e as CustomEvent<boolean>).detail
      queueMicrotask(() => {
        setCollapsed(next)
      })
    }
    window.addEventListener(TOGGLE_EVENT, toggleHandler)

    return () => {
      mql.removeEventListener("change", mediaHandler)
      window.removeEventListener(TOGGLE_EVENT, toggleHandler)
    }
  }, [])

  return (
    <div
      className="transition-[padding-right] duration-300 ease-in-out"
      style={{ paddingRight: !collapsed && isDesktop ? PANEL_W + 8 : 0 }}
    >
      {children}
    </div>
  )
}
