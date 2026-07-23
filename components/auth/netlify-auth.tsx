"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import Script from "next/script"

export type NetlifyUser = {
  id: string
  email: string
  name: string
  avatar: string
}

type AuthContextType = {
  user: NetlifyUser | null
  login: () => void
  logout: () => void
  isLoading: boolean
}

const NETLIFY_IDENTITY_URL = "https://budgetnext.netlify.app/.netlify/identity"

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
})

const STORAGE_KEY = "finflow-netlify-user"

export function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.2.0 10.04.0 12s.47 3.8 1.29 5.42l3.99-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  )
}

function syncUserCookie(user: NetlifyUser | null) {
  if (typeof document === "undefined") return
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : ""
  if (user && user.email) {
    document.cookie = `finflow_user_id=${encodeURIComponent(user.email)}; path=/; max-age=31536000; SameSite=Lax${isSecure}`
  } else {
    document.cookie = `finflow_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${isSecure}`
  }
}

function getWidget() {
  if (typeof window === "undefined") return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any
  return win.netlifyIdentity || null
}

export function NetlifyAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<NetlifyUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  function updateUserState(parsed: NetlifyUser | null, shouldReload = false) {
    setUser(parsed)
    syncUserCookie(parsed)
    if (parsed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    if (shouldReload && typeof window !== "undefined") {
      window.location.reload()
    }
  }

  function initWidget() {
    const widget = getWidget()
    if (!widget) return

    try {
      widget.init({
        APIUrl: NETLIFY_IDENTITY_URL,
        container: "body",
      })
      if (typeof widget.setAPIUrl === "function") {
        widget.setAPIUrl(NETLIFY_IDENTITY_URL)
      }

      const currentUser = widget.currentUser()
      if (currentUser) {
        const parsed: NetlifyUser = {
          id: currentUser.id || currentUser.email || "user",
          email: currentUser.email || "",
          name: currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "Usuario Google",
          avatar: currentUser.user_metadata?.avatar_url || "/avatar.png",
        }
        updateUserState(parsed)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      widget.on("login", (netUser: any) => {
        const parsed: NetlifyUser = {
          id: netUser.id || netUser.email || "user",
          email: netUser.email || "",
          name: netUser.user_metadata?.full_name || netUser.email?.split("@")[0] || "Usuario Google",
          avatar: netUser.user_metadata?.avatar_url || "/avatar.png",
        }
        updateUserState(parsed, true)
        try { widget.close() } catch {}
      })

      widget.on("logout", () => {
        updateUserState(null, true)
      })
    } catch (e) {
      console.warn("Netlify Identity init error:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // 1. Restore cached local user if available
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setUser(parsed)
        syncUserCookie(parsed)
      }
    } catch {
      // ignore
    }

    // 2. If script already loaded, init
    if (getWidget()) {
      initWidget()
    } else {
      setIsLoading(false)
    }
  }, [])

  function login() {
    const widget = getWidget()
    if (widget) {
      widget.open("login")
    } else {
      // fallback redirect
      window.location.href = NETLIFY_IDENTITY_URL
    }
  }

  function logout() {
    const widget = getWidget()
    if (widget) {
      widget.logout()
    }
    updateUserState(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      <Script
        src="https://identity.netlify.com/v1/netlify-identity-widget.js"
        onLoad={initWidget}
      />
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
