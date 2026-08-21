"use client"

import { useState, useMemo, useEffect } from "react"
import type { Summary, Tx } from "@/app/actions"
import { isInvestmentTx } from "@/lib/finance"
import { Calendar, ChevronDown } from "lucide-react"

const PALETTE = [
  "#c4e538", "#2fa971", "#16362a", "#6f7d72",
  "#e5484d", "#60a5fa", "#f97316", "#a78bfa",
  "#34d399", "#fbbf24", "#f43f5e", "#0ea5e9"
]

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

import { polarToCartesian, arcPath } from "@/lib/format"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

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
    data.push({ label: MONTH_LABELS[m], income: inc, expense: exp, net: inc - exp })
  }
  return data
}

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
        <label htmlFor="year-selector-select" className="sr-only">Seleccionar año</label>
        <select
          id="year-selector-select"
          name="year-selector-select"
          value={selectedYear}
          onChange={(e) => handleYearChange(Number(e.target.value))}
          aria-label="Seleccionar año"
          title="Seleccionar año"
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
  const maxIncome = Math.max(1, ...monthly.map((m) => m.income ?? Math.max(0, m.net)))

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">Ingresos del Año {year ? `(${year})` : ""}</h2>
          <p className="text-xs text-muted-foreground">Enero a Diciembre</p>
        </div>
        {hoveredIdx !== null && (
          <div className="text-xs font-semibold text-positive bg-positive/10 px-3 py-1 rounded-full self-start sm:self-auto">
            {monthly[hoveredIdx].label}: +${(monthly[hoveredIdx].income ?? Math.max(0, monthly[hoveredIdx].net)).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto pb-2 scrollbar-thin">
        <div className="w-[600px] sm:w-full flex flex-col gap-2">
          <div className="relative h-48 w-full">
            <svg viewBox="0 0 600 170" className="h-full w-full overflow-visible" role="img" aria-label="Gráfico de ingresos mensuales" aria-labelledby="income-chart-title">
              <title id="income-chart-title">Gráfico de ingresos mensuales</title>
              <line x1="0" y1="20" x2="600" y2="20" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="80" x2="600" y2="80" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="140" x2="600" y2="140" stroke="var(--border)" strokeWidth="1.5" />

              {monthly.map((m, i) => {
                const groupW = 600 / monthly.length
                const barW = 16
                const x = i * groupW + (groupW - barW) / 2
                const groupCenterX = i * groupW + groupW / 2
                const monthInc = m.income ?? Math.max(0, m.net)
                const barHeight = (monthInc / maxIncome) * 115
                const isHovered = hoveredIdx === i

                return (
                  <g
                    key={m.key}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <rect x={i * groupW} y="0" width={groupW} height="170" fill="var(--primary)" opacity={isHovered ? "0.08" : "0"} rx="4" />
                    <rect
                      x={x}
                      y={140 - barHeight}
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
          <svg viewBox="0 0 200 200" className="h-36 w-36 sm:h-44 sm:w-44" role="img" aria-label="Gráfico de distribución por fuente de ingreso" aria-labelledby="income-sources-chart-title">
            <title id="income-sources-chart-title">Distribución por fuente de ingreso</title>
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
          <svg viewBox="0 0 200 200" className="h-36 w-36 sm:h-44 sm:w-44" role="img" aria-label="Gráfico de gastos por categoría" aria-labelledby="expense-categories-chart-title">
            <title id="expense-categories-chart-title">Gastos por categoría</title>
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
            const isInvestment = /invers/i.test(s.cat)
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
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground flex items-center gap-1.5">
                  {s.cat}
                  {isInvestment && (
                    <span className="rounded-full bg-positive/10 border border-positive/30 px-1.5 py-0.5 text-[9px] font-bold text-positive shrink-0">
                      💼 Ahorro/Activo
                    </span>
                  )}
                </span>
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
      <p className="mt-3 text-[11px] text-muted-foreground font-medium flex items-center gap-1 border-t border-border/40 pt-2">
        💡 <strong className="text-foreground">Opción A:</strong> Las inversiones computan como acumulación de patrimonio y ahorro, no como consumo de dinero.
      </p>
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
        <div className="w-[600px] sm:w-full flex flex-col gap-2">
          <div className="relative h-48 w-full">
            <svg viewBox="0 0 600 170" className="h-full w-full overflow-visible" role="img" aria-label="Gráfico de barras de gastos por mes" aria-labelledby="monthly-expense-bar-title">
              <title id="monthly-expense-bar-title">Gastos por mes</title>
              <line x1="0" y1="20" x2="600" y2="20" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="80" x2="600" y2="80" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="140" x2="600" y2="140" stroke="var(--border)" strokeWidth="1.5" />

              {monthlyData.map((m, i) => {
                const groupW = 600 / monthlyData.length
                const barW = 18
                const x = i * groupW + (groupW - barW) / 2
                const groupCenterX = i * groupW + groupW / 2
                const barHeight = (m.expense / maxExpense) * 115
                const isHovered = hoveredIdx === i

                return (
                  <g
                    key={m.label + i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <rect x={i * groupW} y="0" width={groupW} height="170" fill="var(--primary)" opacity={isHovered ? "0.08" : "0"} rx="4" />
                    <rect
                      x={x}
                      y={140 - barHeight}
                      width={barW}
                      height={Math.max(2, barHeight)}
                      rx="4"
                      fill="var(--destructive)"
                      opacity={isHovered ? "1" : "0.85"}
                      className="transition-all duration-200"
                    />
                    <text
                      x={groupCenterX}
                      y="162"
                      textAnchor="middle"
                      className={`text-[12px] font-semibold transition-colors ${isHovered ? "fill-foreground font-bold" : "fill-muted-foreground"}`}
                      style={{ fontSize: "12px" }}
                    >
                      {m.label}
                    </text>
                  </g>
                )
              })}
            </svg>
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
        <div className="w-[600px] sm:w-full flex flex-col gap-2">
          <div className="relative h-48 w-full">
            <svg viewBox="0 0 600 170" className="h-full w-full overflow-visible" role="img" aria-label="Gráfico comparativo de ingresos versus gastos" aria-labelledby="monthly-comp-chart-title">
              <title id="monthly-comp-chart-title">Comparativa de ingresos versus gastos</title>
              <line x1="0" y1="20" x2="600" y2="20" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="80" x2="600" y2="80" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="140" x2="600" y2="140" stroke="var(--border)" strokeWidth="1.5" />

              {months.map((m, i) => {
                const groupW = 600 / months.length
                const barW = 10
                const xInc = i * groupW + (groupW - (barW * 2 + 2)) / 2
                const xExp = xInc + barW + 2
                const groupCenterX = i * groupW + groupW / 2

                const hInc = (m.income / maxVal) * 115
                const hExp = (m.expense / maxVal) * 115
                const isHovered = hoveredIdx === i

                return (
                  <g
                    key={m.label + i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <rect x={i * groupW} y="0" width={groupW} height="170" fill="var(--primary)" opacity={isHovered ? "0.08" : "0"} rx="3" />
                    <rect x={xInc} y={140 - hInc} width={barW} height={Math.max(2, hInc)} rx="2" fill="var(--positive)" opacity={isHovered ? "1" : "0.85"} />
                    <rect x={xExp} y={140 - hExp} width={barW} height={Math.max(2, hExp)} rx="2" fill="var(--destructive)" opacity={isHovered ? "1" : "0.85"} />
                    <text
                      x={groupCenterX}
                      y="162"
                      textAnchor="middle"
                      className={`text-[12px] font-semibold transition-colors ${isHovered ? "fill-foreground font-bold" : "fill-muted-foreground"}`}
                      style={{ fontSize: "12px" }}
                    >
                      {m.label}
                    </text>
                  </g>
                )
              })}
            </svg>
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
        <div className="w-[600px] sm:w-full flex flex-col gap-2">
          <div className="relative h-48 w-full">
            <svg viewBox="0 0 600 160" className="h-full w-full overflow-visible" role="img" aria-label="Gráfico de tendencia de ahorro neto mensual" aria-labelledby="net-savings-chart-title">
              <title id="net-savings-chart-title">Tendencia de ahorro neto mensual</title>
              <line x1="25" y1="70" x2="575" y2="70" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1.5" />
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
                    <text
                      x={p.x}
                      y="150"
                      textAnchor="middle"
                      className={`text-[12px] font-semibold transition-colors ${isHovered ? "fill-foreground font-bold" : "fill-muted-foreground"}`}
                      style={{ fontSize: "12px" }}
                    >
                      {p.label}
                    </text>
                  </g>
                )
              })}
            </svg>
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

// ─────────────────────────────────────────────────────────────────────────────
// 9. MoneyFlowSankeyChart — Interactive Sankey Flow of Income -> Pool -> Expenses/Savings
// ─────────────────────────────────────────────────────────────────────────────

function layoutSankeyNodes(
  entries: [string, number][],
  totalVal: number,
  x: number,
  usableH: number,
  topY: number,
  colorOffset: number,
  prefix: string = "node"
) {
  const count = entries.length
  if (count === 0) return []

  const gap = 8
  const totalGaps = (count - 1) * gap
  const netH = Math.max(20, usableH - totalGaps)

  const rawHeights = entries.map(([, val]) => Math.max(14, (val / (totalVal || 1)) * netH))
  const rawSum = rawHeights.reduce((s, h) => s + h, 0)

  const scale = rawSum > netH ? netH / rawSum : 1
  const finalHeights = rawHeights.map((h) => h * scale)

  let currY = topY
  return entries.map(([cat, val], i) => {
    const h = finalHeights[i]
    const y = currY
    currY += h + gap
    return {
      id: `${prefix}-${cat}-${i}`,
      label: cat,
      value: val,
      x,
      y,
      height: h,
      color: PALETTE[(i + colorOffset) % PALETTE.length],
    }
  })
}

export function MoneyFlowSankeyChart({ transactions }: { transactions: Tx[] }) {
  const [hoveredFlow, setHoveredFlow] = useState<string | null>(null)

  const incomeMap = new Map<string, number>()
  const expenseMap = new Map<string, number>()

  for (const t of transactions) {
    if (t.type === "income") {
      incomeMap.set(t.category, (incomeMap.get(t.category) ?? 0) + t.amount)
    } else {
      expenseMap.set(t.category, (expenseMap.get(t.category) ?? 0) + t.amount)
    }
  }

  const incomeEntries = [...incomeMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const expenseEntries = [...expenseMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  const totalIncome = incomeEntries.reduce((s, [, v]) => s + v, 0)
  const totalExpense = expenseEntries.reduce((s, [, v]) => s + v, 0)
  const netSavings = Math.max(0, totalIncome - totalExpense)

  if (totalIncome === 0 && totalExpense === 0) {
    return (
      <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
        <h2 className="text-sm font-bold text-foreground sm:text-base">Diagrama de Flujo de Dinero (Sankey)</h2>
        <p className="text-xs text-muted-foreground text-center py-6">Sin datos suficientes para trazar el flujo.</p>
      </section>
    )
  }

  const width = 960
  const height = 340
  const topY = 32
  const usableH = 270

  const leftX = 230
  const middleX = 480
  const rightX = 730
  const nodeWidth = 8

  const leftNodes = layoutSankeyNodes(incomeEntries, totalIncome, leftX, usableH, topY, 2, "inc")

  const rightRawEntries = [...expenseEntries]
  if (netSavings > 0) {
    rightRawEntries.push(["Ahorro Neto", netSavings])
  }
  const rightTotalPool = totalExpense + netSavings

  const rightNodes = layoutSankeyNodes(rightRawEntries, rightTotalPool, rightX, usableH, topY, 0, "exp")

  const poolH = usableH
  const poolY = topY
  const poolNode = { id: "pool", label: "Presupuesto", value: totalIncome, x: middleX, y: poolY, height: poolH, color: "var(--primary)" }

  let incomeCumY = poolY
  const dxLeft = middleX - (leftX + nodeWidth)
  const leftRibbons = leftNodes.map((node) => {
    const ribbonH = (node.value / (totalIncome || 1)) * poolH
    const yLeft1 = node.y
    const yLeft2 = node.y + node.height
    const yMid1 = incomeCumY
    const yMid2 = incomeCumY + ribbonH

    const c1X = leftX + nodeWidth + dxLeft * 0.45
    const c2X = middleX - dxLeft * 0.45

    const path = `M ${leftX + nodeWidth} ${yLeft1}
                 C ${c1X} ${yLeft1}, ${c2X} ${yMid1}, ${middleX} ${yMid1}
                 L ${middleX} ${yMid2}
                 C ${c2X} ${yMid2}, ${c1X} ${yLeft2}, ${leftX + nodeWidth} ${yLeft2} Z`

    incomeCumY += ribbonH
    return { id: `flow-${node.id}`, label: node.label, type: "Ingreso", path, color: node.color, value: node.value }
  })

  let expenseCumY = poolY
  const dxRight = rightX - (middleX + nodeWidth)
  const rightRibbons = rightNodes.map((node) => {
    const ribbonH = (node.value / (rightTotalPool || 1)) * poolH
    const yMid1 = expenseCumY
    const yMid2 = expenseCumY + ribbonH
    const yRight1 = node.y
    const yRight2 = node.y + node.height

    const c1X = middleX + nodeWidth + dxRight * 0.45
    const c2X = rightX - dxRight * 0.45

    const path = `M ${middleX + nodeWidth} ${yMid1}
                 C ${c1X} ${yMid1}, ${c2X} ${yRight1}, ${rightX} ${yRight1}
                 L ${rightX} ${yRight2}
                 C ${c2X} ${yRight2}, ${c1X} ${yMid2}, ${middleX + nodeWidth} ${yMid2} Z`

    expenseCumY += ribbonH
    return { id: `flow-${node.id}`, label: node.label, type: "Destino", path, color: node.color, value: node.value }
  })

  const activeInfo = hoveredFlow
    ? [...leftRibbons, ...rightRibbons].find((r) => r.id === hoveredFlow)
    : null

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">Diagrama de Flujo de Dinero (Sankey)</h2>
          <p className="text-xs text-muted-foreground">Origen de Ingresos → Caja Central → Destino de Gastos y Ahorro</p>
        </div>
        {activeInfo && (
          <div className="text-xs font-semibold bg-secondary px-3 py-1 rounded-full text-foreground self-start sm:self-auto">
            {activeInfo.type}: {activeInfo.label}: +${activeInfo.value.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
          </div>
        )}
      </div>

      <div className="mt-4 w-full overflow-x-auto pb-2 scrollbar-thin">
        <div className="w-full min-w-[650px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Diagrama de flujo de dinero" aria-labelledby="sankey-money-flow-title">
            <title id="sankey-money-flow-title">Diagrama de flujo de dinero</title>
            {[...leftRibbons, ...rightRibbons].map((r) => {
              const isHovered = hoveredFlow === r.id
              return (
                <path
                  key={r.id}
                  d={r.path}
                  fill={r.color}
                  opacity={hoveredFlow === null || isHovered ? "0.55" : "0.15"}
                  className="cursor-pointer transition-all duration-200 hover:opacity-85"
                  onMouseEnter={() => setHoveredFlow(r.id)}
                  onMouseLeave={() => setHoveredFlow(null)}
                />
              )
            })}

            {leftNodes.map((n) => {
              const displayLabel = n.label.length > 20 ? `${n.label.slice(0, 18)}…` : n.label
              return (
                <g key={n.id}>
                  <rect x={n.x} y={n.y} width={nodeWidth} height={n.height} rx="4" fill={n.color} />
                  <text x={n.x - 10} y={n.y + Math.max(10, n.height / 2 + 4)} textAnchor="end" className="fill-foreground text-[11px] font-semibold">
                    {displayLabel} (${(n.value).toLocaleString("es-ES", { maximumFractionDigits: 0 })})
                  </text>
                </g>
              )
            })}

            <g key={poolNode.id}>
              <rect x={poolNode.x} y={poolNode.y} width={nodeWidth} height={poolNode.height} rx="4" fill="var(--primary)" opacity="0.9" />
              <text x={poolNode.x + nodeWidth / 2} y={poolNode.y - 10} textAnchor="middle" className="fill-foreground text-[11px] font-bold">
                Fondo (${totalIncome.toLocaleString("es-ES", { maximumFractionDigits: 0 })})
              </text>
            </g>

            {rightNodes.map((n) => {
              const displayLabel = n.label.length > 20 ? `${n.label.slice(0, 18)}…` : n.label
              return (
                <g key={n.id}>
                  <rect x={n.x} y={n.y} width={nodeWidth} height={n.height} rx="4" fill={n.color} />
                  <text x={n.x + nodeWidth + 10} y={n.y + Math.max(10, n.height / 2 + 4)} textAnchor="start" className="fill-foreground text-[11px] font-semibold">
                    {displayLabel} (${(n.value).toLocaleString("es-ES", { maximumFractionDigits: 0 })})
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. YearOverYearComparisonChart — Year vs Previous Year Comparison
// ─────────────────────────────────────────────────────────────────────────────

export function YearOverYearComparisonChart({
  transactions,
  selectedYear = 2026,
}: {
  transactions: Tx[]
  selectedYear?: number
}) {
  const [yearA, setYearA] = useState<number>(selectedYear)
  const [yearB, setYearB] = useState<number>(selectedYear - 1)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Calculate all unique years with data + current and prior years
  const availableYears: number[] = useMemo(() => {
    const set = new Set<number>([selectedYear, selectedYear - 1, 2026, 2025, 2024])
    for (const t of transactions) {
      const y = new Date(t.occurredAt).getFullYear()
      if (!isNaN(y)) set.add(y)
    }
    return Array.from(set).sort((a, b) => b - a)
  }, [transactions, selectedYear])

  // Sync yearA when selectedYear prop changes from outer page
  useEffect(() => {
    setYearA(selectedYear)
    const prior = availableYears.find((y: number) => y < selectedYear)
    setYearB(prior !== undefined ? prior : selectedYear - 1)
  }, [selectedYear, availableYears])

  const yearAData = getYearMonthsData(transactions, yearA)
  const yearBData = getYearMonthsData(transactions, yearB)

  const maxExpense = Math.max(
    1,
    ...yearAData.map((m) => m.expense),
    ...yearBData.map((m) => m.expense)
  )

  const totalA = yearAData.reduce((s, m) => s + m.expense, 0)
  const totalB = yearBData.reduce((s, m) => s + m.expense, 0)
  const diffPct = totalB > 0 ? ((totalA - totalB) / totalB) * 100 : 0

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">
            Comparativa Interanual ({yearA} vs {yearB})
          </h2>
          <p className="text-xs text-muted-foreground">
            Evolución del gasto mensual comparando dos ejercicios seleccionables
          </p>
        </div>

        {/* Dynamic Year Selectors */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Year A (Base) */}
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
            <label htmlFor="yoy-year-a-select" className="sr-only">
              Año principal
            </label>
            <select
              id="yoy-year-a-select"
              name="yoy-year-a-select"
              value={yearA}
              onChange={(e) => setYearA(Number(e.target.value))}
              aria-label="Seleccionar año base principal"
              title="Año base principal"
              className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer text-xs"
            >
              {availableYears.map((y: number) => (
                <option key={`a-${y}`} value={y} className="bg-card text-foreground">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs font-black text-muted-foreground">vs</span>

          {/* Year B (Comparison) */}
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60 shrink-0" aria-hidden="true" />
            <label htmlFor="yoy-year-b-select" className="sr-only">
              Año a comparar
            </label>
            <select
              id="yoy-year-b-select"
              name="yoy-year-b-select"
              value={yearB}
              onChange={(e) => setYearB(Number(e.target.value))}
              aria-label="Seleccionar año para comparar"
              title="Año para comparar"
              className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer text-xs"
            >
              {availableYears.map((y: number) => (
                <option key={`b-${y}`} value={y} className="bg-card text-foreground">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-2 scrollbar-thin">
        <div className="w-[600px] sm:w-full flex flex-col gap-2">
          <div className="relative h-48 w-full">
            <svg
              viewBox="0 0 600 170"
              className="h-full w-full overflow-visible"
              role="img"
              aria-label={`Gráfico comparativo interanual de ${yearA} frente a ${yearB}`}
              aria-labelledby="yoy-comp-chart-title"
            >
              <title id="yoy-comp-chart-title">{`Comparativa interanual ${yearA} vs ${yearB}`}</title>
              <line x1="0" y1="20" x2="600" y2="20" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="80" x2="600" y2="80" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="140" x2="600" y2="140" stroke="var(--border)" strokeWidth="1.5" />

              {yearAData.map((mCurr, i) => {
                const mPrev = yearBData[i] || { expense: 0 }
                const groupW = 600 / yearAData.length
                const barW = 9
                const xCurr = i * groupW + (groupW - (barW * 2 + 2)) / 2
                const xPrev = xCurr + barW + 2
                const groupCenterX = i * groupW + groupW / 2

                const hCurr = (mCurr.expense / maxExpense) * 115
                const hPrev = (mPrev.expense / maxExpense) * 115
                const isHovered = hoveredIdx === i

                return (
                  <g
                    key={mCurr.label + i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <rect x={i * groupW} y="0" width={groupW} height="170" fill="var(--primary)" opacity={isHovered ? "0.08" : "0"} rx="3" />
                    <rect x={xCurr} y={140 - hCurr} width={barW} height={Math.max(2, hCurr)} rx="2" fill="var(--primary)" opacity={isHovered ? "1" : "0.9"} />
                    <rect x={xPrev} y={140 - hPrev} width={barW} height={Math.max(2, hPrev)} rx="2" fill="var(--muted-foreground)" opacity={isHovered ? "0.7" : "0.35"} />
                    <text
                      x={groupCenterX}
                      y="162"
                      textAnchor="middle"
                      className={`text-[12px] font-semibold transition-colors ${isHovered ? "fill-foreground font-bold" : "fill-muted-foreground"}`}
                      style={{ fontSize: "12px" }}
                    >
                      {mCurr.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-2 min-h-[22px] flex items-center justify-between text-xs pt-1 border-t border-border/40">
        {hoveredIdx !== null ? (
          <div className="flex items-center gap-3 bg-secondary/80 px-3 py-1 rounded-full font-medium w-full justify-center">
            <span className="font-bold text-foreground">{yearAData[hoveredIdx].label}:</span>
            <span className="text-foreground">
              {yearA}: ${yearAData[hoveredIdx].expense.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-muted-foreground">
              {yearB}: ${yearBData[hoveredIdx].expense.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full text-muted-foreground text-[11px] flex-wrap gap-2">
            <span>
              Total {yearA}: <strong className="text-foreground">${totalA.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong>
              {" · "}
              Total {yearB}: <strong className="text-foreground">${totalB.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong>
            </span>
            <span>
              Variación:{" "}
              <strong className={diffPct <= 0 ? "text-positive" : "text-destructive"}>
                {diffPct <= 0 ? "" : "+"}
                {diffPct.toFixed(1)}% vs {yearB}
              </strong>
            </span>
          </div>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. InvestmentCategoryChart — Donut Chart for Investment Allocation
// ─────────────────────────────────────────────────────────────────────────────

export function InvestmentCategoryChart({ transactions, selectedYear }: { transactions: Tx[]; selectedYear?: number }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const invTxs = transactions.filter((t) => {
    if (!isInvestmentTx(t)) return false
    if (selectedYear !== undefined) {
      const d = new Date(t.occurredAt)
      return d.getFullYear() === selectedYear || d.getUTCFullYear() === selectedYear
    }
    return true
  })

  const byCategory = new Map<string, number>()
  for (const t of invTxs) {
    const cat = t.category.toLowerCase().includes("invers") || t.category === "General" ? t.name || t.category : t.category
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + t.amount)
  }

  const entries = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const total = entries.reduce((s, [, v]) => s + v, 0)

  if (total === 0) {
    return (
      <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
        <h2 className="text-sm font-bold text-foreground sm:text-base">Distribución por Tipo de Activo</h2>
        <p className="mt-6 mb-4 text-center text-sm text-muted-foreground">Sin movimientos de inversión registrados aún.</p>
      </section>
    )
  }

  let currentAngle = 0
  const slices = entries.map(([cat, amount], i) => {
    const deg = (amount / total) * 360
    const path = arcPath(100, 100, 80, currentAngle, currentAngle + deg - 0.5)
    currentAngle += deg
    return { cat, amount, path, color: PALETTE[(i + 1) % PALETTE.length] }
  })

  const activeSlice = activeCategory ? slices.find((s) => s.cat === activeCategory) : null

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <h2 className="text-sm font-bold text-foreground sm:text-base">Distribución por Tipo de Activo</h2>

      <div className="mt-4 flex flex-col md:flex-row items-center gap-6">
        <div className="relative shrink-0 flex justify-center items-center">
          <svg viewBox="0 0 200 200" className="h-36 w-36 sm:h-44 sm:w-44" role="img" aria-label="Gráfico de distribución por tipo de activo" aria-labelledby="investment-cat-chart-title">
            <title id="investment-cat-chart-title">Distribución por tipo de activo</title>
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
              {activeSlice ? activeSlice.cat : "Total Invertido"}
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
// 15. InvestmentMonthlyBarChart — Monthly Investment Progress
// ─────────────────────────────────────────────────────────────────────────────

export function InvestmentMonthlyBarChart({ transactions, selectedYear }: { transactions: Tx[]; selectedYear: number }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const invTxs = transactions.filter((t) => {
    const td = new Date(t.occurredAt)
    const isYearMatch = td.getFullYear() === selectedYear || td.getUTCFullYear() === selectedYear
    return isYearMatch && isInvestmentTx(t)
  })

  const monthlyData: { label: string; amount: number }[] = []
  for (let m = 0; m < 12; m++) {
    let amt = 0
    for (const t of invTxs) {
      const td = new Date(t.occurredAt)
      if (td.getMonth() === m) amt += t.amount
    }
    monthlyData.push({ label: MONTH_LABELS[m], amount: amt })
  }

  const maxVal = Math.max(1, ...monthlyData.map((m) => m.amount))

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">Inversión Mensual ({selectedYear})</h2>
          <p className="text-xs text-muted-foreground">Aportaciones de patrimonio de Enero a Diciembre</p>
        </div>
        {hoveredIdx !== null && (
          <div className="text-xs font-semibold text-positive bg-positive/10 px-3 py-1 rounded-full self-start sm:self-auto">
            {monthlyData[hoveredIdx].label}: +${monthlyData[hoveredIdx].amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto pb-2 scrollbar-thin">
        <div className="w-[600px] sm:w-full flex flex-col gap-2">
          <div className="relative h-48 w-full">
            <svg viewBox="0 0 600 170" className="h-full w-full overflow-visible" role="img" aria-label="Gráfico de inversión mensual" aria-labelledby="investment-monthly-bar-title">
              <title id="investment-monthly-bar-title">Inversión mensual</title>
              <line x1="0" y1="20" x2="600" y2="20" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="80" x2="600" y2="80" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
              <line x1="0" y1="140" x2="600" y2="140" stroke="var(--border)" strokeWidth="1.5" />

              {monthlyData.map((m, i) => {
                const groupW = 600 / monthlyData.length
                const barW = 18
                const x = i * groupW + (groupW - barW) / 2
                const groupCenterX = i * groupW + groupW / 2
                const barHeight = (m.amount / maxVal) * 115
                const isHovered = hoveredIdx === i

                return (
                  <g
                    key={m.label + i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <rect x={i * groupW} y="0" width={groupW} height="170" fill="var(--primary)" opacity={isHovered ? "0.08" : "0"} rx="4" />
                    <rect
                      x={x}
                      y={140 - barHeight}
                      width={barW}
                      height={Math.max(2, barHeight)}
                      rx="4"
                      fill="#2fa971"
                      opacity={isHovered ? "1" : "0.85"}
                      className="transition-all duration-200"
                    />
                    <text
                      x={groupCenterX}
                      y="162"
                      textAnchor="middle"
                      className={`text-[12px] font-semibold transition-colors ${isHovered ? "fill-foreground font-bold" : "fill-muted-foreground"}`}
                      style={{ fontSize: "12px" }}
                    >
                      {m.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}
