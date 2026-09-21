"use client"

import { useState, useMemo, useEffect } from "react"
import type { Summary, Tx } from "@/app/actions"
import { isInvestmentTx } from "@/lib/finance"
import { fmtCurrency, fmtSignedCurrency, fmtNumber } from "@/lib/format"
import { useCurrency } from "@/components/finance/use-currency"
import { Calendar, ChevronDown } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

// Visx imports
import { Pie, LinePath, AreaClosed, Bar, Line } from "@visx/shape"
import { Group } from "@visx/group"
import { curveMonotoneX } from "@visx/curve"
import { LinearGradient } from "@visx/gradient"
import { scaleBand, scaleLinear } from "@visx/scale"

// Sleek Getquin fintech color palette
const GETQUIN_PALETTE = [
  "#3b82f6", // Royal Blue
  "#10b981", // Emerald Green
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#84cc16", // Lime
]

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

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
// YearSelector — Getquin styled pill
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
    document.cookie = `finflow_selected_year=${year}; path=/; max-age=31536000; SameSite=Lax`
    try {
      localStorage.setItem("finflow_selected_year", year.toString())
    } catch {}
    const params = new URLSearchParams(searchParams.toString())
    params.set("year", year.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  useEffect(() => {
    if (selectedYear) {
      document.cookie = `finflow_selected_year=${selectedYear}; path=/; max-age=31536000; SameSite=Lax`
      try {
        localStorage.setItem("finflow_selected_year", selectedYear.toString())
      } catch {}
    }
  }, [selectedYear])

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "finflow_selected_year" && e.newValue) {
        const newY = Number(e.newValue)
        if (newY && newY !== selectedYear && availableYears.includes(newY)) {
          const params = new URLSearchParams(searchParams.toString())
          params.set("year", newY.toString())
          router.push(`${pathname}?${params.toString()}`)
        }
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [selectedYear, availableYears, pathname, router, searchParams])

  return (
    <div className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 shadow-xs transition-colors hover:border-border/80">
      <Calendar className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
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
          className="cursor-pointer appearance-none bg-transparent pr-4 text-xs font-bold text-foreground outline-none text-center leading-none"
        >
          {availableYears.map((y) => (
            <option key={y} value={y} className="bg-card text-foreground font-semibold">
              {y}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  )
}

// ─── Shared Visx Chart Subcomponents (Reusable & DRY) ─────────────────────────

interface DonutSlice {
  label: string
  amount: number
  color: string
}

function DonutAllocationChart({
  title,
  subtitle,
  emptyTitle,
  emptyMessage,
  slices,
  total,
  centerLabel = "Total",
  valueColor = "text-foreground",
  centerValueColor = "#10b981",
  sign = "+",
  showSavingsBadge = false,
  currencySymbol,
}: {
  title: string
  subtitle: string
  emptyTitle: string
  emptyMessage: string
  slices: DonutSlice[]
  total: number
  centerLabel?: string
  valueColor?: string
  centerValueColor?: string
  sign?: "+" | "-" | ""
  showSavingsBadge?: boolean
  currencySymbol?: string
}) {
  const { symbol: resolvedSym } = useCurrency(currencySymbol)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  if (total === 0) {
    return (
      <section className="rounded-2xl bg-card p-4 sm:p-5 shadow-xs border border-border">
        <h2 className="text-sm font-bold text-foreground sm:text-base">{emptyTitle}</h2>
        <p className="mt-6 mb-4 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      </section>
    )
  }

  const activeSlice = activeCategory ? slices.find((s) => s.label === activeCategory) : null
  const displayAmount = activeSlice ? activeSlice.amount : total

  return (
    <section className="rounded-2xl bg-card p-4 sm:p-5 shadow-xs border border-border transition-colors hover:border-border/80">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted dark:bg-[#20222a] text-muted-foreground border border-border/50">
          Allocation
        </span>
      </div>

      <div className="mt-4 flex flex-col md:flex-row items-center gap-6">
        <div className="relative shrink-0 flex justify-center items-center">
          <svg width={180} height={180} viewBox="0 0 180 180" className="overflow-visible">
            <Group top={90} left={90}>
              <Pie
                data={slices}
                pieValue={(d) => d.amount}
                outerRadius={80}
                innerRadius={56}
                padAngle={0.03}
                cornerRadius={4}
              >
                {(pie) =>
                  pie.arcs.map((arc, i) => {
                    const isHovered = activeCategory === arc.data.label
                    return (
                      <path
                        key={`arc-${i}`}
                        d={pie.path(arc) ?? ""}
                        fill={arc.data.color}
                        opacity={activeCategory === null || isHovered ? 1 : 0.35}
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setActiveCategory(arc.data.label)}
                        onMouseLeave={() => setActiveCategory(null)}
                      />
                    )
                  })
                }
              </Pie>
              <text x={0} y={-8} textAnchor="middle" fill="currentColor" fontSize={10} fontWeight={700} className="fill-muted-foreground uppercase tracking-wider">
                {activeSlice ? activeSlice.label : centerLabel}
              </text>
              <text x={0} y={14} textAnchor="middle" fill={centerValueColor} fontSize={16} fontWeight={800} className="tabular-nums font-bold">
                {sign === "-" ? fmtCurrency(-displayAmount, resolvedSym, 0, 0) : sign === "+" ? fmtSignedCurrency(displayAmount, resolvedSym, 0, 0) : fmtCurrency(displayAmount, resolvedSym, 0, 0)}
              </text>
            </Group>
          </svg>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-1.5 w-full">
          {slices.map((s) => {
            const isActive = activeCategory === s.label
            const isSavings = showSavingsBadge && /invers/i.test(s.label)
            return (
              <div
                key={s.label}
                onMouseEnter={() => setActiveCategory(s.label)}
                onMouseLeave={() => setActiveCategory(null)}
                className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all ${
                  isActive ? "bg-muted dark:bg-[#20222a] border border-border" : "hover:bg-muted/50 dark:hover:bg-[#1a1b22]"
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground flex items-center gap-1.5">
                  {s.label}
                  {isSavings && (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400 shrink-0">
                      💼 Ahorro
                    </span>
                  )}
                </span>
                <span className={`text-xs font-bold ${valueColor} tabular-nums`}>
                  {sign === "-" ? fmtCurrency(-s.amount, resolvedSym, 2, 2) : fmtSignedCurrency(s.amount, resolvedSym, 2, 2)}
                </span>
                <span className="w-11 text-right text-[11px] font-semibold text-muted-foreground tabular-nums">
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

interface MonthlyBarItem {
  key?: string
  label: string
  amount: number
}

function MonthlySingleBarChart({
  title,
  subtitle,
  data,
  gradId,
  fromColor,
  toColor,
  sign = "",
  tooltipColorClass,
  currencySymbol,
}: {
  title: string
  subtitle: string
  data: MonthlyBarItem[]
  gradId: string
  fromColor: string
  toColor: string
  sign?: string
  tooltipColorClass: string
  currencySymbol?: string
}) {
  const { symbol: resolvedSym } = useCurrency(currencySymbol)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const maxVal = Math.max(1, ...data.map((d) => d.amount))

  const svgWidth = 600
  const svgHeight = 160
  const margin = { top: 15, right: 10, bottom: 25, left: 10 }
  const xMax = svgWidth - margin.left - margin.right
  const yMax = svgHeight - margin.top - margin.bottom

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, xMax],
        domain: data.map((d) => d.label),
        padding: 0.35,
      }),
    [xMax, data]
  )

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [yMax, 0],
        domain: [0, maxVal * 1.1],
      }),
    [yMax, maxVal]
  )

  return (
    <section className="rounded-2xl bg-card p-4 sm:p-5 shadow-xs border border-border transition-colors hover:border-border/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {hoveredIdx !== null && (
          <div className={`text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto tabular-nums ${tooltipColorClass}`}>
            {data[hoveredIdx].label}: {sign === "-" ? fmtCurrency(-data[hoveredIdx].amount, resolvedSym) : sign === "+" ? fmtSignedCurrency(data[hoveredIdx].amount, resolvedSym) : fmtCurrency(data[hoveredIdx].amount, resolvedSym)}
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto pb-2 scrollbar-thin">
        <div className="w-[600px] sm:w-full">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-44 w-full overflow-visible">
            <LinearGradient id={gradId} from={fromColor} to={toColor} />
            <Group left={margin.left} top={margin.top}>
              {[0, 0.5, 1].map((pct, idx) => (
                <line
                  key={idx}
                  x1={0}
                  y1={yMax * pct}
                  x2={xMax}
                  y2={yMax * pct}
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              ))}

              {data.map((m, i) => {
                const barWidth = xScale.bandwidth()
                const barX = xScale(m.label) ?? 0
                const barY = yScale(m.amount)
                const barHeight = Math.max(3, yMax - barY)
                const isHovered = hoveredIdx === i

                return (
                  <g
                    key={m.key ?? `${m.label}-${i}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <rect
                      x={barX - 4}
                      y={0}
                      width={barWidth + 8}
                      height={yMax}
                      fill={isHovered ? "rgba(255, 255, 255, 0.04)" : "transparent"}
                      rx={6}
                    />
                    <Bar
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      fill={`url(#${gradId})`}
                      rx={4}
                      opacity={isHovered ? 1 : 0.85}
                      className="transition-all duration-200"
                    />
                    <text
                      x={barX + barWidth / 2}
                      y={yMax + 18}
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
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. IncomeChart — Visx Bar & Gradient Chart (Getquin Style)
// ─────────────────────────────────────────────────────────────────────────────

export function IncomeChart({
  monthly,
  year,
  currencySymbol,
}: {
  monthly: Summary["monthly"]
  year?: number
  currencySymbol?: string
}) {
  const data = monthly.map((m) => ({
    key: m.key,
    label: m.label,
    amount: m.income ?? Math.max(0, m.net),
  }))
  return (
    <MonthlySingleBarChart
      title={`Ingresos del Año ${year ? `(${year})` : ""}`.trim()}
      subtitle="Enero a Diciembre"
      data={data}
      gradId="visx-income-bar-grad"
      fromColor="#10b981"
      toColor="#059669"
      sign="+"
      tooltipColorClass="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      currencySymbol={currencySymbol}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. IncomeCategoryChart — Visx Donut Pie (Getquin Allocation Style)
// ─────────────────────────────────────────────────────────────────────────────

export function IncomeCategoryChart({
  transactions,
  currencySymbol,
}: {
  transactions: Tx[]
  currencySymbol?: string
}) {
  const byCategory = new Map<string, number>()
  for (const t of transactions.filter((t) => t.type === "income")) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
  }
  const entries = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const total = entries.reduce((s, [, v]) => s + v, 0)
  const slices = entries.map(([cat, amount], i) => ({
    label: cat,
    amount,
    color: GETQUIN_PALETTE[(i + 1) % GETQUIN_PALETTE.length],
  }))

  return (
    <DonutAllocationChart
      title="Distribución por Fuente"
      subtitle="Ingresos agrupados por categoría"
      emptyTitle="Fuentes de Ingreso"
      emptyMessage="Sin ingresos registrados aún."
      slices={slices}
      total={total}
      centerLabel="Total Ingresos"
      centerValueColor="#10b981"
      valueColor="text-emerald-400"
      sign="+"
      currencySymbol={currencySymbol}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ExpenseChart — Visx Donut Pie (Getquin Style)
// ─────────────────────────────────────────────────────────────────────────────

export function ExpenseChart({
  transactions,
  currencySymbol,
}: {
  transactions: Tx[]
  currencySymbol?: string
}) {
  const byCategory = new Map<string, number>()
  for (const t of transactions.filter((t) => t.type === "expense")) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
  }
  const entries = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const total = entries.reduce((s, [, v]) => s + v, 0)
  const slices = entries.map(([cat, amount], i) => ({
    label: cat,
    amount,
    color: GETQUIN_PALETTE[i % GETQUIN_PALETTE.length],
  }))

  return (
    <DonutAllocationChart
      title="Gastos por Categoría"
      subtitle="Distribución de salidas de capital"
      emptyTitle="Gastos por Categoría"
      emptyMessage="Sin datos de gastos aún."
      slices={slices}
      total={total}
      centerLabel="Total Gastos"
      centerValueColor="#ef4444"
      valueColor="text-destructive font-semibold"
      sign=""
      showSavingsBadge
      currencySymbol={currencySymbol}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ExpenseMonthlyBarChart — Visx Monthly Bar Chart
// ─────────────────────────────────────────────────────────────────────────────

export function ExpenseMonthlyBarChart({
  transactions,
  selectedYear,
  currencySymbol,
}: {
  transactions: Tx[]
  selectedYear: number
  currencySymbol?: string
}) {
  const monthlyData = getYearMonthsData(transactions, selectedYear)
  const data = monthlyData.map((m) => ({ key: m.label, label: m.label, amount: m.expense }))
  return (
    <MonthlySingleBarChart
      title={`Gastos por Mes (${selectedYear})`}
      subtitle="Enero a Diciembre"
      data={data}
      gradId="visx-expense-bar-grad"
      fromColor="#f43f5e"
      toColor="#e11d48"
      sign="-"
      tooltipColorClass="text-rose-400 bg-rose-500/10 border-rose-500/20"
      currencySymbol={currencySymbol}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MonthlyComparisonChart — Visx Dual Bar Chart
// ─────────────────────────────────────────────────────────────────────────────

export function MonthlyComparisonChart({
  transactions,
  selectedYear,
  currencySymbol,
}: {
  transactions: Tx[]
  selectedYear: number
  currencySymbol?: string
}) {
  const { symbol: resolvedSym } = useCurrency(currencySymbol)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const months = getYearMonthsData(transactions, selectedYear)
  const maxVal = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]))

  const svgWidth = 600
  const svgHeight = 160
  const margin = { top: 15, right: 10, bottom: 25, left: 10 }
  const xMax = svgWidth - margin.left - margin.right
  const yMax = svgHeight - margin.top - margin.bottom

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, xMax],
        domain: months.map((m) => m.label),
        padding: 0.3,
      }),
    [xMax, months]
  )

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [yMax, 0],
        domain: [0, maxVal * 1.1],
      }),
    [yMax, maxVal]
  )

  return (
    <section className="rounded-2xl bg-card p-4 sm:p-5 shadow-xs border border-border transition-colors hover:border-border/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">Comparativa Ingresos vs Gastos ({selectedYear})</h2>
          <p className="text-xs text-muted-foreground">Flujo mensual de Enero a Diciembre</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold self-start sm:self-auto bg-card dark:bg-[#1e2027] border border-border px-3 py-1 rounded-full shadow-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-foreground">Ingresos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            <span className="text-foreground">Gastos</span>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-2 scrollbar-thin">
        <div className="w-[600px] sm:w-full">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-44 w-full overflow-visible">
            <Group left={margin.left} top={margin.top}>
              {[0, 0.5, 1].map((pct, idx) => (
                <line
                  key={idx}
                  x1={0}
                  y1={yMax * pct}
                  x2={xMax}
                  y2={yMax * pct}
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              ))}

              {months.map((m, i) => {
                const groupWidth = xScale.bandwidth()
                const groupX = xScale(m.label) ?? 0
                const singleBarW = Math.max(4, (groupWidth - 3) / 2)
                const isHovered = hoveredIdx === i

                const yInc = yScale(m.income)
                const hInc = Math.max(2, yMax - yInc)

                const yExp = yScale(m.expense)
                const hExp = Math.max(2, yMax - yExp)

                return (
                  <g
                    key={m.label + i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <rect
                      x={groupX - 3}
                      y={0}
                      width={groupWidth + 6}
                      height={yMax}
                      fill={isHovered ? "rgba(255, 255, 255, 0.04)" : "transparent"}
                      rx={6}
                    />
                    {/* Income bar */}
                    <Bar
                      x={groupX}
                      y={yInc}
                      width={singleBarW}
                      height={hInc}
                      fill="#10b981"
                      rx={2}
                      opacity={isHovered ? 1 : 0.85}
                    />
                    {/* Expense bar */}
                    <Bar
                      x={groupX + singleBarW + 2}
                      y={yExp}
                      width={singleBarW}
                      height={hExp}
                      fill="#f43f5e"
                      rx={2}
                      opacity={isHovered ? 1 : 0.85}
                    />
                    <text
                      x={groupX + groupWidth / 2}
                      y={yMax + 18}
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

      <div className="mt-2 min-h-[24px] flex items-center justify-center text-xs">
        {hoveredIdx !== null ? (
          <div className="flex items-center gap-3 bg-card dark:bg-[#1e2027] border border-border px-3.5 py-1 rounded-full font-medium tabular-nums shadow-xs">
            <span className="font-bold text-foreground">{months[hoveredIdx].label}:</span>
            <span className="text-emerald-400">Ingresos: {fmtSignedCurrency(months[hoveredIdx].income, resolvedSym)}</span>
            <span className="text-rose-400">Gastos: {fmtSignedCurrency(-months[hoveredIdx].expense, resolvedSym)}</span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">Pasa el cursor por las barras para ver detalles</span>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. NetSavingsTrendChart — Visx Smooth Curve & Area Chart (Hero Getquin Style)
// ─────────────────────────────────────────────────────────────────────────────

export function NetSavingsTrendChart({
  transactions,
  selectedYear,
  currencySymbol,
}: {
  transactions: Tx[]
  selectedYear: number
  currencySymbol?: string
}) {
  const { symbol: resolvedSym } = useCurrency(currencySymbol)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const data = getYearMonthsData(transactions, selectedYear)
  const totalYearNet = data.reduce((s, d) => s + d.net, 0)

  const svgWidth = 600
  const svgHeight = 180
  const margin = { top: 25, right: 20, bottom: 25, left: 20 }
  const innerW = svgWidth - margin.left - margin.right
  const innerH = svgHeight - margin.top - margin.bottom

  const minVal = Math.min(0, ...data.map((d) => d.net))
  const maxVal = Math.max(1, ...data.map((d) => d.net))
  const rangePadding = (maxVal - minVal) * 0.15 || 10

  const xScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [0, innerW],
        domain: [0, data.length - 1],
      }),
    [innerW, data.length]
  )

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [innerH, 0],
        domain: [minVal - rangePadding, maxVal + rangePadding],
      }),
    [innerH, minVal, maxVal, rangePadding]
  )

  const zeroY = yScale(0)
  const activePoint = hoveredIdx !== null ? { ...data[hoveredIdx], x: xScale(hoveredIdx), y: yScale(data[hoveredIdx].net) } : null

  return (
    <section className="rounded-2xl bg-card p-4 sm:p-5 shadow-xs border border-border transition-colors hover:border-border/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-foreground sm:text-base">Evolución de Ahorro Neto ({selectedYear})</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Performance
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Curva orgánica de flujo neto mensual</p>
        </div>
        <div
          className={`self-start sm:self-auto rounded-lg px-3 py-1 text-xs font-extrabold tabular-nums border ${
            totalYearNet >= 0
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          }`}
        >
          {totalYearNet >= 0 ? "↗ " : "↘ "}{fmtSignedCurrency(totalYearNet, resolvedSym)} en {selectedYear}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-2 scrollbar-thin">
        <div className="w-[600px] sm:w-full">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-48 w-full overflow-visible select-none">
            <LinearGradient id="visx-net-green-grad" from="#10b981" to="#10b981" fromOpacity={0.25} toOpacity={0.0} />
            <Group left={margin.left} top={margin.top}>
              {/* Baseline 0 */}
              <line
                x1={0}
                y1={zeroY}
                x2={innerW}
                y2={zeroY}
                stroke="rgba(255, 255, 255, 0.12)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />

              {/* Area fill */}
              <AreaClosed
                data={data}
                x={(_, i) => xScale(i)}
                y={(d) => yScale(d.net)}
                yScale={yScale}
                y0={zeroY}
                curve={curveMonotoneX}
                fill="url(#visx-net-green-grad)"
              />

              {/* Glowing curve line */}
              <LinePath
                data={data}
                x={(_, i) => xScale(i)}
                y={(d) => yScale(d.net)}
                curve={curveMonotoneX}
                stroke="#10b981"
                strokeWidth={2.5}
                strokeLinecap="round"
              />

              {/* Vertical crosshair line when hovered */}
              {activePoint && (
                <>
                  <Line
                    from={{ x: activePoint.x, y: 0 }}
                    to={{ x: activePoint.x, y: innerH }}
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth={1}
                  />
                  {/* Glowing active point */}
                  <circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r={6}
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                  />
                  {/* Tooltip text above point */}
                  <text
                    x={activePoint.x}
                    y={Math.max(10, activePoint.y - 12)}
                    textAnchor="middle"
                    fill="#10b981"
                    fontSize={11}
                    fontWeight={800}
                    className="tabular-nums"
                  >
                    {fmtSignedCurrency(activePoint.net, resolvedSym, 0, 0)}
                  </text>
                </>
              )}

              {/* Invisible hover touchpoints */}
              {data.map((d, i) => {
                const cx = xScale(i)
                return (
                  <g
                    key={d.label + i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <rect
                      x={cx - innerW / (data.length * 2)}
                      y={0}
                      width={innerW / data.length}
                      height={innerH}
                      fill="transparent"
                    />
                    <text
                      x={cx}
                      y={innerH + 18}
                      textAnchor="middle"
                      className={`text-[11px] font-semibold transition-colors ${
                        hoveredIdx === i ? "fill-foreground font-bold" : "fill-muted-foreground"
                      }`}
                    >
                      {d.label}
                    </text>
                  </g>
                )
              })}
            </Group>
          </svg>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ExpenseCategoryProgressChart — Getquin Progress Bars
// ─────────────────────────────────────────────────────────────────────────────

export function ExpenseCategoryProgressChart({
  transactions,
  currencySymbol,
}: {
  transactions: Tx[]
  currencySymbol?: string
}) {
  const { symbol: resolvedSym } = useCurrency(currencySymbol)
  const byCategory = new Map<string, number>()
  for (const t of transactions.filter((t) => t.type === "expense")) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
  }

  const entries = [...byCategory.entries()].sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, v]) => s + v, 0)
  const maxVal = entries[0]?.[1] || 1

  return (
    <section className="rounded-2xl bg-card p-4 sm:p-5 shadow-xs border border-border transition-colors hover:border-border/80">
      <h2 className="text-sm font-bold text-foreground sm:text-base">Top Categorías de Gasto</h2>
      <p className="text-xs text-muted-foreground mb-4">Desglose ordenado por mayor volumen</p>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No hay gastos registrados aún.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map(([cat, amount], i) => {
            const pct = total > 0 ? (amount / total) * 100 : 0
            const barPct = (amount / maxVal) * 100
            const color = GETQUIN_PALETTE[i % GETQUIN_PALETTE.length]

            return (
              <div key={cat} className="flex flex-col gap-1.5 p-2 rounded-xl bg-card dark:bg-[#1a1b22] border border-border dark:border-white/[0.04]">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-foreground">{cat}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">
                    {fmtCurrency(amount, resolvedSym)} ({pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted dark:bg-[#23252f] overflow-hidden">
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
// 8. FinancialOverviewRatioChart — Getquin Style Ratio
// ─────────────────────────────────────────────────────────────────────────────

export function FinancialOverviewRatioChart({
  income,
  expenses,
  currencySymbol,
}: {
  income: number
  expenses: number
  currencySymbol?: string
}) {
  const { symbol: resolvedSym } = useCurrency(currencySymbol)
  const total = income + expenses
  const savings = Math.max(0, income - expenses)

  if (total === 0) {
    return (
      <section className="rounded-2xl bg-card p-4 sm:p-5 shadow-xs border border-border">
        <h2 className="text-sm font-bold text-foreground sm:text-base">Ratio de Capacidad de Ahorro</h2>
        <p className="text-xs text-muted-foreground text-center py-6">Sin datos de ingresos/gastos.</p>
      </section>
    )
  }

  const savingsPct = income > 0 ? (savings / income) * 100 : 0
  const expensePct = income > 0 ? (expenses / income) * 100 : 100

  return (
    <section className="rounded-2xl bg-card p-4 sm:p-5 shadow-xs border border-border transition-colors hover:border-border/80">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">Ratio de Ahorro vs Gastos</h2>
          <p className="text-xs text-muted-foreground">Porcentaje de ingresos destinados a gastos vs ahorro</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Tasa Ahorro: {savingsPct.toFixed(0)}%
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex justify-between text-xs font-bold tabular-nums">
          <span className="text-rose-400">Gastos: {expensePct.toFixed(1)}%</span>
          <span className="text-emerald-400">Ahorro: {savingsPct.toFixed(1)}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted dark:bg-[#23252f] overflow-hidden flex shadow-inner">
          <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${Math.min(100, expensePct)}%` }} />
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.max(0, savingsPct)}%` }} />
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-2">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
            <p className="text-[11px] text-muted-foreground font-semibold">Total Gastado</p>
            <p className="text-sm font-extrabold text-rose-400 tabular-nums mt-0.5">{fmtCurrency(expenses, resolvedSym)}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-[11px] text-muted-foreground font-semibold">Ahorro Generado</p>
            <p className="text-sm font-extrabold text-emerald-400 tabular-nums mt-0.5">{fmtCurrency(savings, resolvedSym)}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. MoneyFlowSankeyChart — Sankey Flow (Getquin Theme)
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
      color: GETQUIN_PALETTE[(i + colorOffset) % GETQUIN_PALETTE.length],
    }
  })
}

export function MoneyFlowSankeyChart({
  transactions,
  currencySymbol,
}: {
  transactions: Tx[]
  currencySymbol?: string
}) {
  const { symbol: resolvedSym } = useCurrency(currencySymbol)
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
      <section className="rounded-2xl bg-card p-4 sm:p-5 shadow-xs border border-border">
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

  const leftNodes = layoutSankeyNodes(incomeEntries, totalIncome, leftX, usableH, topY, 1, "inc")

  const rightRawEntries = [...expenseEntries]
  if (netSavings > 0) {
    rightRawEntries.push(["Ahorro Neto", netSavings])
  }
  const rightTotalPool = totalExpense + netSavings

  const rightNodes = layoutSankeyNodes(rightRawEntries, rightTotalPool, rightX, usableH, topY, 0, "exp")

  const poolH = usableH
  const poolY = topY
  const poolNode = { id: "pool", label: "Presupuesto", value: totalIncome, x: middleX, y: poolY, height: poolH, color: "#10b981" }

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
    <section className="rounded-2xl bg-card p-4 sm:p-5 shadow-xs border border-border transition-colors hover:border-border/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">Diagrama de Flujo de Dinero (Sankey)</h2>
          <p className="text-xs text-muted-foreground">Origen de Ingresos → Fondo Central → Gastos y Ahorro</p>
        </div>
        {activeInfo && (
          <div className="text-xs font-bold bg-card dark:bg-[#20222a] border border-border px-3 py-1 rounded-full text-foreground self-start sm:self-auto tabular-nums shadow-xs">
            {activeInfo.type}: {activeInfo.label}: {fmtSignedCurrency(activeInfo.value, resolvedSym)}
          </div>
        )}
      </div>

      <div className="mt-4 w-full overflow-x-auto pb-2 scrollbar-thin">
        <div className="w-full min-w-[650px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-w-full" preserveAspectRatio="xMidYMid meet">
            {[...leftRibbons, ...rightRibbons].map((r) => {
              const isHovered = hoveredFlow === r.id
              return (
                <path
                  key={r.id}
                  d={r.path}
                  fill={r.color}
                  opacity={hoveredFlow === null || isHovered ? 0.6 : 0.15}
                  className="cursor-pointer transition-all duration-200 hover:opacity-90"
                  onMouseEnter={() => setHoveredFlow(r.id)}
                  onMouseLeave={() => setHoveredFlow(null)}
                />
              )
            })}

            {leftNodes.map((n) => {
              const displayLabel = n.label.length > 20 ? `${n.label.slice(0, 18)}…` : n.label
              return (
                <g key={n.id}>
                  <rect x={n.x} y={n.y} width={nodeWidth} height={n.height} rx={4} fill={n.color} />
                  <text x={n.x - 10} y={n.y + Math.max(10, n.height / 2 + 4)} textAnchor="end" className="fill-foreground text-[11px] font-semibold">
                    {displayLabel} ({fmtCurrency(n.value, resolvedSym, 0, 0)})
                  </text>
                </g>
              )
            })}

            <g key={poolNode.id}>
              <rect x={poolNode.x} y={poolNode.y} width={nodeWidth} height={poolNode.height} rx={4} fill="#10b981" />
              <text x={poolNode.x + nodeWidth / 2} y={poolNode.y - 10} textAnchor="middle" className="fill-foreground text-[11px] font-bold">
                Fondo ({fmtCurrency(totalIncome, resolvedSym, 0, 0)})
              </text>
            </g>

            {rightNodes.map((n) => {
              const displayLabel = n.label.length > 20 ? `${n.label.slice(0, 18)}…` : n.label
              return (
                <g key={n.id}>
                  <rect x={n.x} y={n.y} width={nodeWidth} height={n.height} rx={4} fill={n.color} />
                  <text x={n.x + nodeWidth + 10} y={n.y + Math.max(10, n.height / 2 + 4)} textAnchor="start" className="fill-foreground text-[11px] font-semibold">
                    {displayLabel} ({fmtCurrency(n.value, resolvedSym, 0, 0)})
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
// 10. YearOverYearComparisonChart — Visx YoY Comparison
// ─────────────────────────────────────────────────────────────────────────────

export function YearOverYearComparisonChart({
  transactions,
  selectedYear = 2026,
  currencySymbol,
}: {
  transactions: Tx[]
  selectedYear?: number
  currencySymbol?: string
}) {
  const { symbol: resolvedSym } = useCurrency(currencySymbol)
  const [yearA, setYearA] = useState<number>(selectedYear)
  const [yearB, setYearB] = useState<number>(selectedYear - 1)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const availableYears: number[] = useMemo(() => {
    const set = new Set<number>([selectedYear, selectedYear - 1, 2026, 2025, 2024])
    for (const t of transactions) {
      const y = new Date(t.occurredAt).getFullYear()
      if (!isNaN(y)) set.add(y)
    }
    return Array.from(set).sort((a, b) => b - a)
  }, [transactions, selectedYear])

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

  const svgWidth = 600
  const svgHeight = 160
  const margin = { top: 15, right: 10, bottom: 25, left: 10 }
  const xMax = svgWidth - margin.left - margin.right
  const yMax = svgHeight - margin.top - margin.bottom

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, xMax],
        domain: yearAData.map((m) => m.label),
        padding: 0.3,
      }),
    [xMax, yearAData]
  )

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [yMax, 0],
        domain: [0, maxExpense * 1.1],
      }),
    [yMax, maxExpense]
  )

  return (
    <section className="rounded-2xl bg-card p-4 sm:p-5 shadow-xs border border-border transition-colors hover:border-border/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">
            Comparativa Interanual ({yearA} vs {yearB})
          </h2>
          <p className="text-xs text-muted-foreground">
            Evolución del gasto mensual comparando dos ejercicios
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
            <select
              value={yearA}
              onChange={(e) => setYearA(Number(e.target.value))}
              className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer text-xs"
            >
              {availableYears.map((y: number) => (
                <option key={`a-${y}`} value={y} className="bg-card text-foreground font-semibold">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs font-black text-muted-foreground">vs</span>

          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs shadow-xs">
            <span className="h-2 w-2 rounded-full bg-muted-foreground shrink-0" aria-hidden="true" />
            <select
              value={yearB}
              onChange={(e) => setYearB(Number(e.target.value))}
              className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer text-xs"
            >
              {availableYears.map((y: number) => (
                <option key={`b-${y}`} value={y} className="bg-card text-foreground font-semibold">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-2 scrollbar-thin">
        <div className="w-[600px] sm:w-full">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-44 w-full overflow-visible">
            <Group left={margin.left} top={margin.top}>
              {[0, 0.5, 1].map((pct, idx) => (
                <line
                  key={idx}
                  x1={0}
                  y1={yMax * pct}
                  x2={xMax}
                  y2={yMax * pct}
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              ))}

              {yearAData.map((mCurr, i) => {
                const mPrev = yearBData[i] || { expense: 0 }
                const groupWidth = xScale.bandwidth()
                const groupX = xScale(mCurr.label) ?? 0
                const singleBarW = Math.max(4, (groupWidth - 3) / 2)
                const isHovered = hoveredIdx === i

                const yA = yScale(mCurr.expense)
                const hA = Math.max(2, yMax - yA)

                const yB = yScale(mPrev.expense)
                const hB = Math.max(2, yMax - yB)

                return (
                  <g
                    key={mCurr.label + i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <rect
                      x={groupX - 3}
                      y={0}
                      width={groupWidth + 6}
                      height={yMax}
                      fill={isHovered ? "rgba(255, 255, 255, 0.04)" : "transparent"}
                      rx={6}
                    />
                    <Bar
                      x={groupX}
                      y={yA}
                      width={singleBarW}
                      height={hA}
                      fill="#10b981"
                      rx={2}
                      opacity={isHovered ? 1 : 0.85}
                    />
                    <Bar
                      x={groupX + singleBarW + 2}
                      y={yB}
                      width={singleBarW}
                      height={hB}
                      fill="#64748b"
                      rx={2}
                      opacity={isHovered ? 0.8 : 0.4}
                    />
                    <text
                      x={groupX + groupWidth / 2}
                      y={yMax + 18}
                      textAnchor="middle"
                      className={`text-[11px] font-semibold transition-colors ${
                        isHovered ? "fill-foreground font-bold" : "fill-muted-foreground"
                      }`}
                    >
                      {mCurr.label}
                    </text>
                  </g>
                )
              })}
            </Group>
          </svg>
        </div>
      </div>

      <div className="mt-2 min-h-[22px] flex items-center justify-between text-xs pt-2 border-t border-border">
        {hoveredIdx !== null ? (
          <div className="flex items-center gap-3 bg-card dark:bg-[#1e2027] border border-border px-3.5 py-1 rounded-full font-medium w-full justify-center tabular-nums shadow-xs">
            <span className="font-bold text-foreground">{yearAData[hoveredIdx].label}:</span>
            <span className="text-emerald-400">{yearA}: {fmtCurrency(yearAData[hoveredIdx].expense, resolvedSym)}</span>
            <span className="text-muted-foreground">{yearB}: {fmtCurrency(yearBData[hoveredIdx].expense, resolvedSym)}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full text-muted-foreground text-[11px] flex-wrap gap-2 tabular-nums">
            <span>
              Total {yearA}: <strong className="text-foreground">{fmtCurrency(totalA, resolvedSym)}</strong>
              {" · "}
              Total {yearB}: <strong className="text-foreground">{fmtCurrency(totalB, resolvedSym)}</strong>
            </span>
            <span>
              Variación:{" "}
              <strong className={diffPct <= 0 ? "text-emerald-400" : "text-rose-400"}>
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
// ─────────────────────────────────────────────────────────────────────────────
// 11. InvestmentCategoryChart — Visx Donut Pie (Getquin Style)
// ─────────────────────────────────────────────────────────────────────────────

export function InvestmentCategoryChart({ transactions, selectedYear }: { transactions: Tx[]; selectedYear?: number }) {
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
  const slices = entries.map(([cat, amount], i) => ({
    label: cat,
    amount,
    color: GETQUIN_PALETTE[(i + 2) % GETQUIN_PALETTE.length],
  }))

  return (
    <DonutAllocationChart
      title="Distribución por Tipo de Activo"
      subtitle="Capital aportado a carteras e instrumentos"
      emptyTitle="Distribución por Tipo de Activo"
      emptyMessage="Sin movimientos de inversión registrados aún."
      slices={slices}
      total={total}
      centerLabel="Total Invertido"
      centerValueColor="#10b981"
      valueColor="text-emerald-400"
      sign="+"
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. InvestmentMonthlyBarChart — Visx Monthly Investment Bar Chart
// ─────────────────────────────────────────────────────────────────────────────

export function InvestmentMonthlyBarChart({
  transactions,
  selectedYear,
  currencySymbol,
}: {
  transactions: Tx[]
  selectedYear: number
  currencySymbol?: string
}) {
  const invTxs = transactions.filter((t) => {
    const td = new Date(t.occurredAt)
    return (td.getFullYear() === selectedYear || td.getUTCFullYear() === selectedYear) && isInvestmentTx(t)
  })

  const data = MONTH_LABELS.map((label, m) => {
    let amt = 0
    for (const t of invTxs) {
      if (new Date(t.occurredAt).getMonth() === m) amt += t.amount
    }
    return { key: label, label, amount: amt }
  })

  return (
    <MonthlySingleBarChart
      title={`Inversión Mensual (${selectedYear})`}
      subtitle="Aportaciones de patrimonio de Enero a Diciembre"
      data={data}
      gradId="visx-inv-bar-grad"
      fromColor="#10b981"
      toColor="#047857"
      sign="+"
      tooltipColorClass="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      currencySymbol={currencySymbol}
    />
  )
}
