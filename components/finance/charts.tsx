"use client"

import { useState } from "react"
import type { Summary, Tx } from "@/app/actions"
import { Calendar, ChevronDown } from "lucide-react"

const PALETTE = [
  "#c4e538", "#2fa971", "#16362a", "#6f7d72",
  "#e5484d", "#60a5fa", "#f97316", "#a78bfa",
  "#34d399", "#fbbf24", "#f43f5e", "#0ea5e9"
]

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCartesian(cx, cy, r, start)
  const e = polarToCartesian(cx, cy, r, end)
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${e.x} ${e.y} Z`
}

function getYearMonthsData(transactions: Tx[], selectedYear: number) {
  const data: { label: string; income: number; expense: number; net: number }[] = []

  for (let m = 0; m < 12; m++) {
    let inc = 0
    let exp = 0

    for (const t of transactions) {
      const td = new Date(t.occurredAt)
      if (td.getFullYear() === selectedYear && td.getMonth() === m) {
        if (t.type === "income") inc += t.amount
        else exp += t.amount
      }
    }

    data.push({
      label: MONTH_LABELS[m],
      income: inc,
      expense: exp,
      net: inc - exp
    })
  }

  return data
}

import { useRouter, usePathname, useSearchParams } from "next/navigation"

// ─────────────────────────────────────────────────────────────────────────────
// YearSelector — Control component for filtering charts by year
// ─────────────────────────────────────────────────────────────────────────────

export function YearSelector({
  selectedYear,
  availableYears,
}: {
  selectedYear: number
  availableYears: number[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleYearChange(year: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("year", year.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-xs transition-colors hover:border-primary/50">
      <Calendar className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="text-xs font-medium text-muted-foreground">Año</span>
      <div className="relative inline-flex items-center justify-center">
        <select
          value={selectedYear}
          onChange={(e) => handleYearChange(Number(e.target.value))}
          className="cursor-pointer appearance-none bg-transparent pr-5 text-xs font-bold text-foreground outline-none text-center leading-none"
        >
          {availableYears.map((y) => (
            <option key={y} value={y} className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100 font-semibold">
              {y}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. IncomeChart — 12 Months (Enero - Diciembre)
// ─────────────────────────────────────────────────────────────────────────────

export function IncomeChart({ monthly, year }: { monthly: Summary["monthly"]; year?: number }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const maxIncome = Math.max(1, ...monthly.map((m) => Math.max(0, m.net)))

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">Ingresos del Año {year ? `(${year})` : ""}</h2>
          <p className="text-xs text-muted-foreground">Enero a Diciembre</p>
        </div>
        {hoveredIdx !== null && (
          <div className="text-xs font-semibold text-positive bg-positive/10 px-3 py-1 rounded-full self-start sm:self-auto">
            {monthly[hoveredIdx].label}: +${Math.max(0, monthly[hoveredIdx].net).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
          </div>
        )}
      </div>

      {/* Horizontal scroll wrapper for crisp mobile rendering */}
      <div className="mt-4 overflow-x-auto pb-2 scrollbar-thin">
        <div className="min-w-[540px] flex flex-col gap-2">
          <div className="relative h-44 sm:h-48 w-full">
            <svg viewBox="0 0 600 160" preserveAspectRatio="none" className="h-full w-full" role="img">
              <line x1="0" y1="20" x2="600" y2="20" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="90" x2="600" y2="90" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="158" x2="600" y2="158" stroke="var(--border)" strokeWidth="1.5" />

              {monthly.map((m, i) => {
                const groupW = 600 / monthly.length
                const barW = 18
                const x = i * groupW + (groupW - barW) / 2
                const netIncome = Math.max(0, m.net)
                const barHeight = (netIncome / maxIncome) * 135
                const isHovered = hoveredIdx === i

                return (
                  <g
                    key={m.key}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <rect x={i * groupW} y="0" width={groupW} height="160" fill="var(--primary)" opacity={isHovered ? "0.08" : "0"} rx="4" />
                    <rect
                      x={x}
                      y={158 - barHeight}
                      width={barW}
                      height={Math.max(2, barHeight)}
                      rx="4"
                      fill="var(--positive)"
                      opacity={isHovered ? "1" : "0.85"}
                      className="transition-all duration-200"
                    />
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="grid grid-cols-12 text-center text-xs font-semibold text-muted-foreground pt-1">
            {monthly.map((m, i) => (
              <span
                key={m.key}
                className={`cursor-pointer transition-colors ${hoveredIdx === i ? "text-foreground font-bold" : ""}`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. IncomeCategoryChart — Donut breakdown of income categories
// ─────────────────────────────────────────────────────────────────────────────

export function IncomeCategoryChart({ transactions }: { transactions: Tx[] }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const byCategory = new Map<string, number>()
  for (const t of transactions.filter((t) => t.type === "income")) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
  }

  const entries = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const total = entries.reduce((s, [, v]) => s + v, 0)

  if (total === 0) {
    return (
      <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
        <h2 className="text-sm font-bold text-foreground sm:text-base">Fuentes de Ingreso</h2>
        <p className="mt-6 mb-4 text-center text-sm text-muted-foreground">Sin ingresos registrados aún.</p>
      </section>
    )
  }

  let currentAngle = 0
  const slices = entries.map(([cat, amount], i) => {
    const deg = (amount / total) * 360
    const path = arcPath(100, 100, 80, currentAngle, currentAngle + deg - 0.5)
    currentAngle += deg
    return { cat, amount, path, color: PALETTE[(i + 2) % PALETTE.length] }
  })

  const activeSlice = activeCategory ? slices.find(s => s.cat === activeCategory) : null

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <h2 className="text-sm font-bold text-foreground sm:text-base">Distribución por Fuente de Ingreso</h2>

      <div className="mt-4 flex flex-col md:flex-row items-center gap-6">
        <div className="relative shrink-0 flex justify-center items-center">
          <svg viewBox="0 0 200 200" className="h-36 w-36 sm:h-44 sm:w-44" role="img">
            {slices.map((s) => {
              const isActive = activeCategory === s.cat
              return (
                <path
                  key={s.cat}
                  d={s.path}
                  fill={s.color}
                  opacity={activeCategory === null || isActive ? "0.9" : "0.3"}
                  className="cursor-pointer transition-all duration-200 hover:opacity-100"
                  onMouseEnter={() => setActiveCategory(s.cat)}
                  onMouseLeave={() => setActiveCategory(null)}
                />
              )
            })}
            <circle cx="100" cy="100" r="48" fill="var(--card)" />
            <text x="100" y="90" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
              {activeSlice ? activeSlice.cat : "Total Ingresos"}
            </text>
            <text x="100" y="110" textAnchor="middle" fontSize="14" fontWeight="bold" fill="var(--positive)">
              +${(activeSlice ? activeSlice.amount : total).toLocaleString("es-ES", { maximumFractionDigits: 0 })}
            </text>
            {activeSlice && (
              <text x="100" y="125" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--muted-foreground)">
                {((activeSlice.amount / total) * 100).toFixed(1)}%
              </text>
            )}
          </svg>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-1.5 w-full">
          {slices.map((s) => {
            const isActive = activeCategory === s.cat
            return (
              <div
                key={s.cat}
                onMouseEnter={() => setActiveCategory(s.cat)}
                onMouseLeave={() => setActiveCategory(null)}
                className={`flex items-center gap-2 p-1.5 rounded-xl cursor-pointer transition-all ${
                  isActive ? "bg-secondary" : "hover:bg-secondary/50"
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{s.cat}</span>
                <span className="text-xs font-bold text-positive">
                  +${s.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </span>
                <span className="w-10 text-right text-[10px] font-semibold text-muted-foreground">
                  {((s.amount / total) * 100).toFixed(1)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ExpenseChart — Donut Chart for Expense Categories
// ─────────────────────────────────────────────────────────────────────────────

export function ExpenseChart({ transactions }: { transactions: Tx[] }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const byCategory = new Map<string, number>()
  for (const t of transactions.filter((t) => t.type === "expense")) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
  }

  const entries = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const total = entries.reduce((s, [, v]) => s + v, 0)

  if (total === 0) {
    return (
      <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
        <h2 className="text-sm font-bold text-foreground sm:text-base">Gastos por Categoría</h2>
        <p className="mt-6 mb-4 text-center text-sm text-muted-foreground">Sin datos de gastos aún.</p>
      </section>
    )
  }

  let currentAngle = 0
  const slices = entries.map(([cat, amount], i) => {
    const deg = (amount / total) * 360
    const path = arcPath(100, 100, 80, currentAngle, currentAngle + deg - 0.5)
    currentAngle += deg
    return { cat, amount, path, color: PALETTE[i % PALETTE.length] }
  })

  const activeSlice = activeCategory ? slices.find(s => s.cat === activeCategory) : null

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <h2 className="text-sm font-bold text-foreground sm:text-base">Gastos por Categoría</h2>

      <div className="mt-4 flex flex-col md:flex-row items-center gap-6">
        <div className="relative shrink-0 flex justify-center items-center">
          <svg viewBox="0 0 200 200" className="h-36 w-36 sm:h-44 sm:w-44" role="img">
            {slices.map((s) => {
              const isActive = activeCategory === s.cat
              return (
                <path
                  key={s.cat}
                  d={s.path}
                  fill={s.color}
                  opacity={activeCategory === null || isActive ? "0.9" : "0.3"}
                  className="cursor-pointer transition-all duration-200 hover:opacity-100"
                  onMouseEnter={() => setActiveCategory(s.cat)}
                  onMouseLeave={() => setActiveCategory(null)}
                />
              )
            })}
            <circle cx="100" cy="100" r="48" fill="var(--card)" />
            <text x="100" y="90" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
              {activeSlice ? activeSlice.cat : "Total Gastos"}
            </text>
            <text x="100" y="110" textAnchor="middle" fontSize="14" fontWeight="bold" fill="var(--foreground)">
              ${(activeSlice ? activeSlice.amount : total).toLocaleString("es-ES", { maximumFractionDigits: 0 })}
            </text>
            {activeSlice && (
              <text x="100" y="125" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--muted-foreground)">
                {((activeSlice.amount / total) * 100).toFixed(1)}%
              </text>
            )}
          </svg>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-1.5 w-full">
          {slices.map((s) => {
            const isActive = activeCategory === s.cat
            return (
              <div
                key={s.cat}
                onMouseEnter={() => setActiveCategory(s.cat)}
                onMouseLeave={() => setActiveCategory(null)}
                className={`flex items-center gap-2 p-1.5 rounded-xl cursor-pointer transition-all ${
                  isActive ? "bg-secondary" : "hover:bg-secondary/50"
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{s.cat}</span>
                <span className="text-xs font-bold text-foreground">
                  ${s.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </span>
                <span className="w-10 text-right text-[10px] font-semibold text-muted-foreground">
                  {((s.amount / total) * 100).toFixed(1)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ExpenseMonthlyBarChart — 12 Months Expense Bar Chart (Enero - Diciembre)
// ─────────────────────────────────────────────────────────────────────────────

export function ExpenseMonthlyBarChart({ transactions, selectedYear }: { transactions: Tx[]; selectedYear: number }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const monthlyData = getYearMonthsData(transactions, selectedYear)
  const maxExpense = Math.max(1, ...monthlyData.map((m) => m.expense))

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">Gastos por Mes ({selectedYear})</h2>
          <p className="text-xs text-muted-foreground">Enero a Diciembre</p>
        </div>
        {hoveredIdx !== null && (
          <div className="text-xs font-semibold text-destructive bg-destructive/10 px-3 py-1 rounded-full self-start sm:self-auto">
            {monthlyData[hoveredIdx].label}: -${monthlyData[hoveredIdx].expense.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto pb-2 scrollbar-thin">
        <div className="min-w-[540px] flex flex-col gap-2">
          <div className="relative h-44 sm:h-48 w-full">
            <svg viewBox="0 0 600 160" preserveAspectRatio="none" className="h-full w-full" role="img">
              <line x1="0" y1="20" x2="600" y2="20" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="90" x2="600" y2="90" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="158" x2="600" y2="158" stroke="var(--border)" strokeWidth="1.5" />

              {monthlyData.map((m, i) => {
                const groupW = 600 / monthlyData.length
                const barW = 18
                const x = i * groupW + (groupW - barW) / 2
                const barHeight = (m.expense / maxExpense) * 135
                const isHovered = hoveredIdx === i

                return (
                  <g
                    key={m.label + i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <rect x={i * groupW} y="0" width={groupW} height="160" fill="var(--primary)" opacity={isHovered ? "0.08" : "0"} rx="4" />
                    <rect
                      x={x}
                      y={158 - barHeight}
                      width={barW}
                      height={Math.max(2, barHeight)}
                      rx="4"
                      fill="var(--destructive)"
                      opacity={isHovered ? "1" : "0.85"}
                      className="transition-all duration-200"
                    />
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="grid grid-cols-12 text-center text-xs font-semibold text-muted-foreground pt-1">
            {monthlyData.map((m, i) => (
              <span
                key={m.label + i}
                className={`cursor-pointer transition-colors ${hoveredIdx === i ? "text-foreground font-bold" : ""}`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MonthlyComparisonChart — Dual Bar Chart (Enero - Diciembre)
// ─────────────────────────────────────────────────────────────────────────────

export function MonthlyComparisonChart({ transactions, selectedYear }: { transactions: Tx[]; selectedYear: number }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const months = getYearMonthsData(transactions, selectedYear)
  const maxVal = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]))

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">Comparativa Ingresos vs Gastos ({selectedYear})</h2>
          <p className="text-xs text-muted-foreground">Flujo mensual de Enero a Diciembre</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold self-start sm:self-auto bg-secondary px-2.5 py-1 rounded-full">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-positive" />
            <span>Ingresos</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            <span>Gastos</span>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-2 scrollbar-thin">
        <div className="min-w-[540px] flex flex-col gap-2">
          <div className="relative h-44 sm:h-48 w-full">
            <svg viewBox="0 0 600 160" preserveAspectRatio="none" className="h-full w-full" role="img">
              <line x1="0" y1="20" x2="600" y2="20" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="90" x2="600" y2="90" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="158" x2="600" y2="158" stroke="var(--border)" strokeWidth="1.5" />

              {months.map((m, i) => {
                const groupW = 600 / months.length
                const barW = 10
                const xInc = i * groupW + (groupW - (barW * 2 + 2)) / 2
                const xExp = xInc + barW + 2

                const hInc = (m.income / maxVal) * 135
                const hExp = (m.expense / maxVal) * 135
                const isHovered = hoveredIdx === i

                return (
                  <g
                    key={m.label + i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <rect x={i * groupW} y="0" width={groupW} height="160" fill="var(--primary)" opacity={isHovered ? "0.08" : "0"} rx="3" />
                    <rect x={xInc} y={158 - hInc} width={barW} height={Math.max(2, hInc)} rx="2" fill="var(--positive)" opacity={isHovered ? "1" : "0.85"} />
                    <rect x={xExp} y={158 - hExp} width={barW} height={Math.max(2, hExp)} rx="2" fill="var(--destructive)" opacity={isHovered ? "1" : "0.85"} />
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="grid grid-cols-12 text-center text-xs font-semibold text-muted-foreground pt-1">
            {months.map((m, i) => (
              <span
                key={m.label + i}
                className={`cursor-pointer transition-colors ${hoveredIdx === i ? "text-foreground font-bold" : ""}`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 min-h-[22px] flex items-center justify-center text-xs">
        {hoveredIdx !== null ? (
          <div className="flex items-center gap-3 bg-secondary/80 px-3 py-1 rounded-full font-medium">
            <span className="font-bold text-foreground">{months[hoveredIdx].label}:</span>
            <span className="text-positive">Ingresos: +${months[hoveredIdx].income.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            <span className="text-destructive">Gastos: -${months[hoveredIdx].expense.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">Pasa el cursor por una barra para ver detalles</span>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. NetSavingsTrendChart — Line & Area Chart (Enero - Diciembre)
// ─────────────────────────────────────────────────────────────────────────────

export function NetSavingsTrendChart({ transactions, selectedYear }: { transactions: Tx[]; selectedYear: number }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const data = getYearMonthsData(transactions, selectedYear)

  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.net)))
  const stepX = 550 / (data.length - 1 || 1)

  const points = data.map((d, i) => {
    const x = 25 + i * stepX
    const y = 70 - (d.net / maxAbs) * 55
    return { x, y, ...d }
  })

  const pathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "")
  const areaD = `${pathD} L ${points[points.length - 1].x} 70 L ${points[0].x} 70 Z`

  const totalYearNet = data.reduce((s, d) => s + d.net, 0)
  const activePoint = activeIdx !== null ? points[activeIdx] : null

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">Tendencia de Ahorro Neto ({selectedYear})</h2>
          <p className="text-xs text-muted-foreground">Flujo de caja neto mensual de Enero a Diciembre</p>
        </div>
        <div className={`self-start sm:self-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${totalYearNet >= 0 ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"}`}>
          {totalYearNet >= 0 ? "+" : ""}${totalYearNet.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} en {selectedYear}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-2 scrollbar-thin">
        <div className="min-w-[540px] flex flex-col gap-2">
          <div className="relative h-44 sm:h-48 w-full">
            <svg viewBox="0 0 600 130" preserveAspectRatio="none" className="h-full w-full" role="img">
              <line x1="15" y1="70" x2="585" y2="70" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1.5" />
              <path d={areaD} fill="var(--primary)" opacity="0.18" />
              <path d={pathD} fill="none" stroke="var(--positive)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

              {points.map((p, i) => {
                const isHovered = activeIdx === i
                return (
                  <g
                    key={p.label + i}
                    className="cursor-pointer"
                    onMouseEnter={() => setActiveIdx(i)}
                    onMouseLeave={() => setActiveIdx(null)}
                  >
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? "6" : "4"}
                      fill="var(--card)"
                      stroke={p.net >= 0 ? "var(--positive)" : "var(--destructive)"}
                      strokeWidth={isHovered ? "3" : "2"}
                      className="transition-all duration-200"
                    />
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="grid grid-cols-12 text-center text-xs font-semibold text-muted-foreground pt-1">
            {data.map((d, i) => (
              <span
                key={d.label + i}
                className={`cursor-pointer transition-colors ${activeIdx === i ? "text-foreground font-bold" : ""}`}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
              >
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 min-h-[22px] flex items-center justify-center text-xs">
        {activePoint ? (
          <div className="flex items-center gap-2 bg-secondary px-3 py-1 rounded-full font-semibold">
            <span>{activePoint.label}:</span>
            <span className={activePoint.net >= 0 ? "text-positive" : "text-destructive"}>
              {activePoint.net >= 0 ? "+" : ""}${activePoint.net.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">Pasa el cursor por los puntos para ver el balance</span>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ExpenseCategoryProgressChart — Progress bars list of expenses
// ─────────────────────────────────────────────────────────────────────────────

export function ExpenseCategoryProgressChart({ transactions }: { transactions: Tx[] }) {
  const byCategory = new Map<string, number>()
  for (const t of transactions.filter((t) => t.type === "expense")) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
  }

  const entries = [...byCategory.entries()].sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, v]) => s + v, 0)
  const maxVal = entries[0]?.[1] || 1

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <h2 className="text-sm font-bold text-foreground sm:text-base">Top Categorías de Gasto</h2>
      <p className="text-xs text-muted-foreground mb-4">Desglose ordenado por mayor volumen</p>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No hay gastos registrados aún.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map(([cat, amount], i) => {
            const pct = total > 0 ? (amount / total) * 100 : 0
            const barPct = (amount / maxVal) * 100
            const color = PALETTE[i % PALETTE.length]

            return (
              <div key={cat} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-foreground">{cat}</span>
                  <span className="text-muted-foreground">
                    ${amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })} ({pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barPct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. FinancialOverviewRatioChart — Income vs Expense Ratio
// ─────────────────────────────────────────────────────────────────────────────

export function FinancialOverviewRatioChart({ income, expenses }: { income: number; expenses: number }) {
  const total = income + expenses
  const savings = Math.max(0, income - expenses)

  if (total === 0) {
    return (
      <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
        <h2 className="text-sm font-bold text-foreground sm:text-base">Ratio de Capacidad de Ahorro</h2>
        <p className="text-xs text-muted-foreground text-center py-6">Sin datos de ingresos/gastos.</p>
      </section>
    )
  }

  const savingsPct = income > 0 ? (savings / income) * 100 : 0
  const expensePct = income > 0 ? (expenses / income) * 100 : 100

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <h2 className="text-sm font-bold text-foreground sm:text-base">Ratio de Ahorro vs Gastos</h2>
      <p className="text-xs text-muted-foreground mb-4">Porcentaje de ingresos destinados a gastos vs ahorro</p>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1 w-full flex flex-col gap-3">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-destructive">Gastos: {expensePct.toFixed(1)}%</span>
            <span className="text-positive">Ahorro: {savingsPct.toFixed(1)}%</span>
          </div>
          <div className="h-4 w-full rounded-full bg-secondary overflow-hidden flex">
            <div className="h-full bg-destructive transition-all duration-500" style={{ width: `${Math.min(100, expensePct)}%` }} />
            <div className="h-full bg-positive transition-all duration-500" style={{ width: `${Math.max(0, savingsPct)}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-center">
              <p className="text-[10px] text-muted-foreground font-medium">Total Gastado</p>
              <p className="text-xs font-bold text-destructive">${expenses.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-positive/10 text-center">
              <p className="text-[10px] text-muted-foreground font-medium">Ahorro Generado</p>
              <p className="text-xs font-bold text-positive">${savings.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
