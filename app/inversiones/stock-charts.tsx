"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { RefreshCw } from "lucide-react"
import type { StockPosition } from "@/app/actions"
import { CURRENCY_SYMBOLS, formatCompactCurrency } from "@/lib/format"

export const ASSET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16",
  "#14b8a6", "#6366f1"
]

// ─── Compound Growth Projection Chart ─────────────────────────────────────────

export function CompoundGrowthChart({
  initialValue,
  defaultReturnPct,
  displayCurrency,
}: {
  initialValue: number
  defaultReturnPct: number
  displayCurrency: string
}) {
  const [returnPct, setReturnPct] = useState(() =>
    Number(Math.max(1, Math.min(50, defaultReturnPct || 8)).toFixed(1))
  )
  const [monthlyContrib, setMonthlyContrib] = useState(300)
  const [hoverYearIndex, setHoverYearIndex] = useState<number | null>(6)

  const dispSym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency

  const yearsList = [1, 5, 10, 15, 20, 25, 30]
  const r = (returnPct || 0) / 100 / 12

  const projection = yearsList.map((years) => {
    const months = years * 12
    let balance = initialValue
    let totalInvested = initialValue

    for (let m = 0; m < months; m++) {
      balance = (balance + monthlyContrib) * (1 + r)
      totalInvested += monthlyContrib
    }

    const interestEarned = Math.max(0, balance - totalInvested)
    const multiplier = totalInvested > 0 ? balance / totalInvested : 1
    const interestSharePct = balance > 0 ? (interestEarned / balance) * 100 : 0
    return { years, balance, totalInvested, interestEarned, multiplier, interestSharePct }
  })

  const maxVal = Math.max(...projection.map((p) => p.balance), 1)

  const svgWidth = 560
  const svgHeight = 210
  const paddingLeft = 50
  const paddingRight = 30
  const paddingTop = 20
  const paddingBottom = 35
  const chartWidth = svgWidth - paddingLeft - paddingRight
  const chartHeight = svgHeight - paddingTop - paddingBottom
  const baselineY = paddingTop + chartHeight

  const pointsTotal = projection.map((p, idx) => {
    const x = paddingLeft + (idx / Math.max(1, yearsList.length - 1)) * chartWidth
    const y = baselineY - (p.balance / maxVal) * chartHeight
    return { x, y, ...p }
  })

  const pointsInvested = projection.map((p, idx) => {
    const x = paddingLeft + (idx / Math.max(1, yearsList.length - 1)) * chartWidth
    const y = baselineY - (p.totalInvested / maxVal) * chartHeight
    return { x, y }
  })

  const pathTotal = getBezierPathD(pointsTotal)
  const areaTotal = `${pathTotal} L ${pointsTotal[pointsTotal.length - 1]?.x ?? 0} ${baselineY} L ${pointsTotal[0]?.x ?? 0} ${baselineY} Z`

  const pathInvested = getBezierPathD(pointsInvested)
  const areaInvested = `${pathInvested} L ${pointsInvested[pointsInvested.length - 1]?.x ?? 0} ${baselineY} L ${pointsInvested[0]?.x ?? 0} ${baselineY} Z`

  const activePoint = hoverYearIndex !== null ? pointsTotal[hoverYearIndex] : pointsTotal[pointsTotal.length - 1]

  return (
    <div className="flex flex-col gap-5 bg-gradient-to-br from-card/90 via-background to-emerald-950/15 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-emerald-500/20 shadow-2xl transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 font-extrabold text-base ring-1 ring-emerald-500/30">
              🚀
            </span>
            <h4 className="text-base font-extrabold text-foreground tracking-tight">
              Proyección Visual de Interés Compuesto
            </h4>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Capital inicial cargado: <span className="font-black text-emerald-400">{dispSym}{initialValue.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
          <div className="flex items-center justify-between gap-2 bg-secondary/40 backdrop-blur-md rounded-2xl px-3.5 py-2 border border-border/50 shadow-inner">
            <span className="text-xs font-bold text-muted-foreground">Rendimiento anual:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max="50"
                step="0.5"
                value={returnPct}
                onChange={(e) => setReturnPct(parseFloat(e.target.value) || 0)}
                className="w-12 bg-transparent font-black text-emerald-400 focus:outline-none text-right text-sm"
              />
              <span className="font-extrabold text-emerald-400">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 bg-secondary/40 backdrop-blur-md rounded-2xl px-3.5 py-2 border border-border/50 shadow-inner">
            <span className="text-xs font-bold text-muted-foreground">Aporte mensual:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="50"
                value={monthlyContrib}
                onChange={(e) => setMonthlyContrib(parseFloat(e.target.value) || 0)}
                className="w-16 bg-transparent font-black text-foreground focus:outline-none text-right text-sm"
              />
              <span className="font-bold text-foreground">{dispSym}/m</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
            {[100, 200, 300, 500, 1000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setMonthlyContrib(amt)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  monthlyContrib === amt
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 scale-105"
                    : "bg-secondary/60 text-muted-foreground border border-border/40 hover:text-foreground hover:bg-secondary"
                }`}
              >
                +{amt}{dispSym}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative flex flex-col items-center">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto max-h-80 overflow-visible"
            role="img"
            aria-label="Gráfico de simulación de interés compuesto"
            aria-labelledby="compound-chart-title"
            onMouseLeave={() => setHoverYearIndex(6)}
          >
            <title id="compound-chart-title">Simulación de interés compuesto</title>
            <defs>
              <linearGradient id="tailwindCompoundTotalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.55" />
                <stop offset="40%" stopColor="#14b8a6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id="tailwindCompoundInvestedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#64748b" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#64748b" stopOpacity="0.0" />
              </linearGradient>

              <filter id="emeraldGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {[0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = baselineY - ratio * chartHeight
              const val = maxVal * ratio
              return (
                <g key={ratio}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={paddingLeft + chartWidth}
                    y2={y}
                    stroke="currentColor"
                    strokeDasharray="3 3"
                    className="text-border/25"
                  />
                  <text x={paddingLeft - 8} y={y + 4} textAnchor="end" className="text-[9px] fill-muted-foreground/80 font-bold">
                    {formatCompactCurrency(val, dispSym)}
                  </text>
                </g>
              )
            })}

            <path d={areaTotal} fill="url(#tailwindCompoundTotalGrad)" />
            <path
              d={pathTotal}
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#emeraldGlow)"
            />

            <path d={areaInvested} fill="url(#tailwindCompoundInvestedGrad)" />
            <path
              d={pathInvested}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />

            {activePoint && (
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={baselineY}
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="2 2"
                opacity="0.8"
              />
            )}

            {pointsTotal.map((p, idx) => {
              const isH = hoverYearIndex === idx
              return (
                <g
                  key={p.years}
                  onMouseEnter={() => setHoverYearIndex(idx)}
                  className="cursor-pointer group"
                >
                  <rect
                    x={p.x - 20}
                    y={paddingTop}
                    width="40"
                    height={chartHeight + 30}
                    fill="transparent"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isH ? 8 : 5}
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth={isH ? "3" : "1.5"}
                    className="transition-all duration-200 drop-shadow-md"
                  />
                  <text
                    x={p.x}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    className={`text-[11px] font-extrabold transition-all ${
                      isH ? "fill-emerald-400 text-xs font-black" : "fill-muted-foreground/80"
                    }`}
                  >
                    {p.years}a
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {activePoint && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gradient-to-r from-card/80 via-secondary/40 to-card/80 backdrop-blur-md p-4 rounded-2xl border border-emerald-500/30 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <span>📅 Horizonte {activePoint.years} Años</span>
              </span>
              <span className="text-2xl font-black text-foreground tabular-nums tracking-tight mt-0.5">
                {dispSym}{activePoint.balance.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
              </span>
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 w-fit">
                ⚡ Multiplicador: x{activePoint.multiplier.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-border/40 pt-2 sm:pt-0 sm:pl-4">
              <span className="text-[10px] font-bold text-muted-foreground">Capital Aportado</span>
              <span className="text-base font-extrabold text-foreground tabular-nums mt-0.5">
                {dispSym}{activePoint.totalInvested.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-muted-foreground/70">Tu ahorro acumulado</span>
            </div>

            <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-border/40 pt-2 sm:pt-0 sm:pl-4">
              <span className="text-[10px] font-bold text-emerald-400">Interés Generado (Bola de Nieve ❄️)</span>
              <span className="text-base font-black text-emerald-400 tabular-nums mt-0.5">
                +{dispSym}{activePoint.interestEarned.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-emerald-400/90 font-bold">
                {activePoint.interestSharePct.toFixed(1)}% del total es interés
              </span>
            </div>

            <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-border/40 pt-2 sm:pt-0 sm:pl-4">
              <span className="text-[10px] font-bold text-muted-foreground mb-1">Composición del Patrimonio</span>
              <div className="h-2.5 w-full rounded-full bg-secondary/80 overflow-hidden flex shadow-inner">
                <div
                  className="h-full bg-slate-400 transition-all duration-300"
                  style={{ width: `${100 - activePoint.interestSharePct}%` }}
                />
                <div
                  className="h-full bg-emerald-400 shadow-md shadow-emerald-400/50 transition-all duration-300"
                  style={{ width: `${activePoint.interestSharePct}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground font-semibold mt-1">
                <span>Aportado</span>
                <span className="text-emerald-400 font-bold">Interés ❄️</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
        {[1, 3, 5, 6].map((idx) => {
          const item = projection[idx]
          if (!item) return null
          const isSelected = hoverYearIndex === idx
          return (
            <div
              key={item.years}
              onClick={() => setHoverYearIndex(idx)}
              className={`flex flex-col gap-1.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? "bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10 scale-[1.03]"
                  : "bg-secondary/20 border-border/30 hover:bg-secondary/40 hover:border-border/60"
              }`}
            >
              <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground">
                <span className="text-foreground">{item.years} Años</span>
                <span className="text-emerald-400 font-black text-xs">x{item.multiplier.toFixed(1)}</span>
              </div>
              <span className="text-base font-black text-foreground tabular-nums">
                {dispSym}{item.balance.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold tabular-nums">
                +{dispSym}{item.interestEarned.toLocaleString("es-ES", { maximumFractionDigits: 0 })} ganados
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Index Comparison Line Chart ─────────────────────────────────────────────

export const BENCHMARKS = [
  { symbol: "VANTAGE:SP500", name: "S&P 500", icon: "🇺🇸", ytdPct: 12.51, color: "#3b82f6" },
  { symbol: "FOREXCOM:NSXUSD", name: "Nasdaq 100", icon: "🚀", ytdPct: 15.84, color: "#8b5cf6" },
  { symbol: "BME:IBC", name: "Ibex 35", icon: "🇪🇸", ytdPct: 16.86, color: "#f59e0b" },
  { symbol: "TVC:GOLD", name: "Oro (Gold)", icon: "🥇", ytdPct: 1.49, color: "#eab308" },
  { symbol: "BINANCE:BTCUSDT", name: "Bitcoin", icon: "🪙", ytdPct: -27.52, color: "#ef4444" },
]

export const TIME_MONTHS = ["Ene", "Mar", "May", "Jul", "Sep", "Nov", "YTD (Año)"]

export function getBezierPathD(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return ""
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const dx = (p1.x - p0.x) * 0.45
    const cp1x = p0.x + dx
    const cp1y = p0.y
    const cp2x = p1.x - dx
    const cp2y = p1.y
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`
  }
  return d
}

export function IndexComparisonChart({
  positions,
  currentPrices,
  displayCurrency,
  fxRates,
}: {
  positions: StockPosition[]
  currentPrices: Record<string, { price: number; currency: string }>
  displayCurrency: string
  fxRates: Record<string, number>
}) {
  const [historyData, setHistoryData] = useState<Record<string, { month: string; close: number; pct: number }[]>>({})
  const [loading, setLoading] = useState(true)
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const validPositions = positions.filter(
    (p) => p.shares != null && p.avgPrice != null && p.shares > 0 && p.avgPrice > 0
  )

  const posSymbolsKey = validPositions.map((p) => p.symbol).join(",")

  useEffect(() => {
    let isMounted = true
    async function loadRealTradingViewHistory() {
      setLoading(true)
      try {
        const userSyms = validPositions.map((p) => p.symbol)
        const benchmarkSyms = BENCHMARKS.map((b) => b.symbol)
        const allSyms = Array.from(new Set([...userSyms, ...benchmarkSyms]))

        if (allSyms.length === 0) return

        const res = await fetch(`/api/stock-history?symbols=${encodeURIComponent(allSyms.join(","))}`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted && data && typeof data === "object") {
            setHistoryData(data)
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadRealTradingViewHistory()
    return () => { isMounted = false }
  }, [posSymbolsKey])

  const sampleHist = Object.values(historyData).find((h) => Array.isArray(h) && h.length > 0)
  const monthLabels = sampleHist && sampleHist.length >= 3
    ? sampleHist.map((h) => h.month)
    : TIME_MONTHS

  const totalInvestedDisp = validPositions.reduce((acc, pos) => {
    const priceData = currentPrices[pos.symbol]
    const nativeCurr = priceData?.currency ?? "USD"
    const fxKey = `${nativeCurr}${displayCurrency}`
    const currentFx = nativeCurr === displayCurrency ? 1 : (fxRates[fxKey] ?? 1)
    const purchaseFx = pos.avgFxRate && pos.avgFxRate > 0 ? pos.avgFxRate : currentFx
    return acc + pos.shares! * pos.avgPrice! * purchaseFx
  }, 0)

  const portfolioMonthlyHistory = monthLabels.map((month, monthIdx) => {
    const monthValueDisp = validPositions.reduce((acc, pos) => {
      const priceData = currentPrices[pos.symbol]
      const nativeCurr = priceData?.currency ?? "USD"
      const fxKey = `${nativeCurr}${displayCurrency}`
      const currentFx = nativeCurr === displayCurrency ? 1 : (fxRates[fxKey] ?? 1)

      const stockHist = historyData[pos.symbol]
      const monthClosePrice =
        stockHist && stockHist[monthIdx]
          ? stockHist[monthIdx].close
          : priceData?.price ?? pos.avgPrice!

      return acc + pos.shares! * monthClosePrice * currentFx
    }, 0)

    const pct = totalInvestedDisp > 0
      ? parseFloat((((monthValueDisp - totalInvestedDisp) / totalInvestedDisp) * 100).toFixed(2))
      : 0

    return { month, pct }
  })

  const portfolioFinalPct = portfolioMonthlyHistory[portfolioMonthlyHistory.length - 1]?.pct ?? 0

  const allSeries = [
    {
      symbol: "PORTFOLIO",
      name: "Tu Cartera",
      icon: "💼",
      color: "var(--color-primary, #3b82f6)",
      finalPct: portfolioFinalPct,
      isPortfolio: true,
      history: portfolioMonthlyHistory,
    },
    ...BENCHMARKS.map((b) => {
      const realHist = historyData[b.symbol]
      const hasReal = Array.isArray(realHist) && realHist.length > 0
      const finalVal = hasReal ? realHist[realHist.length - 1].pct : b.ytdPct

      const pointsHistory = hasReal
        ? realHist.map((h) => ({ month: h.month, pct: h.pct }))
        : monthLabels.map((m, idx) => {
            const factor = monthLabels.length > 1 ? idx / (monthLabels.length - 1) : 1
            const wave = Math.sin(idx * 1.6) * (b.ytdPct * 0.18)
            return { month: m, pct: parseFloat((b.ytdPct * factor + wave).toFixed(2)) }
          })

      return {
        ...b,
        finalPct: finalVal,
        isPortfolio: false,
        history: pointsHistory,
      }
    }),
  ]

  const allPcts = allSeries.flatMap((s) => s.history.map((h) => Math.abs(h.pct)))
  const maxAbsPct = Math.max(...allPcts, 15)

  const svgWidth = 540
  const svgHeight = 240
  const paddingLeft = 45
  const paddingRight = 65
  const paddingTop = 25
  const paddingBottom = 35

  const chartWidth = svgWidth - paddingLeft - paddingRight
  const chartHeight = svgHeight - paddingTop - paddingBottom
  const zeroY = paddingTop + chartHeight / 2

  const seriesPaths = allSeries.map((s) => {
    const points = s.history.map((h, idx) => {
      const x = paddingLeft + (idx / Math.max(1, s.history.length - 1)) * chartWidth
      const pct = h.pct
      const y = zeroY - (pct / maxAbsPct) * (chartHeight / 2)
      return { x, y, pct, month: h.month }
    })

    const pathD = getBezierPathD(points)
    const areaD = `${pathD} L ${points[points.length - 1]?.x ?? 0} ${zeroY} L ${points[0]?.x ?? 0} ${zeroY} Z`

    return { ...s, points, pathD, areaD, lastPoint: points[points.length - 1] ?? { x: 0, y: 0, pct: 0, month: "" } }
  })

  const activeHoverMonth = hoverIndex !== null ? monthLabels[hoverIndex] : null

  return (
    <div className="flex flex-col gap-4 bg-background/60 rounded-2xl p-5 border border-border/40 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            📈 Comparativa de Rendimiento YTD vs Índices
          </h4>
          <p className="text-xs text-muted-foreground">
            Evolución porcentual continua (Perf.YTD) obtenida en tiempo real desde TradingView API
          </p>
        </div>

        {loading && (
          <span className="text-xs text-primary font-semibold animate-pulse flex items-center gap-1">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Conectando TradingView…
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5 bg-secondary/30 p-2.5 rounded-xl border border-border/30 text-xs">
        {seriesPaths.map((s) => {
          const isH = s.symbol === activeHighlight
          const isGain = s.finalPct >= 0
          return (
            <div
              key={s.symbol}
              onMouseEnter={() => setActiveHighlight(s.symbol)}
              onMouseLeave={() => setActiveHighlight(null)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                s.isPortfolio
                  ? "bg-primary/10 border-primary/40 text-primary font-bold shadow-xs"
                  : isH
                  ? "bg-card text-foreground border-border shadow-xs"
                  : "bg-secondary/40 text-muted-foreground border-border/30 hover:text-foreground"
              }`}
            >
              <span className="h-3 w-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: s.color }} />
              <span className="text-xs font-bold">{s.icon} {s.name}:</span>
              <span className={`font-black tabular-nums text-xs ${isGain ? "text-positive" : "text-destructive"}`}>
                {isGain ? "+" : ""}{s.finalPct.toFixed(2)}%
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col items-center relative">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-80 overflow-visible"
          role="img"
          aria-label="Gráfico de evolución histórica del patrimonio"
          aria-labelledby="history-chart-title"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <title id="history-chart-title">Evolución histórica del patrimonio</title>
          <defs>
            <linearGradient id="posZoneGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="negZoneGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.0" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.08" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <rect
            x={paddingLeft}
            y={paddingTop}
            width={chartWidth}
            height={chartHeight / 2}
            fill="url(#posZoneGrad)"
            rx="4"
          />
          <rect
            x={paddingLeft}
            y={zeroY}
            width={chartWidth}
            height={chartHeight / 2}
            fill="url(#negZoneGrad)"
            rx="4"
          />

          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft + chartWidth}
            y2={paddingTop}
            stroke="currentColor"
            strokeDasharray="3 3"
            className="text-positive/30"
          />
          <text x={paddingLeft - 8} y={paddingTop + 4} textAnchor="end" className="text-[10px] fill-positive font-bold">
            +{maxAbsPct.toFixed(0)}%
          </text>

          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight}
            x2={paddingLeft + chartWidth}
            y2={paddingTop + chartHeight}
            stroke="currentColor"
            strokeDasharray="3 3"
            className="text-destructive/30"
          />
          <text x={paddingLeft - 8} y={paddingTop + chartHeight + 4} textAnchor="end" className="text-[10px] fill-destructive font-bold">
            -{maxAbsPct.toFixed(0)}%
          </text>

          <line
            x1={paddingLeft}
            y1={zeroY}
            x2={paddingLeft + chartWidth}
            y2={zeroY}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="text-foreground/50"
          />
          <text x={paddingLeft - 8} y={zeroY + 4} textAnchor="end" className="text-[10px] fill-muted-foreground font-black">
            0%
          </text>

          {hoverIndex !== null && (
            <line
              x1={paddingLeft + (hoverIndex / Math.max(1, monthLabels.length - 1)) * chartWidth}
              y1={paddingTop}
              x2={paddingLeft + (hoverIndex / Math.max(1, monthLabels.length - 1)) * chartWidth}
              y2={paddingTop + chartHeight}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              className="text-primary/70"
            />
          )}

          {seriesPaths.map((s) => {
            const isH = s.symbol === activeHighlight
            const strokeWidth = s.isPortfolio ? 3.5 : isH ? 3 : 2.2
            const opacity = activeHighlight === null ? 0.9 : isH || s.isPortfolio ? 1 : 0.2

            return (
              <g key={s.symbol} className="transition-all duration-200">
                {s.isPortfolio && (
                  <path d={s.areaD} fill={s.color} opacity="0.12" />
                )}

                <path
                  d={s.pathD}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={s.isPortfolio ? "url(#glow)" : undefined}
                />

                {s.points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={hoverIndex === idx ? (s.isPortfolio ? 6 : 5) : (s.isPortfolio ? 4 : 3)}
                    fill={s.color}
                    opacity={opacity}
                    className="transition-all"
                  />
                ))}

                <g opacity={opacity}>
                  <circle cx={s.lastPoint.x} cy={s.lastPoint.y} r="5" fill={s.color} />
                  <text
                    x={s.lastPoint.x + 8}
                    y={s.lastPoint.y + 4}
                    className={`text-[10px] font-black tabular-nums ${
                      s.finalPct >= 0 ? "fill-positive" : "fill-destructive"
                    }`}
                  >
                    {s.finalPct >= 0 ? "+" : ""}{s.finalPct.toFixed(1)}%
                  </text>
                </g>
              </g>
            )
          })}

          {monthLabels.map((month, idx) => {
            const x = paddingLeft + (idx / Math.max(1, monthLabels.length - 1)) * chartWidth
            return (
              <g
                key={month}
                onMouseEnter={() => setHoverIndex(idx)}
                className="cursor-pointer group"
              >
                <rect
                  x={x - 20}
                  y={paddingTop}
                  width="40"
                  height={chartHeight + 25}
                  fill="transparent"
                />
                <text
                  x={x}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  className={`text-[10px] font-bold transition-all ${
                    hoverIndex === idx ? "fill-primary text-xs" : "fill-muted-foreground"
                  }`}
                >
                  {month}
                </text>
              </g>
            )
          })}
        </svg>

        {activeHoverMonth && hoverIndex !== null && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 bg-secondary/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-border/50 text-xs animate-in fade-in zoom-in-95 duration-150">
            <span className="font-black text-primary border-r border-border/50 pr-2">
              📅 Periodo: {activeHoverMonth}
            </span>
            {seriesPaths.map((s) => {
              const val = s.points[hoverIndex]?.pct ?? 0
              const isG = val >= 0
              return (
                <div key={s.symbol} className="flex items-center gap-1">
                  <span>{s.icon}</span>
                  <span className="font-semibold text-foreground">{s.name}:</span>
                  <span className={`font-black tabular-nums ${isG ? "text-positive" : "text-destructive"}`}>
                    {isG ? "+" : ""}{val.toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TradingView Advanced Widget Component ──────────────────────────────────

export function TradingViewAdvancedWidget({
  positions,
}: {
  positions: StockPosition[]
}) {
  const containerId = useRef(`tv_chart_${Math.random().toString(36).substring(2, 9)}`).current
  const [scriptLoaded, setScriptLoaded] = useState(false)

  const { compareSymbols, portfolioFormula } = useMemo(() => {
    const validPositions = positions.filter(
      (p) => p.shares != null && p.avgPrice != null && p.shares > 0 && p.avgPrice > 0
    )
    const formula =
      validPositions.length > 0
        ? validPositions.map((p) => `${p.shares}*${p.symbol}`).join(" + ")
        : null

    const defaultIndices = [
      { symbol: "FOREXCOM:NSXUSD", title: "Nasdaq 100" },
      { symbol: "BME:IBC", title: "Ibex 35" },
      { symbol: "TVC:GOLD", title: "Oro (Gold)" },
      { symbol: "BINANCE:BTCUSDT", title: "Bitcoin" },
    ]
    const userSyms = validPositions.map((p) => ({ symbol: p.symbol, title: p.label || p.symbol }))

    const combined = [...defaultIndices, ...userSyms]
    const seen = new Set<string>()
    const filtered = combined.filter((s) => {
      if (seen.has(s.symbol) || s.symbol === "VANTAGE:SP500") return false
      seen.add(s.symbol)
      return true
    })

    return { compareSymbols: filtered, portfolioFormula: formula }
  }, [positions])

  useEffect(() => {
    if (typeof window === "undefined") return

    const win = window as unknown as { TradingView?: unknown }
    if (win.TradingView) {
      setScriptLoaded(true)
      return
    }

    const existingScript = document.getElementById("tradingview-tv-js")
    if (existingScript) {
      existingScript.addEventListener("load", () => setScriptLoaded(true))
      return
    }

    const script = document.createElement("script")
    script.id = "tradingview-tv-js"
    script.src = "https://s3.tradingview.com/tv.js"
    script.async = true
    script.onload = () => setScriptLoaded(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!scriptLoaded || typeof window === "undefined") return

    const win = window as unknown as {
      TradingView?: { widget: new (config: Record<string, unknown>) => void }
    }
    const TV = win.TradingView

    if (!TV || !TV.widget) return

    const allCompareTickers = [
      ...(portfolioFormula ? [{ symbol: portfolioFormula, title: "💼 Tu Cartera (Ponderada)" }] : []),
      ...compareSymbols,
    ]

    const studies = allCompareTickers.map((item) => ({
      id: "Compare@tv-basicstudies",
      inputs: {
        symbol: item.symbol,
      },
    }))

    try {
      new TV.widget({
        autosize: true,
        symbol: "VANTAGE:SP500",
        interval: "D",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "2",
        locale: "es",
        toolbar_bg: "#09090b",
        enable_publishing: false,
        allow_symbol_change: true,
        container_id: containerId,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: true,
        details: false,
        hotlist: false,
        calendar: false,
        studies: studies,
      })
    } catch {
      /* ignore */
    }
  }, [scriptLoaded, containerId, compareSymbols, portfolioFormula])

  return (
    <div className="flex flex-col gap-3 bg-background/60 rounded-2xl p-3 sm:p-4 border border-border/40 shadow-xs w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/30 pb-3">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            📉 Visor Comparativo Oficial de TradingView (Todos los Activos)
          </h4>
          <p className="text-xs text-muted-foreground">
            Gráfico interactivo profesional de TradingView superponiendo S&P 500, Nasdaq 100, Ibex 35, Bitcoin y las acciones de tu cartera
          </p>
        </div>

        {!scriptLoaded && (
          <span className="text-xs text-primary font-semibold animate-pulse flex items-center gap-1">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Cargando visor de TradingView…
          </span>
        )}
      </div>

      <div className="relative w-full h-[520px] rounded-xl overflow-hidden bg-background border border-border/30">
        <div id={containerId} className="w-full h-full" />
      </div>
    </div>
  )
}

// ─── Sector & Risk Matrix Component ──────────────────────────────────────────

export const SECTOR_CONFIGS: Record<
  string,
  { name: string; icon: string; color: string; riskScore: number }
> = {
  crypto: { name: "Criptomonedas & Digital", icon: "🪙", color: "#f59e0b", riskScore: 9.5 },
  tech: { name: "Tecnología e Innovación", icon: "💻", color: "#3b82f6", riskScore: 7.0 },
  financial: { name: "Servicios Financieros & Banca", icon: "🏦", color: "#10b981", riskScore: 5.5 },
  consumer: { name: "Consumo & Comercio", icon: "🛍️", color: "#ec4899", riskScore: 6.0 },
  commodities: { name: "Materias Primas & Refugio", icon: "🥇", color: "#eab308", riskScore: 2.5 },
  etf: { name: "Índices & Fondos Cotizados", icon: "📈", color: "#8b5cf6", riskScore: 4.5 },
  other: { name: "Otros Sectores / Diversos", icon: "🏢", color: "#64748b", riskScore: 5.0 },
}

export function detectSector(symbol: string, label: string): keyof typeof SECTOR_CONFIGS {
  const sym = symbol.toUpperCase()
  const lbl = label.toUpperCase()

  if (
    sym.includes("BTC") ||
    sym.includes("ETH") ||
    sym.includes("SOL") ||
    sym.includes("BINANCE:") ||
    sym.includes("CRYPTO:") ||
    lbl.includes("BITCOIN") ||
    lbl.includes("ETHEREUM")
  ) {
    return "crypto"
  }

  if (
    sym.includes("GOLD") ||
    sym.includes("SILVER") ||
    sym.includes("XAUUSD") ||
    sym.includes("TVC:GOLD") ||
    sym.includes("GDX") ||
    lbl.includes("ORO")
  ) {
    return "commodities"
  }

  if (
    sym.includes("SPY") ||
    sym.includes("QQQ") ||
    sym.includes("IBC") ||
    sym.includes("NDX") ||
    sym.includes("SPX") ||
    lbl.includes("ETF") ||
    lbl.includes("INDEX") ||
    lbl.includes("S&P") ||
    lbl.includes("NASDAQ") ||
    lbl.includes("IBEX")
  ) {
    return "etf"
  }

  if (
    sym.includes("AAPL") ||
    sym.includes("NVDA") ||
    sym.includes("MSFT") ||
    sym.includes("AMZN") ||
    sym.includes("GOOG") ||
    sym.includes("META") ||
    sym.includes("TSLA") ||
    sym.includes("AMD") ||
    sym.includes("ASML") ||
    lbl.includes("APPLE") ||
    lbl.includes("NVIDIA") ||
    lbl.includes("MICROSOFT") ||
    lbl.includes("TESLA")
  ) {
    return "tech"
  }

  if (
    sym.includes("SAN") ||
    sym.includes("BBVA") ||
    sym.includes("JPM") ||
    sym.includes("BAC") ||
    sym.includes("V") ||
    sym.includes("MA") ||
    lbl.includes("BANCO") ||
    lbl.includes("SANTANDER")
  ) {
    return "financial"
  }

  if (sym.includes("LVMH") || sym.includes("NKE") || sym.includes("KO") || sym.includes("PEP")) {
    return "consumer"
  }

  return "other"
}

export function SectorRiskAnalysis({
  items,
  displayCurrency,
}: {
  items: {
    symbol: string
    label: string
    currentDisp: number
    investedDisp: number
    weightPct: number
  }[]
  displayCurrency: string
}) {
  const dispSym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency
  const totalValue = items.reduce((acc, it) => acc + it.currentDisp, 0)

  const sectorGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        key: string
        config: (typeof SECTOR_CONFIGS)[keyof typeof SECTOR_CONFIGS]
        totalDisp: number
        weightPct: number
        assets: typeof items
      }
    > = {}

    items.forEach((it) => {
      const sKey = detectSector(it.symbol, it.label)
      const config = SECTOR_CONFIGS[sKey]

      if (!groups[sKey]) {
        groups[sKey] = {
          key: sKey,
          config,
          totalDisp: 0,
          weightPct: 0,
          assets: [],
        }
      }
      groups[sKey].totalDisp += it.currentDisp
      groups[sKey].assets.push(it)
    })

    Object.values(groups).forEach((g) => {
      g.weightPct = totalValue > 0 ? (g.totalDisp / totalValue) * 100 : 0
    })

    return Object.values(groups).sort((a, b) => b.totalDisp - a.totalDisp)
  }, [items, totalValue])

  const weightedRiskScore = useMemo(() => {
    if (totalValue === 0) return 5.0
    const weightedSum = sectorGroups.reduce((acc, g) => {
      return acc + (g.weightPct / 100) * g.config.riskScore
    }, 0)
    return parseFloat(weightedSum.toFixed(1))
  }, [sectorGroups, totalValue])

  const hhiIndex = useMemo(() => {
    if (totalValue === 0) return 0
    return sectorGroups.reduce((acc, g) => acc + Math.pow(g.weightPct, 2), 0)
  }, [sectorGroups, totalValue])

  const riskLabel =
    weightedRiskScore < 4.0
      ? { text: "Conservadora", color: "text-positive", bg: "bg-positive/10 border-positive/30" }
      : weightedRiskScore < 6.5
      ? { text: "Moderada / Crecimiento", color: "text-primary", bg: "bg-primary/10 border-primary/30" }
      : weightedRiskScore < 8.2
      ? { text: "Dinámica / Alto Crecimiento", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30" }
      : { text: "Muy Agresiva / Especulativa", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" }

  const concentrationLabel =
    hhiIndex < 2500
      ? { text: "Diversificación Excelente", color: "text-positive" }
      : hhiIndex < 4000
      ? { text: "Concentración Moderada", color: "text-amber-500" }
      : { text: "Alta Concentración Sectorial", color: "text-destructive" }

  const largestSector = sectorGroups[0]

  return (
    <div className="flex flex-col gap-4 bg-background/60 rounded-2xl p-4 border border-border/40 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            🛡️ Matriz de Riesgo & Diversificación por Sectores
          </h4>
          <p className="text-xs text-muted-foreground">
            Análisis de exposición por industria, medidor de volatilidad y evaluación de riesgo de la cartera
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl p-3.5 border bg-card flex flex-col gap-2 border-border/40">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-muted-foreground">Nivel de Riesgo Global:</span>
            <span className={`font-black px-2 py-0.5 rounded-full border text-[11px] ${riskLabel.bg} ${riskLabel.color}`}>
              {riskLabel.text}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-foreground tabular-nums">
              {weightedRiskScore.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">/ 10</span>
          </div>

          <div className="h-2.5 w-full rounded-full bg-secondary/80 overflow-hidden flex relative mt-1">
            <div
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-positive via-amber-500 to-destructive"
              style={{ width: `${(weightedRiskScore / 10) * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl p-3.5 border bg-card flex flex-col gap-2 border-border/40">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-muted-foreground">Diversificación Sectorial:</span>
            <span className={`font-black text-xs ${concentrationLabel.color}`}>
              {concentrationLabel.text}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-foreground tabular-nums">
              {sectorGroups.length}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">sectores representados</span>
          </div>

          {largestSector && largestSector.weightPct > 40 && (
            <p className="text-[10px] text-amber-500/90 font-medium flex items-center gap-1 mt-1">
              <span>⚠️ Tu sector principal ({largestSector.config.name}) representa el {largestSector.weightPct.toFixed(1)}% de tu capital.</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 mt-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
          Desglose de Capital por Industria
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {sectorGroups.map((g) => (
            <div
              key={g.key}
              className="flex flex-col gap-2 p-3 rounded-xl bg-secondary/30 border border-border/30 hover:border-border/60 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{g.config.icon}</span>
                  <span className="text-xs font-bold text-foreground truncate">{g.config.name}</span>
                </div>
                <span className="text-xs font-black tabular-nums text-foreground">
                  {g.weightPct.toFixed(1)}%
                </span>
              </div>

              <div className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(g.weightPct, 4)}%`, backgroundColor: g.config.color }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                <span className="truncate">
                  {g.assets.map((a) => a.label).join(", ")}
                </span>
                <span className="font-bold tabular-nums shrink-0 ml-1">
                  {dispSym}{g.totalDisp.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
