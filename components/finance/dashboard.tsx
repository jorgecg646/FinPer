"use client"

import { Eye, EyeOff, TrendingUp, TrendingDown, Bell, X, CheckCircle, AlertTriangle, ShieldCheck, Wallet, ChevronRight } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import type { Summary } from "@/app/actions"
import { loadLocalProfile } from "@/lib/profile"
import { useAuth } from "@/components/auth/netlify-auth"
import { UserAvatar } from "@/components/finance/navigation"
import { fmtCurrency, fmtSignedCurrency, CURRENCY_SYMBOLS, getFallbackFxRate } from "@/lib/format"
import { useCurrency } from "@/components/finance/use-currency"

// Visx imports
import { LinePath, AreaClosed, Bar, Line } from "@visx/shape"
import { curveMonotoneX } from "@visx/curve"
import { LinearGradient } from "@visx/gradient"
import { Group } from "@visx/group"
import { scaleBand, scaleLinear } from "@visx/scale"

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
    { id: "n1", title: "Autenticación activa", desc: authUser ? `Iniciado como ${authUser.email}` : "Cuenta local activa", icon: ShieldCheck, color: "text-emerald-400" },
    { id: "n2", title: "Balance mensual", desc: "Tus estados y resúmenes están actualizados", icon: CheckCircle, color: "text-emerald-400" },
    { id: "n3", title: "Consejo de ahorro", desc: "Revisa la pestaña de Presupuestos para fijar metas", icon: AlertTriangle, color: "text-amber-400" },
  ]

  return (
    <header className="hidden items-start justify-between gap-4 lg:flex relative">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{greeting},</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground text-balance mt-0.5">{displayName}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => { setOpen(!open); setUnread(false) }}
            aria-label="Notificaciones"
            id="topbar-notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border shadow-xs transition-colors hover:border-border/80 cursor-pointer"
          >
            <Bell className="h-4 w-4 text-foreground" aria-hidden="true" />
            {unread && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
          </button>

          {/* Notifications Popover Dropdown */}
          {open && (
            <div className="absolute right-0 top-13 z-50 w-80 rounded-2xl border border-border bg-card p-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <span className="text-xs font-bold text-foreground">Notificaciones & Alertas</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {sampleNotifications.map((n) => {
                  const Icon = n.icon
                  return (
                    <div key={n.id} className="flex items-start gap-2.5 rounded-xl bg-muted/50 dark:bg-[#1a1c23] p-2.5 border border-border/50 dark:border-white/[0.04]">
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

        <UserAvatar name={displayName} src={displayAvatar} className="h-10 w-10 rounded-xl" />
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BalanceCard — Hero Getquin Style Portfolio Chart
// ─────────────────────────────────────────────────────────────────────────────

export function BalanceCard({
  balance,
  monthly,
  year,
  currencySymbol,
}: {
  balance: number
  monthly: Summary["monthly"]
  year?: number
  currencySymbol?: string
}) {
  const { symbol: resolvedSym } = useCurrency(currencySymbol)
  const [hidden, setHidden] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const svgWidth = 600
  const svgHeight = 150
  const margin = { top: 15, right: 15, bottom: 25, left: 15 }
  const innerW = svgWidth - margin.left - margin.right
  const innerH = svgHeight - margin.top - margin.bottom

  const maxVal = Math.max(1, ...monthly.map((m) => Math.abs(m.net)))

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, innerW],
        domain: monthly.map((m) => m.label),
        padding: 0.35,
      }),
    [innerW, monthly]
  )

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [innerH, 0],
        domain: [0, maxVal * 1.15],
      }),
    [innerH, maxVal]
  )

  const linePoints = useMemo(() => {
    return monthly.map((m, idx) => ({
      x: (xScale(m.label) ?? 0) + xScale.bandwidth() / 2,
      y: yScale(Math.max(0, m.net)),
      net: m.net,
      label: m.label,
    }))
  }, [monthly, xScale, yScale])

  const activePoint = hoveredIdx !== null ? linePoints[hoveredIdx] : null

  // Variación del balance neto frente al mes anterior
  const monthComparison = useMemo(() => {
    if (!monthly || monthly.length === 0) return null

    const now = new Date()
    const isCurrentYear = !year || year === now.getFullYear()
    
    // Mes activo: mes actual o el último mes con actividad registrada
    let activeIdx = isCurrentYear ? now.getMonth() : 11
    if (monthly[activeIdx]?.income === 0 && monthly[activeIdx]?.expense === 0) {
      for (let i = monthly.length - 1; i >= 0; i--) {
        if (monthly[i].income > 0 || monthly[i].expense > 0) {
          activeIdx = i
          break
        }
      }
    }

    if (activeIdx <= 0) return null
    const curMonth = monthly[activeIdx]
    const prevMonth = monthly[activeIdx - 1]
    if (!curMonth || !prevMonth) return null

    const curNet = curMonth.net
    const prevNet = prevMonth.net

    if (prevNet === 0) {
      if (curNet === 0) return { pct: 0, isPos: true, label: `vs ${prevMonth.label}` }
      return { pct: 100, isPos: curNet > 0, label: `vs ${prevMonth.label}` }
    }

    const diff = curNet - prevNet
    const pct = (diff / Math.abs(prevNet)) * 100
    const isPos = pct >= 0

    return {
      pct: Math.abs(pct),
      isPos,
      label: `vs ${prevMonth.label}`,
    }
  }, [monthly, year])

  return (
    <section className="relative overflow-hidden rounded-2xl bg-card p-5 sm:p-6 border border-border shadow-xs transition-colors hover:border-border/80">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Balance Total
          </span>

          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl sm:text-4xl font-extrabold text-foreground tabular-nums tracking-tight">
              {hidden ? "••••••••" : fmtCurrency(balance, resolvedSym)}
            </span>
            {monthComparison && (
              <span
                className={`inline-flex items-center gap-1 text-sm sm:text-base font-extrabold tabular-nums ${
                  monthComparison.isPos ? "text-emerald-400" : "text-destructive"
                }`}
                title={`Variación del balance neto (${monthComparison.isPos ? "+" : "-"}${monthComparison.pct.toFixed(1)}%) ${monthComparison.label}`}
              >
                {monthComparison.isPos ? "↗ +" : "↘ -"}{monthComparison.pct > 999 ? ">999" : monthComparison.pct.toFixed(1)} %
                <span className="text-[10px] font-semibold text-muted-foreground/75 ml-0.5">
                  {monthComparison.label}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHidden((v) => !v)}
            aria-label={hidden ? "Mostrar balance" : "Ocultar balance"}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 dark:bg-[#1a1c23] border border-border dark:border-white/[0.06] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Visx Monthly Bar Chart Container */}
      <div className="mt-6 overflow-x-auto pb-1 scrollbar-thin">
        <div className="w-[600px] sm:w-full">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-40 w-full overflow-visible select-none">
            <LinearGradient id="visx-bal-bar-green" from="#10b981" to="#059669" />
            <LinearGradient id="visx-bal-bar-red" from="#f43f5e" to="#e11d48" />
            <Group left={margin.left} top={margin.top}>
              {/* Horizontal subtle grid */}
              {[0, 0.5, 1].map((pct, idx) => (
                <line
                  key={idx}
                  x1={0}
                  y1={innerH * pct}
                  x2={innerW}
                  y2={innerH * pct}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              ))}

              {/* Monthly Bars */}
              {monthly.map((m, i) => {
                const barWidth = xScale.bandwidth()
                const barX = xScale(m.label) ?? 0
                const isHovered = hoveredIdx === i
                const val = Math.abs(m.net)
                const barY = yScale(val)
                const barHeight = Math.max(4, innerH - barY)
                const isPositive = m.net >= 0

                return (
                  <g
                    key={m.key}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {/* Hover backdrop column */}
                    <rect
                      x={barX - 4}
                      y={0}
                      width={barWidth + 8}
                      height={innerH}
                      fill={isHovered ? "rgba(255, 255, 255, 0.04)" : "transparent"}
                      rx={6}
                    />

                    {/* Visx Bar */}
                    <Bar
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      fill={isPositive ? "url(#visx-bal-bar-green)" : "url(#visx-bal-bar-red)"}
                      rx={4}
                      opacity={isHovered ? 1 : 0.85}
                      className="transition-all duration-200"
                    />

                    {/* Value label on hover */}
                    {isHovered && (
                      <text
                        x={barX + barWidth / 2}
                        y={Math.max(10, barY - 6)}
                        textAnchor="middle"
                        fill={isPositive ? "#10b981" : "#f43f5e"}
                        fontSize={10}
                        fontWeight={700}
                        className="tabular-nums"
                      >
                        {fmtSignedCurrency(isPositive ? val : -val, resolvedSym, 0, 0)}
                      </text>
                    )}

                    {/* Month text label */}
                    <text
                      x={barX + barWidth / 2}
                      y={innerH + 18}
                      textAnchor="middle"
                      className={`text-[11px] font-semibold transition-colors ${
                        isHovered ? "fill-foreground font-bold" : "fill-muted-foreground"
                      }`}
                    >
                      {m.label}
                    </text>
                  </g>
                )
              })}
            </Group>
          </svg>
        </div>
      </div>

      {hoveredIdx !== null && (
        <div className="mt-2 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card dark:bg-[#1a1c23] border border-border dark:border-white/[0.08] text-xs tabular-nums shadow-xs">
            <span className="font-bold text-foreground">{monthly[hoveredIdx].label}:</span>
            <span className={monthly[hoveredIdx].net >= 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
              {fmtSignedCurrency(monthly[hoveredIdx].net, resolvedSym)}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StatCards — income + expense summary cards (Getquin Style)
// ─────────────────────────────────────────────────────────────────────────────

export function StatCards({
  income,
  expenses,
  year,
  currencySymbol,
}: {
  income: number
  expenses: number
  year?: number
  currencySymbol?: string
}) {
  const { symbol: resolvedSym } = useCurrency(currencySymbol)
  return (
    <div className="flex flex-col gap-4">
      <StatCard label={`Ingresos ${year ? `(${year})` : ""}`} amount={income} positive currencySymbol={resolvedSym} />
      <StatCard label={`Gastos ${year ? `(${year})` : ""}`} amount={expenses} currencySymbol={resolvedSym} />
    </div>
  )
}

function StatCard({
  label,
  amount,
  positive,
  currencySymbol = "€",
}: {
  label: string
  amount: number
  positive?: boolean
  currencySymbol?: string
}) {
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <section className="flex flex-1 flex-col justify-between rounded-2xl bg-card p-5 border border-border shadow-xs transition-colors hover:border-border/80">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
          positive
            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
            : "bg-rose-500/10 text-rose-500 border-rose-500/20"
        }`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-extrabold tracking-tight tabular-nums text-foreground">
        {fmtCurrency(amount, currencySymbol)}
      </p>
      <p className={`mt-1 text-xs font-semibold ${positive ? "text-emerald-500" : "text-rose-500"}`}>
        {positive ? "Total ingresado" : "Total gastado"}
      </p>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// InvestmentBalanceBanner — reads live portfolio snapshot from localStorage
// ─────────────────────────────────────────────────────────────────────────────

type PortfolioSnapshot = {
  invested: number
  current: number
  pl: number
  plPct: number
  currency: string
  updatedAt: number
}

const SNAPSHOT_KEY = "finper_portfolio_snapshot"

function readSnapshot(): PortfolioSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    return raw ? (JSON.parse(raw) as PortfolioSnapshot) : null
  } catch {
    return null
  }
}

export function InvestmentBalanceBanner({
  cashBalance,
  currencySymbol,
}: {
  cashBalance: number
  currencySymbol?: string
}) {
  const { currency: activeCurrency, symbol: activeSym } = useCurrency(currencySymbol)
  const [snap, setSnap] = useState<PortfolioSnapshot | null>(null)
  const [liveFxRate, setLiveFxRate] = useState<number | null>(null)

  useEffect(() => {
    function load() {
      setSnap(readSnapshot())
    }
    load()
    window.addEventListener("portfolio-snapshot-updated", load)
    window.addEventListener("finflow-currency-changed", load)
    window.addEventListener("storage", load)
    return () => {
      window.removeEventListener("portfolio-snapshot-updated", load)
      window.removeEventListener("finflow-currency-changed", load)
      window.removeEventListener("storage", load)
    }
  }, [])

  const snapCurrency = snap?.currency || activeCurrency

  useEffect(() => {
    if (!snap?.currency || snap.currency.toUpperCase() === activeCurrency.toUpperCase()) {
      setLiveFxRate(1)
      return
    }
    let cancelled = false
    fetch(`/api/fx-rate?from=${snap.currency}&to=${activeCurrency}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && typeof data.rate === "number" && data.rate > 0) {
          setLiveFxRate(data.rate)
        }
      })
      .catch(() => {
        // Fallback handled by getFallbackFxRate
      })
    return () => {
      cancelled = true
    }
  }, [snap?.currency, activeCurrency])

  if (!snap || snap.current <= 0) return null

  const fxRate =
    snapCurrency.toUpperCase() === activeCurrency.toUpperCase()
      ? 1
      : (liveFxRate ?? getFallbackFxRate(snapCurrency, activeCurrency))

  const invested = snap.invested * fxRate
  const current = snap.current * fxRate
  const pl = snap.pl * fxRate
  const plPct = snap.plPct
  const isGain = pl >= 0
  const netWorth = cashBalance + current

  const fmt = (n: number) => fmtCurrency(n, activeSym)

  return (
    <section className="relative overflow-hidden rounded-2xl bg-card border border-border p-5 shadow-xs transition-colors hover:border-border/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
            isGain ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
          }`}>
            <Wallet className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cartera de inversión</p>
            <p className="text-sm font-extrabold text-foreground">Valor en tiempo real</p>
          </div>
        </div>
        <a
          href="/inversiones"
          className="flex items-center gap-1 text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
          aria-label="Ver inversiones"
        >
          Ver detalle
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/50 dark:bg-[#1a1c23] border border-border/50 dark:border-white/[0.04]">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Capital Invertido</span>
          <span className="text-sm font-extrabold text-foreground tabular-nums">
            {fmt(invested)}
          </span>
        </div>

        <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/50 dark:bg-[#1a1c23] border border-border/50 dark:border-white/[0.04]">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Valor actual</span>
          <span className="text-sm font-extrabold text-foreground tabular-nums">
            {fmt(current)}
          </span>
        </div>

        <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/50 dark:bg-[#1a1c23] border border-border/50 dark:border-white/[0.04]">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Rentabilidad Total</span>
          <span className={`text-sm font-extrabold tabular-nums ${isGain ? "text-emerald-500" : "text-rose-500"}`}>
            {fmtSignedCurrency(pl, activeSym)}
            <span className="ml-1.5 text-xs font-bold">
              ({isGain ? "↗ +" : "↘ "}{plPct.toFixed(2)}%)
            </span>
          </span>
        </div>
      </div>

      {/* Patrimonio neto total */}
      <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/50 dark:bg-[#1a1c23] border border-border dark:border-white/[0.06] px-4 py-2.5">
        <span className="text-xs font-bold text-muted-foreground">Patrimonio neto total</span>
        <span className="text-base font-black text-foreground tabular-nums">
          {fmt(netWorth)}
          <span className="ml-2 text-[10px] font-semibold text-muted-foreground">
            (caja {fmtSignedCurrency(cashBalance, activeSym)} · cartera {fmt(current)})
          </span>
        </span>
      </div>
    </section>
  )
}
