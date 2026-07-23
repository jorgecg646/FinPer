"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Home, ArrowUpCircle, ArrowDownCircle, User, X, Menu, LogOut, Target, CreditCard, Sun, Moon } from "lucide-react"
import { user as fallbackUser } from "@/lib/finance-data"
import { NetlifyAuthProvider, useAuth, GoogleIcon } from "@/components/auth/netlify-auth"
import { CurrencySelector } from "@/components/finance/currency-pdf-exporter"

// ─────────────────────────────────────────────────────────────────────────────
// Nav items shared by Sidebar and MobileNav
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "home",          label: "Inicio",        icon: Home,            href: "/" },
  { id: "income",        label: "Ingresos",      icon: ArrowUpCircle,   href: "/ingresos" },
  { id: "expenses",      label: "Gastos",        icon: ArrowDownCircle, href: "/gastos" },
  { id: "budgets",       label: "Presupuestos",  icon: Target,          href: "/presupuestos" },
  { id: "subscriptions", label: "Suscripciones", icon: CreditCard,      href: "/suscripciones" },
  { id: "profile",       label: "Perfil",        icon: User,            href: "/perfil" },
]

// ─────────────────────────────────────────────────────────────────────────────
// ThemeToggle — Dark / Light Mode Switcher
// ─────────────────────────────────────────────────────────────────────────────

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("light")

  useEffect(() => {
    try {
      const stored = localStorage.getItem("finflow-theme") as "dark" | "light"
      if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        setTheme("dark")
        document.documentElement.classList.add("dark")
      } else {
        setTheme("light")
        document.documentElement.classList.remove("dark")
      }
    } catch {
      // ignore
    }
  }, [])

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light"
    setTheme(nextTheme)
    try { localStorage.setItem("finflow-theme", nextTheme) } catch {}

    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground transition-colors shadow-xs cursor-pointer"
    >
      {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
    </button>
  )
}

export function UserAvatar({ name, src, className = "h-9 w-9" }: { name: string; src?: string; className?: string }) {
  if (src && src.trim() && src !== "/avatar.png" && src !== "/placeholder.svg") {
    return <img src={src} alt={`Foto de ${name}`} className={`${className} rounded-full object-cover shrink-0 ring-2 ring-card shadow-xs`} />
  }
  return (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground border border-border/80 shadow-xs`}>
      <User className="h-4 w-4" />
    </div>
  )
}

import { PrivacyModal } from "@/components/auth/privacy-modal"

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — desktop left panel
// ─────────────────────────────────────────────────────────────────────────────

export function Sidebar({ balance, onClose }: { balance: number; onClose?: () => void }) {
  const pathname = usePathname()
  const { user, login, logout } = useAuth()
  const [privacyOpen, setPrivacyOpen] = useState(false)

  const displayName = user?.name || fallbackUser.name
  const displayAvatar = user?.avatar || fallbackUser.avatar
  const displaySub = user?.email || fallbackUser.plan

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6">
      <PrivacyModal
        isOpen={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        onAcceptAndLogin={login}
      />

      {/* Logo + close (mobile) */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground shadow-xs">BN</span>
          <span className="text-xl font-bold tracking-tight text-foreground">BudgetNext</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Cerrar menú"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary lg:hidden">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation links */}
      <nav className="mt-8 flex flex-col gap-1" aria-label="Principal">
        {NAV_ITEMS.map(({ id, label, icon: Icon, href }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link key={id} href={href} onClick={onClose} aria-current={isActive ? "page" : undefined}
              className={`flex items-center justify-between rounded-full px-4 py-2.5 text-xs font-semibold transition-colors ${
                isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              }`}>
              <span className="flex items-center gap-3"><Icon className="h-4.5 w-4.5" aria-hidden="true" />{label}</span>
              {isActive && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
            </Link>
          )
        })}
      </nav>

      {/* User card + balance */}
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <UserAvatar name={displayName} src={displayAvatar} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-[10px] text-muted-foreground">{displaySub}</p>
            </div>
          </div>

          {user ? (
            <button
              type="button"
              onClick={logout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPrivacyOpen(true)}
              title="Iniciar sesión con Google"
              aria-label="Iniciar sesión con Google"
              className="flex h-7 px-2.5 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card text-[10px] font-bold text-foreground hover:bg-secondary transition-colors shadow-xs cursor-pointer"
            >
              <GoogleIcon className="h-3.5 w-3.5" />
              <span>Entrar</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border px-3 py-2">
          <span className="text-xs text-muted-foreground">Balance</span>
          <span className="text-sm font-bold text-foreground">
            ${balance.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MobileHeader — top bar shown only on mobile (hamburger + logo + avatar)
// ─────────────────────────────────────────────────────────────────────────────

export function MobileHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { user, login } = useAuth()
  const displayAvatar = user?.avatar || fallbackUser.avatar
  const displayName = user?.name || fallbackUser.name

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
      <button type="button" onClick={onMenuOpen} aria-label="Abrir menú"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground shadow-xs">BN</span>
        <span className="text-base font-bold tracking-tight text-foreground">BudgetNext</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button type="button" onClick={user ? undefined : login} aria-label="Perfil o Inicio de sesión">
          <UserAvatar name={displayName} src={displayAvatar} className="h-8 w-8" />
        </button>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MobileNav — fixed bottom tab bar (mobile only)
// ─────────────────────────────────────────────────────────────────────────────

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 flex border-t border-border bg-card lg:hidden" aria-label="Navegación móvil">
      {NAV_ITEMS.map(({ id, label, icon: Icon, href }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
        return (
          <Link key={id} href={href} aria-current={isActive ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[9px] font-semibold transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>
            <Icon className={`h-4.5 w-4.5 transition-transform ${isActive ? "scale-110" : ""}`} aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LayoutShell — wraps all pages with sidebar + mobile nav & NetlifyAuthProvider
// ─────────────────────────────────────────────────────────────────────────────

export function LayoutShell({ balance, children }: { balance: number; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <NetlifyAuthProvider>
      <div className="flex min-h-screen bg-background">
        {/* Desktop sidebar */}
        <div className="sticky top-0 hidden h-screen lg:block">
          <Sidebar balance={balance} />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 lg:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <Sidebar balance={balance} onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 flex flex-col pb-20 lg:pb-0">
          <MobileHeader onMenuOpen={() => setSidebarOpen(true)} />
          <div className="flex-1 px-4 py-6 sm:px-8" id="main-dashboard-report">{children}</div>
        </main>

        <MobileNav />
      </div>
    </NetlifyAuthProvider>
  )
}
