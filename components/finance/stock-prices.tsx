"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { BarChart2, Plus, Minus, Wallet } from "lucide-react"
import { upsertStockPosition, deleteStockPosition } from "@/app/actions"
import type { StockPosition } from "@/app/actions"
import { CURRENCIES, CURRENCY_SYMBOLS, DISPLAY_CURRENCY_KEY, arcPath, getFxPair } from "@/lib/format"
import {
  TickerCard,
  AddSymbolModal,
  SpanishTaxExportCalculator,
  PriceAlertsMacroCalendar,
  FinancialNewsTickerBar,
} from "./stock-widgets"
import {
  ASSET_COLORS,
  CompoundGrowthChart,
  IndexComparisonChart,
  TradingViewAdvancedWidget,
  SectorRiskAnalysis,
} from "./stock-charts"

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
  activeTab: "allocation" | "ranking" | "sector" | "index" | "compound" | "tax" | "alerts"
  setActiveTab: (tab: "allocation" | "ranking" | "sector" | "index" | "compound" | "tax" | "alerts") => void
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

  const rankedItems = [...items].sort((a, b) => b.plPct - a.plPct)
  const maxRankPct = Math.max(...items.map((it) => Math.abs(it.plPct)), 1)
  const maxPL = Math.max(...items.map((it) => Math.abs(it.plDisp)), 1)
  const activeItem = itemsWithWeight.find((it) => it.symbol === hoveredSymbol)

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-border/40 pt-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          Análisis Visual de Cartera
        </span>
        <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border/40 flex-wrap">
          {(
            [
              { id: "allocation", label: "📊 Distribución" },
              { id: "ranking", label: "🏆 Ranking" },
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
                  ? "bg-card text-foreground shadow-xs"
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
          <div className="flex flex-col bg-background/50 rounded-xl p-3 border border-border/30 gap-2">
            <div className="flex items-center justify-between border-b border-border/20 pb-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                Distribución por Activo
              </span>
              {activeItem && (
                <span className="text-[11px] font-bold text-primary truncate max-w-[180px]">
                  {activeItem.label} ({activeItem.weightPct.toFixed(1)}%)
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative flex items-center justify-center shrink-0">
                <svg width="130" height="130" viewBox="0 0 140 140" className="transform -rotate-90">
                  {slices.map((slice) => {
                    const isH = slice.symbol === hoveredSymbol
                    return (
                      <path
                        key={slice.symbol}
                        d={arcPath(70, 70, isH ? 66 : 62, slice.startAngle, slice.endAngle)}
                        fill={slice.color}
                        opacity={isH ? 1 : 0.85}
                        className="transition-all duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredSymbol(slice.symbol)}
                        onMouseLeave={() => setHoveredSymbol(null)}
                      />
                    )
                  })}
                  <circle cx="70" cy="70" r="42" fill="currentColor" className="text-background" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-sm font-extrabold text-foreground tabular-nums">
                    {hoveredSymbol && activeItem
                      ? `${activeItem.weightPct.toFixed(1)}%`
                      : `${itemsWithWeight.length} pos.`}
                  </span>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase">
                    {hoveredSymbol ? "Peso" : "Cartera"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 w-full overflow-y-auto max-h-36 pr-1">
                {itemsWithWeight.map((it) => (
                  <div
                    key={it.symbol}
                    onMouseEnter={() => setHoveredSymbol(it.symbol)}
                    onMouseLeave={() => setHoveredSymbol(null)}
                    className={`flex items-center justify-between text-xs p-1 rounded-lg transition-colors cursor-pointer ${
                      it.symbol === hoveredSymbol ? "bg-primary/10" : "hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: it.color }} />
                      <span className="font-bold text-foreground truncate text-[11px]">{it.label}</span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums text-[11px]">
                      <span className="font-semibold text-muted-foreground">{it.weightPct.toFixed(1)}%</span>
                      <span className="font-bold text-foreground">{dispSym}{it.currentDisp.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 bg-background/50 rounded-xl p-3 border border-border/30 h-full justify-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              Rentabilidad por Activo ({dispSym})
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
                        {isGain ? "+" : ""}{dispSym}{Math.abs(it.plDisp).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                        <span className="font-semibold text-[10px]">({isGain ? "+" : ""}{it.plPct.toFixed(2)}%)</span>
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

      {/* Tab 2: Performance Ranking Leaderboard */}
      {activeTab === "ranking" && (
        <div className="flex flex-col gap-2.5 bg-background/50 rounded-xl p-3.5 border border-border/30 animate-in fade-in duration-150">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
            <span>Ranking de Rendimiento (% Rentabilidad)</span>
            <span>{rankedItems.length} activos ordenados de mayor a menor</span>
          </p>

          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
            {rankedItems.map((it, idx) => {
              const isGain = it.plPct >= 0
              const barPct = (Math.abs(it.plPct) / maxRankPct) * 100
              const rankMedal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`

              return (
                <div key={it.symbol} className="flex items-center gap-3 p-2 rounded-xl bg-secondary/30 border border-border/30">
                  <span className="text-xs font-bold shrink-0 w-6 text-center">{rankMedal}</span>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-bold text-foreground truncate">{it.label}</span>
                      <span className={`font-extrabold tabular-nums ${isGain ? "text-positive" : "text-destructive"}`}>
                        {isGain ? "+" : ""}{it.plPct.toFixed(2)}%
                        <span className="text-[10px] text-muted-foreground ml-1.5 font-normal">
                          ({isGain ? "+" : ""}{dispSym}{it.plDisp.toLocaleString("es-ES", { maximumFractionDigits: 0 })})
                        </span>
                      </span>
                    </div>

                    <PLBar isGain={isGain} pct={barPct} minPct={5} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Sector & Risk Matrix Breakdown */}
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
            defaultReturnPct={totalPLPct}
            displayCurrency={displayCurrency}
          />
        </div>
      )}

      {/* Tab 5: Price Alerts & Macro Calendar */}
      {activeTab === "alerts" && (
        <div className="animate-in fade-in duration-150">
          <PriceAlertsMacroCalendar symbols={positions.map((p) => p.symbol)} />
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

export function StockPricesPanel({ initialPositions }: { initialPositions: StockPosition[] }) {
  const [positions, setPositions] = useState<StockPosition[]>(initialPositions)
  const [showModal, setShowModal] = useState(false)
  const [currentPrices, setCurrentPrices] = useState<
    Record<string, { price: number; currency: string }>
  >({})
  const [displayCurrency, setDisplayCurrency] = useState("EUR")
  const [fxRates, setFxRates] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<
    "allocation" | "ranking" | "sector" | "index" | "compound" | "tax" | "alerts"
  >("allocation")
  const [, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DISPLAY_CURRENCY_KEY)
      if (saved && CURRENCIES.some((c) => c.code === saved)) {
        setDisplayCurrency(saved)
      }
    } catch {
      // ignore
    }
  }, [])

  function handleCurrencyChange(code: string) {
    setDisplayCurrency(code)
    try {
      localStorage.setItem(DISPLAY_CURRENCY_KEY, code)
    } catch {
      // ignore
    }
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
            <p className="text-xs text-muted-foreground">
              Datos vía TradingView · actualización automática cada 60 s
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-1 bg-secondary/60 border border-border rounded-full px-2.5 py-1 text-xs">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Moneda:</span>
            <select
              value={displayCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
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
        <div
          className={`mt-4 rounded-2xl p-4 sm:p-5 border transition-all ${
            isPLPositive
              ? "bg-positive/5 border-positive/20 shadow-xs"
              : "bg-destructive/5 border-destructive/20 shadow-xs"
          }`}
        >
          <div className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/20 pb-2.5">
            <span className="flex items-center gap-1.5 font-bold text-foreground">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              Resumen de cartera · {portfolioSummary.count} posición
              {portfolioSummary.count !== 1 ? "es" : ""} con datos
            </span>
            <span className="text-[10px] font-bold text-muted-foreground bg-secondary/80 px-2.5 py-0.5 rounded-full border border-border/40 w-fit">
              Mostrando en {displayCurrency} ({dispSym})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-background/60 border border-border/40 shadow-2xs">
              <p className="text-[11px] text-muted-foreground font-semibold mb-1">
                Capital invertido
              </p>
              <p className="text-base sm:text-lg font-black text-foreground tabular-nums tracking-tight">
                {dispSym}
                {portfolioSummary.invested.toLocaleString("es-ES", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-background/60 border border-border/40 shadow-2xs">
              <p className="text-[11px] text-muted-foreground font-semibold mb-1">
                Valor actual
              </p>
              <p className="text-base sm:text-lg font-black text-foreground tabular-nums tracking-tight">
                {dispSym}
                {portfolioSummary.current.toLocaleString("es-ES", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-background/60 border border-border/40 shadow-2xs">
              <p className="text-[11px] text-muted-foreground font-semibold mb-1">
                Rentabilidad total
              </p>
              <p
                className={`text-base sm:text-lg font-black tabular-nums tracking-tight ${
                  isPLPositive ? "text-positive" : "text-destructive"
                }`}
              >
                {isPLPositive ? "+" : "-"}
                {dispSym}
                {Math.abs(totalPL).toLocaleString("es-ES", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <span
                className={`text-xs font-black mt-0.5 ${
                  isPLPositive ? "text-positive" : "text-destructive"
                }`}
              >
                ({isPLPositive ? "+" : ""}
                {totalPLPct.toFixed(2)}%)
              </span>
            </div>
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

      {(activeTab === "allocation" || activeTab === "ranking" || activeTab === "sector") && (
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
