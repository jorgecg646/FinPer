"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Home, ArrowUpCircle, ArrowDownCircle, User, Bell, X, Menu, LogOut, LogIn } from "lucide-react"
import { user as fallbackUser } from "@/lib/finance-data"
import { NetlifyAuthProvider, useAuth, GoogleIcon } from "@/components/auth/netlify-auth"

// ─────────────────────────────────────────────────────────────────────────────
// Nav items shared by Sidebar and MobileNav
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "home",     label: "Inicio",   icon: Home,            href: "/" },
  { id: "income",   label: "Ingresos", icon: ArrowUpCircle,   href: "/ingresos" },
  { id: "expenses", label: "Gastos",   icon: ArrowDownCircle, href: "/gastos" },
  { id: "profile",  label: "Perfil",   icon: User,            href: "/perfil" },
]

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — desktop left panel
// ─────────────────────────────────────────────────────────────────────────────

export function Sidebar({ balance, onClose }: { balance: number; onClose?: () => void }) {
  const pathname = usePathname()
  const { user, login, logout } = useAuth()

  const displayName = user?.name || fallbackUser.name
  const displayAvatar = user?.avatar || fallbackUser.avatar
  const displaySub = user?.email || fallbackUser.plan

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6">
      {/* Logo + close (mobile) */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">FF</span>
          <span className="text-xl font-bold tracking-tight text-foreground">FinFlow</span>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Cerrar menú"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary lg:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation links */}
      <nav className="mt-10 flex flex-col gap-1" aria-label="Principal">
        {NAV_ITEMS.map(({ id, label, icon: Icon, href }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link key={id} href={href} onClick={onClose} aria-current={isActive ? "page" : undefined}
              className={`flex items-center justify-between rounded-full px-4 py-3 text-sm font-medium transition-colors ${
                isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              }`}>
              <span className="flex items-center gap-3"><Icon className="h-5 w-5" aria-hidden="true" />{label}</span>
              {isActive && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
            </Link>
          )
        })}
      </nav>

      {/* User card + balance */}
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <img src={displayAvatar} alt={`Foto de ${displayName}`} className="h-9 w-9 rounded-full object-cover shrink-0" />
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
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={login}
              title="Iniciar sesión con Google"
              aria-label="Iniciar sesión con Google"
              className="flex h-7 px-2.5 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card text-[10px] font-bold text-foreground hover:bg-secondary transition-colors shadow-xs"
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
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">FF</span>
        <span className="text-base font-bold tracking-tight text-foreground">FinFlow</span>
      </div>
      <button type="button" onClick={user ? undefined : login} aria-label="Perfil o Inicio de sesión">
        <img src={displayAvatar} alt={`Foto de ${displayName}`} className="h-9 w-9 rounded-full object-cover ring-2 ring-card" />
      </button>
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
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>
            <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} aria-hidden="true" />
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
          <div className="flex-1 px-4 py-6 sm:px-8">{children}</div>
        </main>

        <MobileNav />
      </div>
    </NetlifyAuthProvider>
  )
}
