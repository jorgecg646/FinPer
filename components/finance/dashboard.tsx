"use client"

import { Eye, EyeOff, TrendingUp, TrendingDown, Bell } from "lucide-react"
import { useState } from "react"
import type { Summary } from "@/app/actions"
import { user } from "@/lib/finance-data"

import { useAuth } from "@/components/auth/netlify-auth"

// ─────────────────────────────────────────────────────────────────────────────
// Topbar — desktop-only greeting header
// ─────────────────────────────────────────────────────────────────────────────

export function Topbar() {
  const { user: authUser } = useAuth()
  const displayName = authUser?.name || user.name
  const displayAvatar = authUser?.avatar || user.avatar

  return (
    <header className="hidden items-start justify-between gap-4 lg:flex">
      <div>
        <p className="text-sm text-muted-foreground">Buenos días,</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">{displayName}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Notificaciones" id="topbar-notifications"
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-sm transition-colors hover:bg-secondary">
          <Bell className="h-5 w-5 text-foreground" aria-hidden="true" />
          <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-destructive" />
        </button>
        <img src={displayAvatar} alt={`Foto de ${displayName}`}
          className="h-11 w-11 rounded-full object-cover ring-2 ring-card" />
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BalanceCard — main card with balance + monthly bar chart
// ─────────────────────────────────────────────────────────────────────────────

export function BalanceCard({ balance, monthly }: { balance: number; monthly: Summary["monthly"] }) {
  const [hidden, setHidden] = useState(false)
  const maxAbs = Math.max(1, ...monthly.map((m) => Math.abs(m.net)))

  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand-dark p-6 text-white shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/60">Balance total</p>
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

export function StatCards({ income, expenses }: { income: number; expenses: number }) {
  return (
    <div className="flex flex-col gap-4">
      <StatCard label="Ingresos" amount={income} positive />
      <StatCard label="Gastos" amount={expenses} />
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
