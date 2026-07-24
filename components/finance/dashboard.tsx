"use client"

import { Eye, EyeOff, TrendingUp, TrendingDown, Bell, X, CheckCircle, AlertTriangle, ShieldCheck } from "lucide-react"
import { useState, useEffect } from "react"
import type { Summary } from "@/app/actions"
import { loadLocalProfile } from "@/lib/profile"
import { useAuth } from "@/components/auth/netlify-auth"
import { UserAvatar } from "@/components/finance/navigation"

// ─────────────────────────────────────────────────────────────────────────────
// Topbar — desktop-only greeting header with interactive Notifications
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return "Buenos días"
  if (hour >= 12 && hour < 21) return "Buenas tardes"
  return "Buenas noches"
}

// ─────────────────────────────────────────────────────────────────────────────
// Topbar — desktop-only greeting header with interactive Notifications
// ─────────────────────────────────────────────────────────────────────────────

export function Topbar() {
  const { user: authUser } = useAuth()
  const [localProfile, setLocalProfile] = useState(loadLocalProfile)
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(true)
  const [greeting, setGreeting] = useState("Buenos días")

  useEffect(() => {
    setGreeting(getGreeting())
    function update() {
      setLocalProfile(loadLocalProfile())
    }
    update()
    window.addEventListener("profile-updated", update)
    return () => window.removeEventListener("profile-updated", update)
  }, [])

  const displayName = authUser?.name || localProfile.name
  const displayAvatar = authUser?.avatar || localProfile.avatar

  const sampleNotifications = [
    { id: "n1", title: "Autenticación activa", desc: authUser ? `Iniciado como ${authUser.email}` : "Cuenta local activa", icon: ShieldCheck, color: "text-positive" },
    { id: "n2", title: "Balance mensual", desc: "Tus estados y resúmenes están actualizados", icon: CheckCircle, color: "text-primary" },
    { id: "n3", title: "Consejo de ahorro", desc: "Revisa la pestaña de Presupuestos para fijar metas", icon: AlertTriangle, color: "text-amber-500" },
  ]

  return (
    <header className="hidden items-start justify-between gap-4 lg:flex relative">
      <div>
        <p className="text-sm text-muted-foreground">{greeting},</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">{displayName}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => { setOpen(!open); setUnread(false) }}
            aria-label="Notificaciones"
            id="topbar-notifications"
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-sm transition-colors hover:bg-secondary cursor-pointer"
          >
            <Bell className="h-5 w-5 text-foreground" aria-hidden="true" />
            {unread && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-destructive animate-pulse" />}
          </button>

          {/* Notifications Popover Dropdown */}
          {open && (
            <div className="absolute right-0 top-14 z-50 w-80 rounded-3xl border border-border bg-card p-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-bold text-foreground">Notificaciones & Alertas</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-2.5">
                {sampleNotifications.map((n) => {
                  const Icon = n.icon
                  return (
                    <div key={n.id} className="flex items-start gap-3 rounded-2xl bg-background p-3 border border-border/40">
                      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${n.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{n.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <UserAvatar name={displayName} src={displayAvatar} className="h-11 w-11" />
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BalanceCard — main card with balance + monthly bar chart
// ─────────────────────────────────────────────────────────────────────────────

export function BalanceCard({ balance, monthly, year }: { balance: number; monthly: Summary["monthly"]; year?: number }) {
  const [hidden, setHidden] = useState(false)
  const maxAbs = Math.max(1, ...monthly.map((m) => Math.abs(m.net)))

  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand-dark p-6 text-white shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/60">Balance total {year ? `(${year})` : ""}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            {hidden ? "••••••••" : `$${balance.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        </div>
        <button type="button" onClick={() => setHidden((v) => !v)} aria-label={hidden ? "Mostrar balance" : "Ocultar balance"}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
          {hidden ? <EyeOff className="h-4 w-4 text-white/80" aria-hidden="true" /> : <Eye className="h-4 w-4 text-white/80" aria-hidden="true" />}
        </button>
      </div>

      {/* Monthly bar chart — Responsive Scrollable Container */}
      <div className="mt-8 overflow-x-auto pb-1 scrollbar-thin">
        <div className="flex items-end justify-between gap-1.5 sm:gap-2 min-w-[460px] sm:min-w-0" style={{ height: 100 }}>
          {monthly.map((m) => {
            const height = 12 + (Math.abs(m.net) / maxAbs) * 64
            return (
              <div key={m.key} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                <div
                  className={`w-full max-w-[28px] rounded-lg ${m.net < 0 ? "bg-destructive/70" : "bg-brand-lime/80"}`}
                  style={{ height: `${height}px` }}
                  title={`${m.label}: ${m.net.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`}
                  aria-hidden="true"
                />
                <span className="text-[10px] sm:text-xs font-medium text-white/70 truncate">{m.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StatCards — income + expense summary cards (right column)
// ─────────────────────────────────────────────────────────────────────────────

export function StatCards({ income, expenses, year }: { income: number; expenses: number; year?: number }) {
  return (
    <div className="flex flex-col gap-4">
      <StatCard label={`Ingresos ${year ? `(${year})` : ""}`} amount={income} positive />
      <StatCard label={`Gastos ${year ? `(${year})` : ""}`} amount={expenses} />
    </div>
  )
}

function StatCard({ label, amount, positive }: { label: string; amount: number; positive?: boolean }) {
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <section className="flex flex-1 flex-col justify-between rounded-3xl bg-card p-5 shadow-sm border border-border/50">
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${positive ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
        ${amount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className={`mt-1 text-xs font-medium ${positive ? "text-positive" : "text-destructive"}`}>
        {positive ? "Total ingresado" : "Total gastado"}
      </p>
    </section>
  )
}
