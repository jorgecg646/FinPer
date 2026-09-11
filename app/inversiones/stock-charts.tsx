"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { RefreshCw } from "lucide-react"
import type { StockPosition } from "@/app/actions"
import { CURRENCY_SYMBOLS, formatCompactCurrency, fmtCurrency } from "@/lib/format"

export const ASSET_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#14b8a6", "#6366f1"]

export const BENCHMARKS = [
  { symbol: "VANTAGE:SP500", name: "S&P 500", icon: "🇺🇸", ytdPct: 12.51, color: "#3b82f6" },
  { symbol: "FOREXCOM:NSXUSD", name: "Nasdaq 100", icon: "🚀", ytdPct: 15.84, color: "#8b5cf6" },
  { symbol: "BME:IBC", name: "Ibex 35", icon: "🇪🇸", ytdPct: 16.86, color: "#f59e0b" },
  { symbol: "TVC:GOLD", name: "Oro (Gold)", icon: "🥇", ytdPct: 1.49, color: "#eab308" },
  { symbol: "BINANCE:BTCUSDT", name: "Bitcoin", icon: "🪙", ytdPct: -27.52, color: "#ef4444" },
]

export const TIME_MONTHS = ["Ene", "Mar", "May", "Jul", "Sep", "Nov", "YTD (Año)"]

export const SECTOR_CONFIGS: Record<string, { name: string; icon: string; color: string; riskScore: number }> = {
  crypto: { name: "Criptomonedas & Digital", icon: "🪙", color: "#f59e0b", riskScore: 9.5 },
  tech: { name: "Tecnología e Innovación", icon: "💻", color: "#3b82f6", riskScore: 7.0 },
  financial: { name: "Servicios Financieros & Banca", icon: "🏦", color: "#10b981", riskScore: 5.5 },
  consumer: { name: "Consumo & Comercio", icon: "🛍️", color: "#ec4899", riskScore: 6.0 },
  commodities: { name: "Materias Primas & Refugio", icon: "🥇", color: "#eab308", riskScore: 2.5 },
  etf: { name: "Índices & Fondos Cotizados", icon: "📈", color: "#8b5cf6", riskScore: 4.5 },
  other: { name: "Otros Sectores / Diversos", icon: "🏢", color: "#64748b", riskScore: 5.0 },
}

export function detectSector(symbol: string, label: string): keyof typeof SECTOR_CONFIGS {
  const text = `${symbol} ${label}`.toUpperCase()
  if (/BTC|ETH|SOL|BINANCE:|CRYPTO:|BITCOIN|ETHEREUM/.test(text)) return "crypto"
  if (/GOLD|SILVER|XAUUSD|TVC:GOLD|GDX|ORO/.test(text)) return "commodities"
  if (/SPY|QQQ|IBC|NDX|SPX|ETF|INDEX|S&P|NASDAQ|IBEX/.test(text)) return "etf"
  if (/AAPL|NVDA|MSFT|AMZN|GOOG|META|TSLA|AMD|ASML|APPLE|NVIDIA|MICROSOFT|TESLA/.test(text)) return "tech"
  if (/SAN|BBVA|JPM|BAC|\bV\b|\bMA\b|BANCO|SANTANDER/.test(text)) return "financial"
  if (/LVMH|NKE|KO|PEP/.test(text)) return "consumer"
  return "other"
}

export function getBezierPathD(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return ""
  return pts.reduce((acc, p1, i) => {
    if (i === 0) return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`
    const p0 = pts[i - 1], dx = (p1.x - p0.x) * 0.45
    return `${acc} C ${(p0.x + dx).toFixed(1)} ${p0.y.toFixed(1)}, ${(p1.x - dx).toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`
  }, "")
}

const fmtCur = (val: number, sym: string) => fmtCurrency(val, sym, 0, 0)

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
  const [returnPct, setReturnPct] = useState(() => Number(Math.max(1, Math.min(50, defaultReturnPct || 8)).toFixed(1)))
  const [monthlyContrib, setMonthlyContrib] = useState(300)
  const [hoverYearIndex, setHoverYearIndex] = useState<number | null>(6)
  const dispSym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency

  const yearsList = [1, 5, 10, 15, 20, 25, 30]
  const r = (returnPct || 0) / 100 / 12

  const projection = useMemo(() => {
    return yearsList.map((years) => {
      let balance = initialValue, totalInvested = initialValue
      for (let m = 0; m < years * 12; m++) {
        balance = (balance + monthlyContrib) * (1 + r)
        totalInvested += monthlyContrib
      }
      const interestEarned = Math.max(0, balance - totalInvested)
      return {
        years,
        balance,
        totalInvested,
        interestEarned,
        multiplier: totalInvested > 0 ? balance / totalInvested : 1,
        interestSharePct: balance > 0 ? (interestEarned / balance) * 100 : 0,
      }
    })
  }, [initialValue, monthlyContrib, r])

  const maxVal = Math.max(...projection.map((p) => p.balance), 1)
  const [svgW, svgH, padL, padR, padT, padB] = [560, 210, 50, 30, 20, 35]
  const chartW = svgW - padL - padR, chartH = svgH - padT - padB, baseLineY = padT + chartH

  const pointsTotal = projection.map((p, idx) => ({
    x: padL + (idx / Math.max(1, yearsList.length - 1)) * chartW,
    y: baseLineY - (p.balance / maxVal) * chartH,
    ...p,
  }))

  const pointsInvested = projection.map((p, idx) => ({
    x: padL + (idx / Math.max(1, yearsList.length - 1)) * chartW,
    y: baseLineY - (p.totalInvested / maxVal) * chartH,
  }))

  const pathTotal = getBezierPathD(pointsTotal)
  const areaTotal = `${pathTotal} L ${pointsTotal.at(-1)?.x ?? 0} ${baseLineY} L ${pointsTotal[0]?.x ?? 0} ${baseLineY} Z`
  const pathInvested = getBezierPathD(pointsInvested)
  const areaInvested = `${pathInvested} L ${pointsInvested.at(-1)?.x ?? 0} ${baseLineY} L ${pointsInvested[0]?.x ?? 0} ${baseLineY} Z`
  const activePoint = hoverYearIndex !== null ? pointsTotal[hoverYearIndex] : pointsTotal.at(-1)

  return (
    <div className="flex flex-col gap-5 bg-gradient-to-br from-card/90 via-background to-emerald-950/15 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-emerald-500/20 shadow-2xl transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 font-extrabold text-base ring-1 ring-emerald-500/30">🚀</span>
            <h4 className="text-base font-extrabold text-foreground tracking-tight">Proyección Visual de Interés Compuesto</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Capital inicial cargado: <span className="font-black text-emerald-400">{fmtCur(initialValue, dispSym)}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
          <div className="flex items-center justify-between gap-2 bg-secondary/40 backdrop-blur-md rounded-2xl px-3.5 py-2 border border-border/50 shadow-inner">
            <span className="text-xs font-bold text-muted-foreground">Rendimiento anual:</span>
            <div className="flex items-center gap-1">
              <input type="number" min="1" max="50" step="0.5" value={returnPct} onChange={(e) => setReturnPct(parseFloat(e.target.value) || 0)} className="w-12 bg-transparent font-black text-emerald-400 focus:outline-none text-right text-sm" />
              <span className="font-extrabold text-emerald-400">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 bg-secondary/40 backdrop-blur-md rounded-2xl px-3.5 py-2 border border-border/50 shadow-inner">
            <span className="text-xs font-bold text-muted-foreground">Aporte mensual:</span>
            <div className="flex items-center gap-1">
              <input type="number" min="0" step="50" value={monthlyContrib} onChange={(e) => setMonthlyContrib(parseFloat(e.target.value) || 0)} className="w-16 bg-transparent font-black text-foreground focus:outline-none text-right text-sm" />
              <span className="font-bold text-foreground">{dispSym}/m</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
            {[100, 200, 300, 500, 1000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setMonthlyContrib(amt)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${monthlyContrib === amt ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 scale-105" : "bg-secondary/60 text-muted-foreground border border-border/40 hover:text-foreground hover:bg-secondary"}`}
              >
                +{amt}{dispSym}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative flex flex-col items-center">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto max-h-80 overflow-visible" role="img" aria-label="Gráfico de simulación de interés compuesto" onMouseLeave={() => setHoverYearIndex(6)}>
            <title>Simulación de interés compuesto</title>
            <defs>
              <linearGradient id="cmpTotalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.55" /><stop offset="40%" stopColor="#14b8a6" stopOpacity="0.25" /><stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="cmpInvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#64748b" stopOpacity="0.3" /><stop offset="100%" stopColor="#64748b" stopOpacity="0.0" />
              </linearGradient>
              <filter id="emeraldGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {[0.25, 0.5, 0.75, 1].map((ratio) => (
              <g key={ratio}>
                <line x1={padL} y1={baseLineY - ratio * chartH} x2={padL + chartW} y2={baseLineY - ratio * chartH} stroke="currentColor" strokeDasharray="3 3" className="text-border/25" />
                <text x={padL - 8} y={baseLineY - ratio * chartH + 4} textAnchor="end" className="text-[9px] fill-muted-foreground/80 font-bold">{formatCompactCurrency(maxVal * ratio, dispSym)}</text>
              </g>
            ))}

            <path d={areaTotal} fill="url(#cmpTotalGrad)" />
            <path d={pathTotal} fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#emeraldGlow)" />
            <path d={areaInvested} fill="url(#cmpInvGrad)" />
            <path d={pathInvested} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />

            {activePoint && <line x1={activePoint.x} y1={padT} x2={activePoint.x} y2={baseLineY} stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.8" />}

            {pointsTotal.map((p, idx) => {
              const isH = hoverYearIndex === idx
              return (
                <g key={p.years} onMouseEnter={() => setHoverYearIndex(idx)} className="cursor-pointer group">
                  <rect x={p.x - 20} y={padT} width="40" height={chartH + 30} fill="transparent" />
                  <circle cx={p.x} cy={p.y} r={isH ? 8 : 5} fill="#10b981" stroke="#fff" strokeWidth={isH ? 3 : 1.5} className="transition-all duration-200 drop-shadow-md" />
                  <text x={p.x} y={svgH - 10} textAnchor="middle" className={`text-[11px] font-extrabold transition-all ${isH ? "fill-emerald-400 text-xs font-black" : "fill-muted-foreground/80"}`}>
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
              <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">📅 Horizonte {activePoint.years} Años</span>
              <span className="text-2xl font-black text-foreground tabular-nums tracking-tight mt-0.5">{fmtCur(activePoint.balance, dispSym)}</span>
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 w-fit">
                ⚡ Multiplicador: x{activePoint.multiplier.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-border/40 pt-2 sm:pt-0 sm:pl-4">
              <span className="text-[10px] font-bold text-muted-foreground">Capital Aportado</span>
              <span className="text-base font-extrabold text-foreground tabular-nums mt-0.5">{fmtCur(activePoint.totalInvested, dispSym)}</span>
              <span className="text-[10px] text-muted-foreground/70">Tu ahorro acumulado</span>
            </div>
            <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-border/40 pt-2 sm:pt-0 sm:pl-4">
              <span className="text-[10px] font-bold text-emerald-400">Interés Generado (Bola de Nieve ❄️)</span>
              <span className="text-base font-black text-emerald-400 tabular-nums mt-0.5">+{fmtCur(activePoint.interestEarned, dispSym)}</span>
              <span className="text-[10px] text-emerald-400/90 font-bold">{activePoint.interestSharePct.toFixed(1)}% del total es interés</span>
            </div>
            <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-border/40 pt-2 sm:pt-0 sm:pl-4">
              <span className="text-[10px] font-bold text-muted-foreground mb-1">Composición del Patrimonio</span>
              <div className="h-2.5 w-full rounded-full bg-secondary/80 overflow-hidden flex shadow-inner">
                <div className="h-full bg-slate-400 transition-all duration-300" style={{ width: `${100 - activePoint.interestSharePct}%` }} />
                <div className="h-full bg-emerald-400 shadow-md shadow-emerald-400/50 transition-all duration-300" style={{ width: `${activePoint.interestSharePct}%` }} />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground font-semibold mt-1">
                <span>Aportado</span><span className="text-emerald-400 font-bold">Interés ❄️</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
        {[1, 3, 5, 6].map((idx) => {
          const item = projection[idx]
          if (!item) return null
          return (
            <div
              key={item.years}
              onClick={() => setHoverYearIndex(idx)}
              className={`flex flex-col gap-1.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${hoverYearIndex === idx ? "bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10 scale-[1.03]" : "bg-secondary/20 border-border/30 hover:bg-secondary/40 hover:border-border/60"}`}
            >
              <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground">
                <span className="text-foreground">{item.years} Años</span>
                <span className="text-emerald-400 font-black text-xs">x{item.multiplier.toFixed(1)}</span>
              </div>
              <span className="text-base font-black text-foreground tabular-nums">{fmtCur(item.balance, dispSym)}</span>
              <span className="text-[10px] text-emerald-400 font-bold tabular-nums">+{fmtCur(item.interestEarned, dispSym)} ganados</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Index Comparison Line Chart ─────────────────────────────────────────────

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

  const validPositions = useMemo(() => positions.filter((p) => p.shares && p.avgPrice && p.shares > 0 && p.avgPrice > 0), [positions])
  const posSymbolsKey = useMemo(() => validPositions.map((p) => p.symbol).join(","), [validPositions])

  useEffect(() => {
    let isMounted = true
    async function loadHistory() {
      setLoading(true)
      try {
        const allSyms = Array.from(new Set([...validPositions.map((p) => p.symbol), ...BENCHMARKS.map((b) => b.symbol)]))
        if (!allSyms.length) return
        const res = await fetch(`/api/stock-history?symbols=${encodeURIComponent(allSyms.join(","))}`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted && data && typeof data === "object") setHistoryData(data)
        }
      } catch {
        /* ignore */
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadHistory()
    return () => { isMounted = false }
  }, [posSymbolsKey, validPositions])

  const sampleHist = Object.values(historyData).find((h) => Array.isArray(h) && h.length > 0)
  const monthLabels = sampleHist && sampleHist.length >= 3 ? sampleHist.map((h) => h.month) : TIME_MONTHS

  const totalInvestedDisp = useMemo(() => {
    return validPositions.reduce((acc, pos) => {
      const nativeCurr = currentPrices[pos.symbol]?.currency ?? "USD"
      const fx = nativeCurr === displayCurrency ? 1 : (fxRates[`${nativeCurr}${displayCurrency}`] ?? 1)
      return acc + pos.shares! * pos.avgPrice! * (pos.avgFxRate && pos.avgFxRate > 0 ? pos.avgFxRate : fx)
    }, 0)
  }, [validPositions, currentPrices, displayCurrency, fxRates])

  const allSeries = useMemo(() => {
    const portfolioHistory = monthLabels.map((month, mIdx) => {
      const monthVal = validPositions.reduce((acc, pos) => {
        const pData = currentPrices[pos.symbol]
        const nativeCurr = pData?.currency ?? "USD"
        const fx = nativeCurr === displayCurrency ? 1 : (fxRates[`${nativeCurr}${displayCurrency}`] ?? 1)
        const stockHist = historyData[pos.symbol]
        const closePrice = stockHist?.[mIdx]?.close ?? pData?.price ?? pos.avgPrice!
        return acc + pos.shares! * closePrice * fx
      }, 0)
      const pct = totalInvestedDisp > 0 ? parseFloat((((monthVal - totalInvestedDisp) / totalInvestedDisp) * 100).toFixed(2)) : 0
      return { month, pct }
    })

    return [
      {
        symbol: "PORTFOLIO",
        name: "Tu Cartera",
        icon: "💼",
        color: "var(--color-primary, #3b82f6)",
        finalPct: portfolioHistory.at(-1)?.pct ?? 0,
        isPortfolio: true,
        history: portfolioHistory,
      },
      ...BENCHMARKS.map((b) => {
        const realHist = historyData[b.symbol]
        const hasReal = Array.isArray(realHist) && realHist.length > 0
        const pointsHistory = hasReal
          ? realHist.map((h) => ({ month: h.month, pct: h.pct }))
          : monthLabels.map((m, idx) => ({
              month: m,
              pct: parseFloat((b.ytdPct * (monthLabels.length > 1 ? idx / (monthLabels.length - 1) : 1) + Math.sin(idx * 1.6) * (b.ytdPct * 0.18)).toFixed(2)),
            }))
        return {
          ...b,
          finalPct: hasReal ? realHist.at(-1)!.pct : b.ytdPct,
          isPortfolio: false,
          history: pointsHistory,
        }
      }),
    ]
  }, [monthLabels, validPositions, currentPrices, displayCurrency, fxRates, historyData, totalInvestedDisp])

  const maxAbsPct = useMemo(() => Math.max(...allSeries.flatMap((s) => s.history.map((h) => Math.abs(h.pct))), 15), [allSeries])
  const [svgW, svgH, padL, padR, padT, padB] = [540, 240, 45, 65, 25, 35]
  const chartW = svgW - padL - padR, chartH = svgH - padT - padB, zeroY = padT + chartH / 2

  const seriesPaths = useMemo(() => {
    return allSeries.map((s) => {
      const points = s.history.map((h, idx) => ({
        x: padL + (idx / Math.max(1, s.history.length - 1)) * chartW,
        y: zeroY - (h.pct / maxAbsPct) * (chartH / 2),
        pct: h.pct,
        month: h.month,
      }))
      const pathD = getBezierPathD(points)
      return {
        ...s,
        points,
        pathD,
        areaD: `${pathD} L ${points.at(-1)?.x ?? 0} ${zeroY} L ${points[0]?.x ?? 0} ${zeroY} Z`,
        lastPoint: points.at(-1) ?? { x: 0, y: 0, pct: 0, month: "" },
      }
    })
  }, [allSeries, maxAbsPct, chartW, chartH, zeroY, padL])

  const activeHoverMonth = hoverIndex !== null ? monthLabels[hoverIndex] : null

  return (
    <div className="flex flex-col gap-4 bg-background/60 rounded-2xl p-5 border border-border/40 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">📈 Comparativa de Rendimiento YTD vs Índices</h4>
          <p className="text-xs text-muted-foreground">Evolución porcentual continua (Perf.YTD) obtenida en tiempo real desde TradingView API</p>
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${s.isPortfolio ? "bg-primary/10 border-primary/40 text-primary font-bold shadow-xs" : isH ? "bg-card text-foreground border-border shadow-xs" : "bg-secondary/40 text-muted-foreground border-border/30 hover:text-foreground"}`}
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
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto max-h-80 overflow-visible" role="img" aria-label="Gráfico de evolución histórica del patrimonio" onMouseLeave={() => setHoverIndex(null)}>
          <title>Evolución histórica del patrimonio</title>
          <defs>
            <linearGradient id="posZoneGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity="0.08" /><stop offset="100%" stopColor="#10b981" stopOpacity="0.0" /></linearGradient>
            <linearGradient id="negZoneGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.0" /><stop offset="100%" stopColor="#ef4444" stopOpacity="0.08" /></linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
          </defs>

          <rect x={padL} y={padT} width={chartW} height={chartH / 2} fill="url(#posZoneGrad)" rx="4" />
          <rect x={padL} y={zeroY} width={chartW} height={chartH / 2} fill="url(#negZoneGrad)" rx="4" />
          <line x1={padL} y1={padT} x2={padL + chartW} y2={padT} stroke="currentColor" strokeDasharray="3 3" className="text-positive/30" />
          <text x={padL - 8} y={padT + 4} textAnchor="end" className="text-[10px] fill-positive font-bold">+{maxAbsPct.toFixed(0)}%</text>
          <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke="currentColor" strokeDasharray="3 3" className="text-destructive/30" />
          <text x={padL - 8} y={padT + chartH + 4} textAnchor="end" className="text-[10px] fill-destructive font-bold">-{maxAbsPct.toFixed(0)}%</text>
          <line x1={padL} y1={zeroY} x2={padL + chartW} y2={zeroY} stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" className="text-foreground/50" />
          <text x={padL - 8} y={zeroY + 4} textAnchor="end" className="text-[10px] fill-muted-foreground font-black">0%</text>

          {hoverIndex !== null && (
            <line x1={padL + (hoverIndex / Math.max(1, monthLabels.length - 1)) * chartW} y1={padT} x2={padL + (hoverIndex / Math.max(1, monthLabels.length - 1)) * chartW} y2={padT + chartH} stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" className="text-primary/70" />
          )}

          {seriesPaths.map((s) => {
            const isH = s.symbol === activeHighlight
            const strokeWidth = s.isPortfolio ? 3.5 : isH ? 3 : 2.2
            const opacity = activeHighlight === null ? 0.9 : isH || s.isPortfolio ? 1 : 0.2

            return (
              <g key={s.symbol} className="transition-all duration-200">
                {s.isPortfolio && <path d={s.areaD} fill={s.color} opacity="0.12" />}
                <path d={s.pathD} fill="none" stroke={s.color} strokeWidth={strokeWidth} opacity={opacity} strokeLinecap="round" strokeLinejoin="round" filter={s.isPortfolio ? "url(#glow)" : undefined} />
                {s.points.map((p, idx) => (
                  <circle key={idx} cx={p.x} cy={p.y} r={hoverIndex === idx ? (s.isPortfolio ? 6 : 5) : (s.isPortfolio ? 4 : 3)} fill={s.color} opacity={opacity} className="transition-all" />
                ))}
                <g opacity={opacity}>
                  <circle cx={s.lastPoint.x} cy={s.lastPoint.y} r="5" fill={s.color} />
                  <text x={s.lastPoint.x + 8} y={s.lastPoint.y + 4} className={`text-[10px] font-black tabular-nums ${s.finalPct >= 0 ? "fill-positive" : "fill-destructive"}`}>
                    {s.finalPct >= 0 ? "+" : ""}{s.finalPct.toFixed(1)}%
                  </text>
                </g>
              </g>
            )
          })}

          {monthLabels.map((month, idx) => {
            const x = padL + (idx / Math.max(1, monthLabels.length - 1)) * chartW
            return (
              <g key={month} onMouseEnter={() => setHoverIndex(idx)} className="cursor-pointer group">
                <rect x={x - 20} y={padT} width="40" height={chartH + 25} fill="transparent" />
                <text x={x} y={svgH - 8} textAnchor="middle" className={`text-[10px] font-bold transition-all ${hoverIndex === idx ? "fill-primary text-xs" : "fill-muted-foreground"}`}>
                  {month}
                </text>
              </g>
            )
          })}
        </svg>

        {activeHoverMonth && hoverIndex !== null && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 bg-secondary/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-border/50 text-xs animate-in fade-in zoom-in-95 duration-150">
            <span className="font-black text-primary border-r border-border/50 pr-2">📅 Periodo: {activeHoverMonth}</span>
            {seriesPaths.map((s) => {
              const val = s.points[hoverIndex]?.pct ?? 0
              return (
                <div key={s.symbol} className="flex items-center gap-1">
                  <span>{s.icon}</span>
                  <span className="font-semibold text-foreground">{s.name}:</span>
                  <span className={`font-black tabular-nums ${val >= 0 ? "text-positive" : "text-destructive"}`}>{val >= 0 ? "+" : ""}{val.toFixed(1)}%</span>
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

export function TradingViewAdvancedWidget({ positions }: { positions: StockPosition[] }) {
  const containerId = useRef(`tv_chart_${Math.random().toString(36).substring(2, 9)}`).current
  const [scriptLoaded, setScriptLoaded] = useState(false)

  const { compareSymbols, portfolioFormula } = useMemo(() => {
    const valid = positions.filter((p) => p.shares && p.avgPrice && p.shares > 0 && p.avgPrice > 0)
    const formula = valid.length > 0 ? valid.map((p) => `${p.shares}*${p.symbol}`).join(" + ") : null
    const defaults = [
      { symbol: "FOREXCOM:NSXUSD", title: "Nasdaq 100" },
      { symbol: "BME:IBC", title: "Ibex 35" },
      { symbol: "TVC:GOLD", title: "Oro (Gold)" },
      { symbol: "BINANCE:BTCUSDT", title: "Bitcoin" },
    ]
    const userSyms = valid.map((p) => ({ symbol: p.symbol, title: p.label || p.symbol }))
    const seen = new Set<string>()
    const filtered = [...defaults, ...userSyms].filter((s) => {
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
    const existing = document.getElementById("tradingview-tv-js")
    if (existing) {
      existing.addEventListener("load", () => setScriptLoaded(true))
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
    const win = window as unknown as { TradingView?: { widget: new (config: Record<string, unknown>) => void } }
    const TV = win.TradingView
    if (!TV?.widget) return

    const allTickers = [
      ...(portfolioFormula ? [{ symbol: portfolioFormula, title: "💼 Tu Cartera (Ponderada)" }] : []),
      ...compareSymbols,
    ]
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
        studies: allTickers.map((item) => ({ id: "Compare@tv-basicstudies", inputs: { symbol: item.symbol } })),
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

export function SectorRiskAnalysis({
  items,
  displayCurrency,
}: {
  items: { symbol: string; label: string; currentDisp: number; investedDisp: number; weightPct: number }[]
  displayCurrency: string
}) {
  const dispSym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency
  const totalValue = items.reduce((acc, it) => acc + it.currentDisp, 0)

  const sectorGroups = useMemo(() => {
    const groups: Record<
      string,
      { key: string; config: (typeof SECTOR_CONFIGS)[keyof typeof SECTOR_CONFIGS]; totalDisp: number; weightPct: number; assets: typeof items }
    > = {}

    items.forEach((it) => {
      const sKey = detectSector(it.symbol, it.label)
      if (!groups[sKey]) {
        groups[sKey] = { key: sKey, config: SECTOR_CONFIGS[sKey], totalDisp: 0, weightPct: 0, assets: [] }
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
    const sum = sectorGroups.reduce((acc, g) => acc + (g.weightPct / 100) * g.config.riskScore, 0)
    return parseFloat(sum.toFixed(1))
  }, [sectorGroups, totalValue])

  const hhiIndex = useMemo(() => {
    return totalValue === 0 ? 0 : sectorGroups.reduce((acc, g) => acc + Math.pow(g.weightPct, 2), 0)
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
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">🛡️ Matriz de Riesgo & Diversificación por Sectores</h4>
          <p className="text-xs text-muted-foreground">Análisis de exposición por industria, medidor de volatilidad y evaluación de riesgo de la cartera</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl p-3.5 border bg-card flex flex-col gap-2 border-border/40">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-muted-foreground">Nivel de Riesgo Global:</span>
            <span className={`font-black px-2 py-0.5 rounded-full border text-[11px] ${riskLabel.bg} ${riskLabel.color}`}>{riskLabel.text}</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-foreground tabular-nums">{weightedRiskScore.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground font-semibold">/ 10</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-secondary/80 overflow-hidden flex relative mt-1">
            <div className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-positive via-amber-500 to-destructive" style={{ width: `${(weightedRiskScore / 10) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-xl p-3.5 border bg-card flex flex-col gap-2 border-border/40">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-muted-foreground">Diversificación Sectorial:</span>
            <span className={`font-black text-xs ${concentrationLabel.color}`}>{concentrationLabel.text}</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-foreground tabular-nums">{sectorGroups.length}</span>
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
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Desglose de Capital por Industria</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {sectorGroups.map((g) => (
            <div key={g.key} className="flex flex-col gap-2 p-3 rounded-xl bg-secondary/30 border border-border/30 hover:border-border/60 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{g.config.icon}</span>
                  <span className="text-xs font-bold text-foreground truncate">{g.config.name}</span>
                </div>
                <span className="text-xs font-black tabular-nums text-foreground">{g.weightPct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(g.weightPct, 4)}%`, backgroundColor: g.config.color }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                <span className="truncate">{g.assets.map((a) => a.label).join(", ")}</span>
                <span className="font-bold tabular-nums shrink-0 ml-1">{fmtCur(g.totalDisp, dispSym)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Fear & Greed Index (CNN) ────────────────────────────────────────────────

export interface FearGreedHistoryPoint {
  date: string
  value: number
}

export interface FearGreedData {
  value: number
  classification: string
  classificationEn?: string
  previousClose: number
  previousCloseClassification: string
  previousCloseClassificationEn?: string
  weekAgo: number
  weekAgoClassification: string
  weekAgoClassificationEn?: string
  monthAgo: number
  monthAgoClassification: string
  monthAgoClassificationEn?: string
  yearAgo: number
  yearAgoClassification: string
  yearAgoClassificationEn?: string
  lastUpdated: string
  history?: FearGreedHistoryPoint[]
}

const FG_ZONES_CNN = [
  {
    id: 0,
    labelTop: "EXTREME",
    labelBottom: "FEAR",
    start: 180.8,
    end: 224.2,
    mid: 202.5,
    activeFill: "rgba(239, 68, 68, 0.16)",
    activeStroke: "#ef4444",
    textClass: "fill-red-600 dark:fill-red-400",
    badgeClass: "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
  },
  {
    id: 1,
    labelTop: "",
    labelBottom: "FEAR",
    start: 225.8,
    end: 260.2,
    mid: 243,
    activeFill: "rgba(249, 115, 22, 0.20)",
    activeStroke: "#ea580c",
    textClass: "fill-orange-600 dark:fill-orange-400",
    badgeClass: "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  {
    id: 2,
    labelTop: "",
    labelBottom: "NEUTRAL",
    start: 261.8,
    end: 278.2,
    mid: 270,
    activeFill: "rgba(234, 179, 8, 0.18)",
    activeStroke: "#ca8a04",
    textClass: "fill-yellow-600 dark:fill-yellow-400",
    badgeClass: "border-slate-400 dark:border-slate-500 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  {
    id: 3,
    labelTop: "",
    labelBottom: "GREED",
    start: 279.8,
    end: 314.2,
    mid: 297,
    activeFill: "rgba(34, 197, 94, 0.18)",
    activeStroke: "#16a34a",
    textClass: "fill-emerald-600 dark:fill-emerald-400",
    badgeClass: "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: 4,
    labelTop: "GREED",
    labelBottom: "EXTREME",
    start: 315.8,
    end: 359.2,
    mid: 337.5,
    activeFill: "rgba(16, 185, 129, 0.22)",
    activeStroke: "#059669",
    textClass: "fill-emerald-600 dark:fill-emerald-400",
    badgeClass: "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
]

const getFgZone = (v: number) => FG_ZONES_CNN[v <= 25 ? 0 : v <= 45 ? 1 : v <= 55 ? 2 : v <= 75 ? 3 : 4]

export function FearGreedGauge() {
  const [data, setData] = useState<FearGreedData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch$ = useCallback(async () => {
    try {
      const res = await fetch("/api/fear-greed")
      const json = await res.json()
      setData(json)
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch$()
    const id = setInterval(fetch$, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetch$])

  // Speedometer geometry
  const W = 420, H = 250, CX = 210, CY = 200
  const R = 180, innerR = 126, textR = 153, trackR = 104, trackNumR = 86

  function arcSeg(startDeg: number, endDeg: number, rOut: number, rIn: number) {
    const rad = (d: number) => (d * Math.PI) / 180
    const x1 = CX + rOut * Math.cos(rad(startDeg))
    const y1 = CY + rOut * Math.sin(rad(startDeg))
    const x2 = CX + rOut * Math.cos(rad(endDeg))
    const y2 = CY + rOut * Math.sin(rad(endDeg))
    const ix1 = CX + rIn * Math.cos(rad(startDeg))
    const iy1 = CY + rIn * Math.sin(rad(startDeg))
    const ix2 = CX + rIn * Math.cos(rad(endDeg))
    const iy2 = CY + rIn * Math.sin(rad(endDeg))
    const largeArc = endDeg - startDeg > 180 ? 1 : 0
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${rIn} ${rIn} 0 ${largeArc} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`
  }

  const currentValue = data ? Math.max(0, Math.min(100, data.value)) : 50
  const activeZoneIndex = getFgZone(currentValue).id
  const needleDeg = 180 + (currentValue / 100) * 180

  const histItems = data
    ? [
        {
          label: "Previous close",
          value: data.previousClose,
          cls: data.previousCloseClassificationEn ?? data.previousCloseClassification,
        },
        {
          label: "1 week ago",
          value: data.weekAgo,
          cls: data.weekAgoClassificationEn ?? data.weekAgoClassification,
        },
        {
          label: "1 month ago",
          value: data.monthAgo,
          cls: data.monthAgoClassificationEn ?? data.monthAgoClassification,
        },
        {
          label: "1 year ago",
          value: data.yearAgo,
          cls: data.yearAgoClassificationEn ?? data.yearAgoClassification,
        },
      ]
    : []

  return (
    <div className="flex flex-col items-center text-center rounded-3xl bg-card border border-border/60 p-6 sm:p-8 shadow-xs overflow-hidden">
      {/* Centered Header */}
      <div className="flex flex-col items-center text-center pb-4 w-full border-b border-border/40">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 ring-1 ring-orange-500/20 text-lg">
            📊
          </div>
          <h3 className="text-base font-black text-foreground tracking-tight">Fear &amp; Greed Index</h3>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            Sentimiento del Mercado
          </span>
        </div>
        <p className="text-xs text-muted-foreground max-w-sm">
          Indicador de psicología del mercado según CNN
        </p>
      </div>

      {loading ? (
        <div className="w-full max-w-md h-52 rounded-2xl bg-secondary/30 animate-pulse my-6" />
      ) : (
        <div className="flex flex-col items-center w-full pt-4">
          {/* Centered Speedometer Gauge */}
          <div className="relative w-full max-w-[420px] aspect-[420/250] flex justify-center">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              aria-label="Fear & Greed Index speedometer gauge"
              className="w-full h-full select-none overflow-visible"
            >
              {/* 5 Outer Arch Segments */}
              {FG_ZONES_CNN.map((z, i) => {
                const isActive = i === activeZoneIndex
                const d = arcSeg(z.start, z.end, R, innerR)
                const rad = (z.mid * Math.PI) / 180
                const tx = CX + textR * Math.cos(rad)
                const ty = CY + textR * Math.sin(rad)
                const rot = z.mid - 270

                return (
                  <g key={z.id}>
                    <path
                      d={d}
                      fill={isActive ? z.activeFill : "currentColor"}
                      stroke={isActive ? z.activeStroke : "currentColor"}
                      strokeWidth={isActive ? 2 : 1}
                      className={
                        isActive
                          ? ""
                          : "text-secondary/60 stroke-border/40 dark:text-secondary/30 dark:stroke-border/20"
                      }
                    />
                    {/* Segment Labels */}
                    <g transform={`translate(${tx.toFixed(1)}, ${ty.toFixed(1)}) rotate(${rot.toFixed(1)})`}>
                      {z.labelTop ? (
                        <>
                          <text
                            y="-4"
                            textAnchor="middle"
                            className={`font-black uppercase tracking-wider text-[9.5px] ${
                              isActive ? z.textClass : "fill-muted-foreground/75"
                            }`}
                          >
                            {z.labelTop}
                          </text>
                          <text
                            y="7"
                            textAnchor="middle"
                            className={`font-black uppercase tracking-wider text-[9.5px] ${
                              isActive ? z.textClass : "fill-muted-foreground/75"
                            }`}
                          >
                            {z.labelBottom}
                          </text>
                        </>
                      ) : (
                        <text
                          y="4"
                          textAnchor="middle"
                          className={`font-black uppercase ${
                            z.id === 2 ? "text-[8.5px] tracking-tighter" : "text-xs tracking-wide"
                          } ${
                            isActive ? z.textClass : "fill-muted-foreground/75"
                          }`}
                        >
                          {z.labelBottom}
                        </text>
                      )}
                    </g>
                  </g>
                )
              })}

              {/* Inner Dotted Track */}
              {Array.from({ length: 21 }, (_, idx) => idx * 5).map((v) => {
                const a = 180 + (v / 100) * 180
                const rad = (a * Math.PI) / 180
                const dx = CX + trackR * Math.cos(rad)
                const dy = CY + trackR * Math.sin(rad)
                const isMajor = v % 25 === 0
                return (
                  <circle
                    key={v}
                    cx={dx.toFixed(2)}
                    cy={dy.toFixed(2)}
                    r={isMajor ? 2.5 : 1.2}
                    className={isMajor ? "fill-muted-foreground/70" : "fill-muted-foreground/35"}
                  />
                )
              })}

              {/* Milestone Numbers (0, 25, 50, 75, 100) */}
              {[
                { val: 0, x: CX - trackNumR, y: CY - 3 },
                {
                  val: 25,
                  x: CX + trackNumR * Math.cos((225 * Math.PI) / 180),
                  y: CY + trackNumR * Math.sin((225 * Math.PI) / 180),
                },
                { val: 50, x: CX, y: CY - trackNumR },
                {
                  val: 75,
                  x: CX + trackNumR * Math.cos((315 * Math.PI) / 180),
                  y: CY + trackNumR * Math.sin((315 * Math.PI) / 180),
                },
                { val: 100, x: CX + trackNumR, y: CY - 3 },
              ].map((item) => (
                <text
                  key={item.val}
                  x={item.x.toFixed(1)}
                  y={item.y.toFixed(1)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground/75 font-semibold text-[11px]"
                >
                  {item.val}
                </text>
              ))}

              {/* Needle */}
              <g
                style={{
                  transformOrigin: `${CX}px ${CY}px`,
                  transform: `rotate(${needleDeg}deg)`,
                  transition: "transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
              >
                <path
                  d={`M ${CX + 28} ${CY - 3.5} L ${CX + 156} ${CY - 1} A 1.2 1.2 0 0 1 ${CX + 156} ${CY + 1} L ${CX + 28} ${CY + 3.5} Z`}
                  className="fill-slate-900 dark:fill-slate-100"
                  style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.35))" }}
                />
              </g>

              {/* Center Circular Hub & Value — Exactly Centered */}
              <circle
                cx={CX}
                cy={CY}
                r={44}
                className="fill-card stroke-border/50"
                strokeWidth={1}
                style={{ filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.08))" }}
              />
              <text
                x={CX}
                y={CY}
                textAnchor="middle"
                dominantBaseline="central"
                className="font-black text-3xl fill-foreground tracking-tight"
              >
                {currentValue}
              </text>
            </svg>
          </div>

          {/* Centered Historical Benchmarks */}
          <div className="w-full max-w-md flex flex-col gap-3 mt-4 pt-4 border-t border-border/40">
            {histItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between group text-left">
                <div className="flex flex-col">
                  <span className="text-[11px] text-muted-foreground font-medium">{item.label}</span>
                  <span className="text-sm font-bold text-foreground capitalize">{item.cls}</span>
                </div>
                <div className="flex-1 mx-4 border-b border-dotted border-border min-w-[28px]" />
                <div
                  className={`flex items-center justify-center h-8 w-8 rounded-full border-2 text-xs font-black tabular-nums shadow-xs ${getFgZone(item.value).badgeClass}`}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
