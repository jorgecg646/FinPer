"use client"

import { useState, useEffect, useCallback, useTransition, useRef } from "react"
import nextDynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { BarChart2, Plus, Minus, Wallet } from "lucide-react"
import { upsertStockPosition, deleteStockPosition } from "@/app/actions"
import type { StockPosition } from "@/app/actions"
import { CURRENCIES, CURRENCY_SYMBOLS, DISPLAY_CURRENCY_KEY, getFxPair, fmtCurrency, fmtSignedCurrency, fmtPercent, getClientCurrency, setStoredCurrency } from "@/lib/format"
import { useVisibilityPolling } from "@/lib/hooks"
import { Pie } from "@visx/shape"
import { Group } from "@visx/group"
import {
  TickerCard,
  AddSymbolModal,
  FinancialNewsTickerBar,
  fetchQuotes,
} from "./stock-widgets"
import type { StockQuote } from "./stock-widgets"
import {
  ASSET_COLORS,
  CompoundGrowthChart,
  IndexComparisonChart,
} from "./stock-charts"
import { TradingViewIcon } from "./market-indices"

const TradingViewAdvancedWidget = nextDynamic(
  () => import("./stock-charts").then((mod) => mod.TradingViewAdvancedWidget),
  { ssr: false, loading: () => <div className="h-64 rounded-2xl bg-secondary/30 animate-pulse" /> }
)
const SpanishTaxExportCalculator = nextDynamic(
  () => import("./spanish-tax-calculator").then((mod) => mod.SpanishTaxExportCalculator),
  { ssr: false, loading: () => <div className="h-48 rounded-2xl bg-secondary/30 animate-pulse" /> }
)
const PriceAlertsMacroCalendar = nextDynamic(
  () => import("./macro-calendar-widget").then((mod) => mod.PriceAlertsMacroCalendar),
  { ssr: false, loading: () => <div className="h-48 rounded-2xl bg-secondary/30 animate-pulse" /> }
)
const SectorRiskAnalysis = nextDynamic(
  () => import("./stock-charts").then((mod) => mod.SectorRiskAnalysis),
  { ssr: false, loading: () => <div className="h-48 rounded-2xl bg-secondary/30 animate-pulse" /> }
)
const FearGreedGauge = nextDynamic(
  () => import("./stock-charts").then((mod) => mod.FearGreedGauge),
  { ssr: false, loading: () => <div className="h-64 rounded-3xl bg-secondary/30 animate-pulse" /> }
)

function PLBar({ isGain, pct, minPct = 4 }: { isGain: boolean; pct: number; minPct?: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden flex">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          isGain ? "bg-positive" : "bg-destructive"
        }`}
        style={{ width: `${Math.max(pct, minPct)}%` }}
      />
    </div>
  )
}

function PortfolioChartsPanel({
  positions,
  currentPrices,
  displayCurrency,
  fxRates,
  activeTab,
  setActiveTab,
}: {
  positions: StockPosition[]
  currentPrices: Record<string, { price: number; currency: string }>
  displayCurrency: string
  fxRates: Record<string, number>
  activeTab: "allocation" | "sector" | "index" | "compound" | "tax" | "alerts"
  setActiveTab: (tab: "allocation" | "sector" | "index" | "compound" | "tax" | "alerts") => void
}) {
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null)
  const dispSym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency

  const items = positions
    .map((pos, idx) => {
      const priceData = currentPrices[pos.symbol]
      if (
        !priceData ||
        pos.shares == null ||
        pos.avgPrice == null ||
        pos.shares <= 0 ||
        pos.avgPrice <= 0
      )
        return null

      const nativeCurr = priceData.currency
      const { currentFx, purchaseFx } = getFxPair(nativeCurr, displayCurrency, fxRates, pos.avgFxRate)

      const investedDisp = pos.shares * pos.avgPrice * purchaseFx
      const currentDisp = pos.shares * priceData.price * currentFx
      const plDisp = currentDisp - investedDisp
      const plPct = investedDisp > 0 ? (plDisp / investedDisp) * 100 : 0

      return {
        symbol: pos.symbol,
        label: pos.label,
        shares: pos.shares,
        avgPriceDisp: pos.avgPrice * purchaseFx,
        currentPriceDisp: priceData.price * currentFx,
        investedDisp,
        currentDisp,
        currentValueDisp: currentDisp,
        plDisp,
        plPct,
        color: ASSET_COLORS[idx % ASSET_COLORS.length],
      }
    })
    .filter(Boolean) as Array<{
    symbol: string
    label: string
    shares: number
    avgPriceDisp: number
    currentPriceDisp: number
    investedDisp: number
    currentDisp: number
    currentValueDisp: number
    plDisp: number
    plPct: number
    color: string
  }>

  if (items.length === 0) return null

  const totalCurrentValue = items.reduce((acc, it) => acc + it.currentDisp, 0)
  const totalInvestedValue = items.reduce((acc, it) => acc + it.investedDisp, 0)
  const totalPLDisp = totalCurrentValue - totalInvestedValue
  const totalPLPct =
    totalInvestedValue > 0 ? (totalPLDisp / totalInvestedValue) * 100 : 0

  const itemsWithWeight = items.map((it) => ({
    ...it,
    weightPct: totalCurrentValue > 0 ? (it.currentDisp / totalCurrentValue) * 100 : 0,
  }))

  let cumulativeAngle = 0
  const slices = itemsWithWeight.map((it) => {
    const sliceAngle = (it.weightPct / 100) * 360
    const startAngle = cumulativeAngle
    const endAngle = cumulativeAngle + sliceAngle
    cumulativeAngle = endAngle
    return { ...it, startAngle, endAngle }
  })

  const maxPL = Math.max(...items.map((it) => Math.abs(it.plDisp)), 1)
  const activeItem = itemsWithWeight.find((it) => it.symbol === hoveredSymbol)

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            Análisis Visual de Cartera
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            PREMIUM
          </span>
        </div>
        <div className="flex items-center gap-1 bg-muted/60 dark:bg-[#1a1c23] p-1 rounded-xl border border-border dark:border-white/[0.06] flex-wrap">
          {(
            [
              { id: "allocation", label: "📊 Distribución" },
              { id: "sector", label: "🛡️ Sectores" },
              { id: "alerts", label: "🔔 Alertas & Macro" },
              { id: "index", label: "📈 Comparativa" },
              { id: "compound", label: "🚀 Interés Compuesto" },
              { id: "tax", label: "🇪🇸 Fiscalidad" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer text-[11px] flex-1 sm:flex-initial text-center ${
                activeTab === tab.id
                  ? "bg-card dark:bg-[#252833] text-foreground shadow-xs border border-border dark:border-white/[0.1]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Allocation Donut & Horizontal P&L Bar Chart */}
      {activeTab === "allocation" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center animate-in fade-in duration-150">
          <div className="flex flex-col bg-card rounded-xl p-4 border border-border gap-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Allocation · Activos
              </span>
              {activeItem && (
                <span className="text-xs font-bold text-emerald-500 truncate max-w-[160px] tabular-nums">
                  {activeItem.label} ({activeItem.weightPct.toFixed(1)}%)
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="relative shrink-0 flex justify-center items-center">
                <svg width={170} height={170} viewBox="0 0 170 170" className="overflow-visible">
                  <Group top={85} left={85}>
                    <Pie
                      data={itemsWithWeight}
                      pieValue={(d) => d.currentDisp}
                      outerRadius={75}
                      innerRadius={52}
                      padAngle={0.03}
                      cornerRadius={4}
                    >
                      {(pie) =>
                        pie.arcs.map((arc, i) => {
                          const isH = arc.data.symbol === hoveredSymbol
                          const arcPath = pie.path(arc) ?? ""
                          return (
                            <path
                              key={arc.data.symbol || i}
                              d={arcPath}
                              fill={arc.data.color}
                              opacity={hoveredSymbol === null || isH ? 1 : 0.35}
                              className="cursor-pointer transition-all duration-200"
                              onMouseEnter={() => setHoveredSymbol(arc.data.symbol)}
                              onMouseLeave={() => setHoveredSymbol(null)}
                            />
                          )
                        })
                      }
                    </Pie>
                    <text x={0} y={-8} textAnchor="middle" fill="var(--muted-foreground)" fontSize={9.5} fontWeight={600} className="uppercase tracking-wider">
                      {hoveredSymbol && activeItem ? activeItem.label : "Total Cartera"}
                    </text>
                    <text x={0} y={14} textAnchor="middle" fill="var(--foreground)" fontSize={16} fontWeight={800} className="tabular-nums">
                      {fmtCurrency(hoveredSymbol && activeItem ? activeItem.currentDisp : totalCurrentValue, dispSym, 0, 0)}
                    </text>
                  </Group>
                </svg>
              </div>

              <div className="flex flex-col gap-1.5 w-full overflow-y-auto max-h-40 pr-1">
                {itemsWithWeight.map((it) => (
                  <div
                    key={it.symbol}
                    onMouseEnter={() => setHoveredSymbol(it.symbol)}
                    onMouseLeave={() => setHoveredSymbol(null)}
                    className={`flex items-center justify-between text-xs p-1.5 rounded-lg transition-colors cursor-pointer ${
                      it.symbol === hoveredSymbol ? "bg-muted dark:bg-[#252833] border border-border dark:border-white/[0.08]" : "hover:bg-muted/50 dark:hover:bg-[#1a1c23]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: it.color }} />
                      <span className="font-semibold text-foreground truncate text-[11px]">{it.label}</span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums text-[11px]">
                      <span className="font-medium text-muted-foreground">{it.weightPct.toFixed(1)}%</span>
                      <span className="font-bold text-foreground">{fmtCurrency(it.currentDisp, dispSym, 0, 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 bg-card rounded-xl p-4 border border-border h-full justify-center">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/[0.06] pb-2">
              Rentabilidad por Posición ({dispSym})
            </p>

            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
              {items.map((it) => {
                const isGain = it.plDisp >= 0
                const barPct = (Math.abs(it.plDisp) / maxPL) * 100
                return (
                  <div key={it.symbol} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-foreground truncate">{it.label}</span>
                      <span className={`font-extrabold tabular-nums ${isGain ? "text-positive" : "text-destructive"}`}>
                        {fmtSignedCurrency(it.plDisp, dispSym)}{" "}
                        <span className="font-semibold text-[10px]">({fmtPercent(it.plPct, 2, true)})</span>
                      </span>
                    </div>
                    <PLBar isGain={isGain} pct={barPct} minPct={4} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Sector & Risk Matrix Breakdown */}
      {activeTab === "sector" && (
        <div className="animate-in fade-in duration-150">
          <SectorRiskAnalysis items={itemsWithWeight} displayCurrency={displayCurrency} />
        </div>
      )}

      {/* Tab 3: Index Comparison & Official TradingView Overlay Widget */}
      {activeTab === "index" && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-150">
          <IndexComparisonChart
            positions={positions}
            currentPrices={currentPrices}
            displayCurrency={displayCurrency}
            fxRates={fxRates}
          />

          <TradingViewAdvancedWidget positions={positions} />
        </div>
      )}

      {/* Tab 4: Compound Growth Projection */}
      {activeTab === "compound" && (
        <div className="animate-in fade-in duration-150">
          <CompoundGrowthChart
            initialValue={totalCurrentValue}
            defaultReturnPct={8}
            displayCurrency={displayCurrency}
          />
        </div>
      )}

      {/* Tab 5: Price Alerts & Macro Calendar */}
      {activeTab === "alerts" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          <PriceAlertsMacroCalendar symbols={positions.map((p) => p.symbol)} />
          <FearGreedGauge />
        </div>
      )}

      {/* Tab 7: Spanish Tax Calculator & Report Exporter */}
      {activeTab === "tax" && (
        <div className="animate-in fade-in duration-150">
          <SpanishTaxExportCalculator items={itemsWithWeight} displayCurrency={displayCurrency} />
        </div>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function StockPricesPanel({
  initialPositions,
}: {
  initialPositions: StockPosition[]
}) {
  const [positions, setPositions] = useState<StockPosition[]>(initialPositions)
  const [showModal, setShowModal] = useState(false)
  const [currentPrices, setCurrentPrices] = useState<
    Record<string, { price: number; currency: string }>
  >({})
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({})
  const [quoteStatuses, setQuoteStatuses] = useState<
    Record<string, "idle" | "loading" | "ok" | "error">
  >({})
  const [displayCurrency, setDisplayCurrency] = useState("EUR")
  const [fxRates, setFxRates] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<
    "allocation" | "sector" | "index" | "compound" | "tax" | "alerts"
  >("allocation")
  const [, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    setDisplayCurrency(getClientCurrency())
    const handleCurrencyChanged = () => {
      setDisplayCurrency(getClientCurrency())
    }
    window.addEventListener("finflow-currency-changed", handleCurrencyChanged)
    window.addEventListener("storage", handleCurrencyChanged)
    return () => {
      window.removeEventListener("finflow-currency-changed", handleCurrencyChanged)
      window.removeEventListener("storage", handleCurrencyChanged)
    }
  }, [])

  function handleCurrencyChange(code: string) {
    setDisplayCurrency(code)
    setStoredCurrency(code)
  }

  useEffect(() => {
    setPositions(initialPositions)
  }, [initialPositions])

  const handlePriceLoaded = useCallback(
    (symbol: string, price: number, currency: string) => {
      setCurrentPrices((prev) => ({ ...prev, [symbol]: { price, currency } }))
    },
    []
  )

  const positionsRef = useRef(positions)
  positionsRef.current = positions

  const fetchAllQuotes = useCallback(
    async (customSymbols?: string[]) => {
      const syms = customSymbols ?? positionsRef.current.map((p) => p.symbol)
      if (syms.length === 0) return

      setQuoteStatuses((prev) => {
        const next = { ...prev }
        syms.forEach((s) => {
          next[s] = "loading"
        })
        return next
      })

      try {
        const fetched = await fetchQuotes(syms)
        setQuotes((prev) => ({ ...prev, ...fetched }))
        setQuoteStatuses((prev) => {
          const next = { ...prev }
          syms.forEach((s) => {
            next[s] = fetched[s] ? "ok" : "error"
          })
          return next
        })

        setCurrentPrices((prev) => {
          const next = { ...prev }
          Object.entries(fetched).forEach(([sym, q]) => {
            if (q && q.price) {
              next[sym] = { price: q.price, currency: q.currency }
            }
          })
          return next
        })
      } catch {
        setQuoteStatuses((prev) => {
          const next = { ...prev }
          syms.forEach((s) => {
            next[s] = "error"
          })
          return next
        })
      }
    },
    []
  )

  const symbolsKey = positions.map((p) => p.symbol.toUpperCase()).sort().join(",")

  useEffect(() => {
    if (!symbolsKey) return
    const syms = symbolsKey.split(",").filter(Boolean)
    fetchAllQuotes(syms)
  }, [symbolsKey, fetchAllQuotes])

  useVisibilityPolling(fetchAllQuotes, 60_000, Boolean(symbolsKey))

  useEffect(() => {
    const currenciesToFetch = new Set<string>()
    Object.values(currentPrices).forEach((p) => {
      if (p.currency && p.currency !== displayCurrency) {
        currenciesToFetch.add(p.currency)
      }
    })

    currenciesToFetch.forEach(async (fromCurr) => {
      const pairKey = `${fromCurr}${displayCurrency}`
      if (fxRates[pairKey] !== undefined) return

      try {
        const res = await fetch(`/api/fx-rate?from=${fromCurr}&to=${displayCurrency}`)
        const json = await res.json()
        if (json.rate) {
          setFxRates((prev) => ({ ...prev, [pairKey]: json.rate }))
        }
      } catch {
        // ignore
      }
    })
  }, [currentPrices, displayCurrency, fxRates])

  function handleAdd(data: {
    symbol: string
    label: string
    shares?: number
    avgPrice?: number
    avgFxRate?: number
  }) {
    const newPos: StockPosition = {
      id: Date.now(),
      symbol: data.symbol.toUpperCase(),
      label: data.label,
      shares: data.shares ?? null,
      avgPrice: data.avgPrice ?? null,
      avgFxRate: data.avgFxRate ?? null,
    }
    setPositions((prev) => {
      const idx = prev.findIndex(
        (p) => p.symbol.toUpperCase() === data.symbol.toUpperCase()
      )
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], ...newPos }
        return next
      }
      return [...prev, newPos]
    })
    startTransition(async () => {
      await upsertStockPosition(data)
      router.refresh()
    })
  }

  function handleUpdate(
    symbol: string,
    label: string,
    shares: number,
    avgPrice: number,
    avgFxRate?: number
  ) {
    setPositions((prev) =>
      prev.map((p) =>
        p.symbol === symbol ? { ...p, shares, avgPrice, avgFxRate: avgFxRate ?? p.avgFxRate } : p
      )
    )
    startTransition(async () => {
      await upsertStockPosition({ symbol, label, shares, avgPrice, avgFxRate })
      router.refresh()
    })
  }

  function handleRemove(symbol: string) {
    setCurrentPrices((prev) => {
      const next = { ...prev }
      delete next[symbol]
      return next
    })
    setPositions((prev) => prev.filter((p) => p.symbol !== symbol))
    startTransition(async () => {
      await deleteStockPosition(symbol)
      router.refresh()
    })
  }

  const portfolioSummary = positions.reduce(
    (acc, pos) => {
      const priceData = currentPrices[pos.symbol]
      if (
        !priceData ||
        pos.shares == null ||
        pos.avgPrice == null ||
        pos.shares <= 0 ||
        pos.avgPrice <= 0
      )
        return acc

      const nativeCurr = priceData.currency
      const { currentFx, purchaseFx } = getFxPair(nativeCurr, displayCurrency, fxRates, pos.avgFxRate)

      const investedNative = pos.shares * pos.avgPrice
      const currentNative = pos.shares * priceData.price

      acc.invested += investedNative * purchaseFx
      acc.current += currentNative * currentFx
      acc.count++
      return acc
    },
    { invested: 0, current: 0, count: 0 }
  )

  const totalPL = portfolioSummary.current - portfolioSummary.invested
  const totalPLPct =
    portfolioSummary.invested > 0
      ? (totalPL / portfolioSummary.invested) * 100
      : 0
  const showSummary = portfolioSummary.count > 0
  const isPLPositive = totalPL >= 0
  const dispSym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency

  // Persist snapshot for the main dashboard balance banner
  useEffect(() => {
    if (portfolioSummary.count === 0) return
    try {
      localStorage.setItem(
        "finper_portfolio_snapshot",
        JSON.stringify({
          invested: portfolioSummary.invested,
          current: portfolioSummary.current,
          pl: totalPL,
          plPct: totalPLPct,
          currency: displayCurrency,
          updatedAt: Date.now(),
        })
      )
      window.dispatchEvent(new Event("portfolio-snapshot-updated"))
    } catch {
      // ignore
    }
  }, [portfolioSummary.invested, portfolioSummary.current, portfolioSummary.count, totalPL, totalPLPct, displayCurrency])

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      <FinancialNewsTickerBar />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground sm:text-base">
              Precios de Mercado en Tiempo Real
            </h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <TradingViewIcon className="h-3.5 w-3.5 text-stone-900 dark:text-white shrink-0" />
              <span>Datos vía TradingView · actualización automática cada 60 s</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-1 bg-secondary/60 border border-border rounded-full px-2.5 py-1 text-xs">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Moneda:</span>
            <select
              value={displayCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              aria-label="Seleccionar moneda de visualización"
              className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer text-xs"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-card text-foreground">
                  {c.symbol} {c.code} ({c.label})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary hover:border-primary/40 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
            <span>Añadir Símbolo</span>
          </button>
        </div>
      </div>

      {showSummary && (
        <div className="mt-4 rounded-2xl p-5 border border-border bg-card shadow-xs transition-all">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <span className="flex items-center gap-2 font-bold text-foreground">
              <Wallet className="h-4 w-4 text-emerald-500" />
              Resumen de Cartera · {portfolioSummary.count} posición{portfolioSummary.count !== 1 ? "es" : ""} activas
            </span>
            <span className="text-[10px] font-bold text-muted-foreground bg-muted dark:bg-[#20222a] px-2.5 py-0.5 rounded-md border border-border/50 dark:border-white/[0.04] w-fit">
              Moneda base: {displayCurrency} ({dispSym})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: "Capital Invertido",
                value: fmtCurrency(portfolioSummary.invested, dispSym),
              },
              {
                label: "Valor Actual Total",
                value: fmtCurrency(portfolioSummary.current, dispSym),
              },
              {
                label: "Rendimiento No Realizado",
                value: `${isPLPositive ? "↗ " : "↘ "}${fmtSignedCurrency(totalPL, dispSym)}`,
                sub: `(${fmtPercent(totalPLPct, 2, true)})`,
                valClass: isPLPositive ? "text-emerald-500" : "text-rose-500",
                subClass: isPLPositive ? "text-emerald-400" : "text-rose-400",
              },
            ].map((c, i) => (
              <div key={i} className="flex flex-col p-4 rounded-xl bg-muted/50 dark:bg-[#1a1c23] border border-border/50 dark:border-white/[0.04]">
                <p className="text-[11px] text-muted-foreground font-semibold mb-1 uppercase tracking-wide">
                  {c.label}
                </p>
                <p className={`text-xl font-extrabold tabular-nums tracking-tight ${c.valClass ?? "text-foreground"}`}>
                  {c.value}
                </p>
                {c.sub && <span className={`text-xs font-bold mt-0.5 ${c.subClass}`}>{c.sub}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showSummary && (
        <PortfolioChartsPanel
          positions={positions}
          currentPrices={currentPrices}
          displayCurrency={displayCurrency}
          fxRates={fxRates}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      )}

      {(activeTab === "allocation" || activeTab === "sector") && (
        positions.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/60">
              <Minus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">Sin símbolos añadidos</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Pulsa &ldquo;Añadir Símbolo&rdquo; para seguir acciones, ETFs, criptomonedas o índices
              en tiempo real.
            </p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Añadir primer símbolo
            </button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {positions.map((pos) => (
              <TickerCard
                key={pos.symbol}
                position={pos}
                quote={quotes[pos.symbol]}
                status={quoteStatuses[pos.symbol]}
                onRefresh={() => fetchAllQuotes([pos.symbol])}
                onRemove={() => handleRemove(pos.symbol)}
                onUpdate={(s, p, fx) => handleUpdate(pos.symbol, pos.label, s, p, fx)}
                onPriceLoaded={handlePriceLoaded}
                displayCurrency={displayCurrency}
                fxRates={fxRates}
              />
            ))}
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-4 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer min-h-[120px]"
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs font-semibold">Añadir símbolo</span>
            </button>
          </div>
        )
      )}

      {showModal && (
        <AddSymbolModal onAdd={handleAdd} onClose={() => setShowModal(false)} />
      )}
    </section>
  )
}
