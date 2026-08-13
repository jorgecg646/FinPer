"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  X,
  Search,
  BarChart2,
  AlertCircle,
  ExternalLink,
  Edit2,
  Check,
  Target,
} from "lucide-react"
import type { StockPosition } from "@/app/actions"
import { CURRENCY_SYMBOLS, getFxPair } from "@/lib/format"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StockQuote {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  ytdChangePercent?: number
  high: number
  low: number
  open: number
  prevClose: number
  volume: number
  currency: string
  exchange: string
  timestamp: number
  logoid: string
}

export type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: StockQuote }
  | { status: "error"; message: string }

// ─── Suggestions ──────────────────────────────────────────────────────────────

export const SUGGESTIONS = [
  { label: "Apple", symbol: "NASDAQ:AAPL" },
  { label: "Microsoft", symbol: "NASDAQ:MSFT" },
  { label: "NVIDIA", symbol: "NASDAQ:NVDA" },
  { label: "Amazon", symbol: "NASDAQ:AMZN" },
  { label: "Tesla", symbol: "NASDAQ:TSLA" },
  { label: "S&P 500 ETF", symbol: "AMEX:SPY" },
  { label: "Bitcoin", symbol: "BINANCE:BTCUSDT" },
  { label: "Ethereum", symbol: "BINANCE:ETHUSDT" },
  { label: "Ibex 35", symbol: "BME:IBC" },
  { label: "Oro", symbol: "TVC:GOLD" },
]

export async function fetchQuote(symbol: string): Promise<StockQuote> {
  const res = await fetch(`/api/stock-price?symbol=${encodeURIComponent(symbol)}`)
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error ?? "Error de red")
  return json as StockQuote
}

// ─── P&L Display ─────────────────────────────────────────────────────────────

export function PortfolioPosition({
  shares,
  avgPrice,
  avgFxRate,
  currentPrice,
  currency,
  displayCurrency,
  conversionRate,
}: {
  shares: number
  avgPrice: number
  avgFxRate?: number | null
  currentPrice: number
  currency: string
  displayCurrency: string
  conversionRate: number
}) {
  const investedNative = shares * avgPrice
  const currentNative = shares * currentPrice
  const nativePL = currentNative - investedNative
  const nativePLPct = investedNative > 0 ? (nativePL / investedNative) * 100 : 0
  const isNativeGain = nativePL >= 0

  const needsConversion = displayCurrency !== currency && conversionRate > 0
  const dispSymbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency
  const nativeSymbol = CURRENCY_SYMBOLS[currency] ?? currency

  const purchaseFx = avgFxRate && avgFxRate > 0 ? avgFxRate : (conversionRate > 0 ? conversionRate : 1)
  const currentFx = conversionRate > 0 ? conversionRate : purchaseFx

  const investedDisp = needsConversion ? investedNative * purchaseFx : investedNative
  const currentDisp = needsConversion ? currentNative * currentFx : currentNative
  const totalPLDisp = currentDisp - investedDisp
  const totalPLPct = investedDisp > 0 ? (totalPLDisp / investedDisp) * 100 : 0
  const isTotalGain = totalPLDisp >= 0

  const assetGainDisp = nativePL * purchaseFx
  const fxImpactDisp = currentNative * (currentFx - purchaseFx)
  const fxChangePct = purchaseFx > 0 ? ((currentFx - purchaseFx) / purchaseFx) * 100 : 0
  const isFxGain = fxImpactDisp >= 0

  const fmt = (n: number, sym: string, d = 2) =>
    `${n < 0 ? "-" : ""}${sym}${Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d })}`

  const fmtSym = needsConversion ? dispSymbol : nativeSymbol

  return (
    <div
      className={`mt-2 rounded-xl p-3 border ${
        isTotalGain ? "bg-positive/5 border-positive/20" : "bg-destructive/5 border-destructive/20"
      }`}
    >
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Target className="h-3 w-3" />
          Mi Posición
        </span>
        {needsConversion && (
          <span className="text-[9px] font-semibold text-muted-foreground/80">
            FX: 1 {currency} = {currentFx.toFixed(4)} {displayCurrency}
          </span>
        )}
      </p>

      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] text-muted-foreground">
          {shares.toLocaleString("es-ES", { maximumFractionDigits: 6 }).replace(/\.?0+$/, "")} acc. ×{" "}
          {nativeSymbol}{avgPrice.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/acc.
        </p>

        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Capital invertido</span>
          <span className="font-bold text-foreground tabular-nums">
            {fmt(investedDisp, fmtSym)}
            {needsConversion && <span className="text-muted-foreground/60 ml-1 text-[9px]">({fmt(investedNative, nativeSymbol)})</span>}
          </span>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Valor actual</span>
          <span className="font-bold text-foreground tabular-nums">
            {fmt(currentDisp, fmtSym)}
            {needsConversion && <span className="text-muted-foreground/60 ml-1 text-[9px]">({fmt(currentNative, nativeSymbol)})</span>}
          </span>
        </div>

        {needsConversion && (
          <div className="my-1 rounded-lg bg-background/60 p-2 flex flex-col gap-1 text-[11px] border border-border/40">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <span>📈 Rendimiento activo</span>
                <span className="text-[9px] text-muted-foreground/60">({currency})</span>
              </span>
              <span className={`font-bold tabular-nums ${isNativeGain ? "text-positive" : "text-destructive"}`}>
                {isNativeGain ? "+" : ""}{fmt(nativePL, nativeSymbol)}{" "}
                <span className="text-[10px]">({isNativeGain ? "+" : ""}{nativePLPct.toFixed(2)}%)</span>
              </span>
            </div>

            <div className="flex justify-between items-center border-t border-border/30 pt-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <span>💱 Impacto Divisa (FX)</span>
                <span className="text-[9px] text-muted-foreground/60">({currency}→{displayCurrency})</span>
              </span>
              <span className={`font-bold tabular-nums ${isFxGain ? "text-positive" : "text-destructive"}`}>
                {isFxGain ? "+" : ""}{fmt(fxImpactDisp, dispSymbol)}{" "}
                <span className="text-[10px]">({isFxGain ? "+" : ""}{fxChangePct.toFixed(2)}%)</span>
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-between text-xs border-t border-border/30 pt-1">
          <span className="font-semibold text-muted-foreground">Rentabilidad Total</span>
          <span className={`font-extrabold tabular-nums ${isTotalGain ? "text-positive" : "text-destructive"}`}>
            {isTotalGain ? "+" : ""}{fmt(totalPLDisp, fmtSym)}{" "}
            <span className="font-bold">({isTotalGain ? "+" : ""}{totalPLPct.toFixed(2)}%)</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Inline Position Form ─────────────────────────────────────────────────────

export function PositionForm({
  shares,
  avgPrice,
  avgFxRate,
  currency,
  displayCurrency,
  conversionRate,
  onSave,
  onCancel,
}: {
  shares: number | null
  avgPrice: number | null
  avgFxRate: number | null
  currency: string
  displayCurrency: string
  conversionRate: number
  onSave: (shares: number, avgPrice: number, avgFxRate?: number) => void
  onCancel: () => void
}) {
  const [sharesInput, setSharesInput] = useState(shares != null ? String(shares) : "")
  const [priceInput, setPriceInput] = useState(avgPrice != null ? String(avgPrice) : "")

  const initialFxPct =
    avgFxRate != null && avgFxRate > 0 && conversionRate > 0
      ? (((conversionRate - avgFxRate) / avgFxRate) * 100).toFixed(2)
      : "0"

  const [fxPctInput, setFxPctInput] = useState(initialFxPct)
  const isForeign = currency !== displayCurrency

  function handleSave() {
    const s = parseFloat(sharesInput.replace(",", "."))
    const p = parseFloat(priceInput.replace(",", "."))
    const pct = parseFloat(fxPctInput.replace(",", "."))

    if (!isNaN(s) && s > 0 && !isNaN(p) && p > 0) {
      let computedFxRate: number | undefined = undefined
      if (isForeign && !isNaN(pct) && conversionRate > 0) {
        computedFxRate = conversionRate / (1 + pct / 100)
      }
      onSave(s, p, computedFxRate)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-col gap-2">
      <p className="text-[10px] font-bold text-primary uppercase tracking-wide flex items-center gap-1">
        <Edit2 className="h-3 w-3" />
        Editar posición
      </p>

      <div className={`grid gap-2 ${isForeign ? "grid-cols-3" : "grid-cols-2"}`}>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
            Nº acciones
          </label>
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="10"
            value={sharesInput}
            autoFocus
            onChange={(e) => setSharesInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
            Precio medio ({currency})
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="150.00"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        {isForeign && (
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
              Impacto FX (%)
            </label>
            <div className="relative flex items-center">
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                value={fxPctInput}
                onChange={(e) => setFxPctInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="w-full rounded-lg border border-border bg-background pl-2 pr-5 py-1.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
              />
              <span className="absolute right-1.5 text-[10px] font-bold text-muted-foreground">%</span>
            </div>
          </div>
        )}
      </div>

      {isForeign && (
        <p className="text-[9px] text-muted-foreground/70">
          Impacto FX: % de variación de la divisa ({currency}/{displayCurrency}) desde la compra. Ej: 0 = sin cambio, +2.5 = la divisa subió +2.5%.
        </p>
      )}

      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!sharesInput.trim() || !priceInput.trim()}
          className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
        >
          <Check className="h-3 w-3" />
          Guardar
        </button>
      </div>
    </div>
  )
}

// ─── Ticker Card ──────────────────────────────────────────────────────────────

export function TickerCard({
  position,
  onRemove,
  onUpdate,
  onPriceLoaded,
  displayCurrency,
  fxRates,
}: {
  position: StockPosition
  onRemove: () => void
  onUpdate: (shares: number, avgPrice: number, avgFxRate?: number) => void
  onPriceLoaded: (symbol: string, price: number, currency: string) => void
  displayCurrency: string
  fxRates: Record<string, number>
}) {
  const [state, setState] = useState<QuoteState>({ status: "idle" })
  const [editing, setEditing] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    setLogoError(false)
  }, [position.symbol])

  const load = useCallback(async () => {
    setState({ status: "loading" })
    setRotating(true)
    try {
      const data = await fetchQuote(position.symbol)
      setState({ status: "ok", data })
      onPriceLoaded(position.symbol, data.price, data.currency)
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Error desconocido",
      })
    } finally {
      setTimeout(() => setRotating(false), 600)
    }
  }, [position.symbol, onPriceLoaded])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  const hasPosition =
    position.shares != null &&
    position.avgPrice != null &&
    position.shares > 0 &&
    position.avgPrice > 0

  const isPositive = state.status === "ok" ? state.data.changePercent >= 0 : null
  const displayName =
    state.status === "ok" && state.data.name && !state.data.name.includes(":")
      ? state.data.name
      : position.label || position.symbol

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-secondary/30 p-4 transition-all hover:border-primary/30 hover:bg-secondary/50">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {state.status === "ok" && state.data.logoid && !logoError ? (
            <img
              src={`https://s3-symbol-logo.tradingview.com/${state.data.logoid}--big.svg`}
              alt={displayName}
              className="h-9 w-9 shrink-0 rounded-xl object-contain bg-secondary/60 p-1"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                isPositive === true
                  ? "bg-positive/10 text-positive"
                  : isPositive === false
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {isPositive === true ? (
                <TrendingUp className="h-4 w-4" />
              ) : isPositive === false ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <BarChart2 className="h-4 w-4" />
              )}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground font-mono truncate">{position.symbol}</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={load}
            disabled={state.status === "loading"}
            aria-label="Actualizar precio"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${rotating ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            title="Editar posición"
            aria-label="Editar posición"
            className={`rounded-full p-1.5 transition-colors cursor-pointer ${
              editing
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Eliminar símbolo"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center gap-2">
          <div className="h-7 w-24 animate-pulse rounded-lg bg-border/60" />
          <div className="h-4 w-16 animate-pulse rounded-lg bg-border/40" />
        </div>
      )}

      {state.status === "ok" && (
        <>
          <div className="flex items-end gap-2 flex-wrap">
            <span className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
              {state.data.price.toLocaleString("es-ES", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}
              <span className="text-xs font-semibold text-muted-foreground ml-1">
                {state.data.currency}
              </span>
            </span>
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                state.data.changePercent >= 0
                  ? "bg-positive/10 text-positive"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {state.data.changePercent >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {state.data.changePercent >= 0 ? "+" : ""}
              {state.data.changePercent.toFixed(2)}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-[10px] text-muted-foreground">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-[9px] uppercase tracking-wide">Apertura</span>
              <span className="font-bold text-foreground tabular-nums">
                {state.data.open > 0
                  ? state.data.open.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })
                  : "—"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-[9px] uppercase tracking-wide">Máx / Mín</span>
              <span className="font-bold text-foreground tabular-nums text-[10px]">
                {state.data.high > 0
                  ? state.data.high.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "—"}{" "}
                /{" "}
                {state.data.low > 0
                  ? state.data.low.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "—"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-[9px] uppercase tracking-wide">Variación</span>
              <span
                className={`font-bold tabular-nums ${
                  state.data.change >= 0 ? "text-positive" : "text-destructive"
                }`}
              >
                {state.data.change >= 0 ? "+" : ""}
                {state.data.change.toLocaleString("es-ES", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })}
              </span>
            </div>
          </div>

          {hasPosition && !editing && (() => {
            const nativeCurrency = state.data.currency
            const { currentFx } = getFxPair(nativeCurrency, displayCurrency, fxRates)
            return (
              <PortfolioPosition
                shares={position.shares!}
                avgPrice={position.avgPrice!}
                avgFxRate={position.avgFxRate ?? null}
                currentPrice={state.data.price}
                currency={nativeCurrency}
                displayCurrency={displayCurrency}
                conversionRate={currentFx}
              />
            )
          })()}

          {!hasPosition && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary/70 hover:text-primary transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              Añadir nº acciones y precio medio
            </button>
          )}

          <p className="text-[9px] text-muted-foreground/60">
            Act.{" "}
            {new Date(state.data.timestamp).toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
            {state.data.exchange ? ` · ${state.data.exchange}` : ""}
          </p>
        </>
      )}

      {state.status === "error" && (
        <div className="flex items-center gap-2 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="line-clamp-2">{state.message}</span>
        </div>
      )}

      {editing && (() => {
        const nativeCurrency = state.status === "ok" ? state.data.currency : "USD"
        const { currentFx } = getFxPair(nativeCurrency, displayCurrency, fxRates)
        return (
          <PositionForm
            shares={position.shares ?? null}
            avgPrice={position.avgPrice ?? null}
            avgFxRate={position.avgFxRate ?? null}
            currency={nativeCurrency}
            displayCurrency={displayCurrency}
            conversionRate={currentFx}
            onSave={(s, p, fx) => {
              onUpdate(s, p, fx)
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        )
      })()}
    </div>
  )
}

// ─── Add Symbol Modal ─────────────────────────────────────────────────────────

export interface SearchResult {
  id: string
  symbol: string
  description: string
  exchange: string
  type: string
}

export const TYPE_LABEL: Record<string, string> = {
  stock: "Acción",
  crypto: "Cripto",
  fund: "Fondo",
  futures: "Futuros",
  forex: "Forex",
  cfd: "CFD",
  index: "Índice",
  economic: "Económico",
  dr: "DR",
}

export function AddSymbolModal({
  onAdd,
  onClose,
}: {
  onAdd: (data: { symbol: string; label: string; shares?: number; avgPrice?: number }) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [shares, setShares] = useState("")
  const [avgPrice, setAvgPrice] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState("")

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearchError("")
      setSearching(false)
      return
    }

    const controller = new AbortController()
    setSearching(true)
    setSearchError("")
    setResults([])

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/symbol-search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        )
        const json = await res.json()
        if (!controller.signal.aborted) {
          setResults(json.results ?? [])
          if (json.error) setSearchError(json.error)
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSearchError("Error al buscar")
          setResults([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false)
        }
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function buildEntry(sym: string, lbl: string) {
    const s = parseFloat(shares.replace(",", "."))
    const p = parseFloat(avgPrice.replace(",", "."))
    return {
      symbol: sym,
      label: lbl,
      ...(shares && !isNaN(s) && s > 0 ? { shares: s } : {}),
      ...(avgPrice && !isNaN(p) && p > 0 ? { avgPrice: p } : {}),
    }
  }

  function handleSelect(r: SearchResult | { symbol: string; label: string }) {
    const sym = ("id" in r ? r.id : r.symbol).toUpperCase()
    const lbl = ("description" in r ? r.description : r.label) || sym
    onAdd(buildEntry(sym, lbl))
    onClose()
  }

  const showSuggestions = !query.trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Añadir símbolo
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-[10px] font-bold text-primary uppercase tracking-wide mb-2 flex items-center gap-1">
            <Target className="h-3 w-3" />
            Mi posición (opcional)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Nº acciones</label>
              <input
                type="number" min="0" step="0.000001" placeholder="10"
                value={shares} onChange={(e) => setShares(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Precio medio</label>
              <input
                type="number" min="0" step="0.01" placeholder="150.00"
                value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="relative mb-3">
          {searching ? (
            <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          )}
          <input
            type="text"
            placeholder="Buscar por nombre o ticker… (ej. GDX, Apple, BTC)"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-background pl-8 pr-8 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setResults([])
                setSearchError("")
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full cursor-pointer"
              title="Limpiar búsqueda"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {searchError && (
          <p className="text-xs text-destructive mb-2 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />{searchError}
          </p>
        )}

        {showSuggestions ? (
          <>
            <p className="text-[11px] font-semibold text-muted-foreground mb-2">Sugerencias populares</p>
            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.symbol}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/30 px-3 py-2.5 text-left transition-colors hover:bg-primary/10 hover:border-primary/40 cursor-pointer"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-foreground truncate">{s.label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{s.symbol}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {searching && results.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span>Buscando &ldquo;{query}&rdquo;…</span>
              </div>
            )}
            {!searching && results.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-6">
                Sin resultados para &ldquo;{query}&rdquo;
              </p>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r)}
                className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2.5 text-left transition-colors hover:bg-primary/10 hover:border-primary/40 cursor-pointer"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-foreground truncate">{r.description || r.symbol}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{r.id}</span>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-0.5">
                  <span className="text-[9px] font-bold text-muted-foreground bg-secondary rounded px-1.5 py-0.5">
                    {r.exchange}
                  </span>
                  {r.type && (
                    <span className="text-[9px] text-muted-foreground/70">
                      {TYPE_LABEL[r.type] ?? r.type}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <p className="mt-3 text-[10px] text-muted-foreground/70 flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Datos de búsqueda: TradingView Symbol Search API
        </p>
      </div>
    </div>
  )
}

// ─── Spanish Tax Calculator & Report Export Component ────────────────────────

export const TAX_BRACKETS = [
  { limit: 6000, rate: 0.19, label: "Hasta 6.000 €" },
  { limit: 44000, rate: 0.21, label: "6.000 € a 50.000 €" },
  { limit: 150000, rate: 0.23, label: "50.000 € a 200.000 €" },
  { limit: 100000, rate: 0.27, label: "200.000 € a 300.000 €" },
  { limit: Infinity, rate: 0.28, label: "Más de 300.000 €" },
]

export function calculateSpanishTax(gain: number) {
  if (gain <= 0) return { tax: 0, effectiveRate: 0, breakdown: [] }

  let remaining = gain
  let totalTax = 0
  const breakdown: { bracket: string; rate: number; taxable: number; tax: number }[] = []

  for (const b of TAX_BRACKETS) {
    if (remaining <= 0) break
    const taxable = Math.min(remaining, b.limit)
    const tax = taxable * b.rate
    totalTax += tax
    remaining -= taxable
    breakdown.push({ bracket: b.label, rate: b.rate * 100, taxable, tax })
  }

  const effectiveRate = (totalTax / gain) * 100
  return { tax: totalTax, effectiveRate, breakdown }
}

export function SpanishTaxExportCalculator({
  items,
  displayCurrency,
}: {
  items: {
    symbol: string
    label: string
    currentDisp: number
    investedDisp: number
    plDisp: number
    plPct: number
  }[]
  displayCurrency: string
}) {
  const dispSym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency

  const [customSales, setCustomSales] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((it) => [it.symbol, 100]))
  )

  function handleSetAll(pct: number) {
    setCustomSales(Object.fromEntries(items.map((it) => [it.symbol, pct])))
  }

  const activeSaleItems = useMemo(() => {
    return items.filter((it) => (customSales[it.symbol] ?? 0) > 0)
  }, [items, customSales])

  const { totalInvested, totalCurrent, totalGain, taxCalculation, netProfit } = useMemo(() => {
    let inv = 0
    let cur = 0

    items.forEach((it) => {
      const pct = (customSales[it.symbol] ?? 0) / 100
      if (pct > 0) {
        inv += it.investedDisp * pct
        cur += it.currentDisp * pct
      }
    })

    const gain = cur - inv
    const tax = calculateSpanishTax(gain)
    const net = gain - tax.tax

    return {
      totalInvested: inv,
      totalCurrent: cur,
      totalGain: gain,
      taxCalculation: tax,
      netProfit: net,
    }
  }, [items, customSales])

  const hasCrypto = activeSaleItems.some((it) =>
    it.symbol.includes("BTC") || it.symbol.includes("ETH") || it.symbol.includes("BINANCE:") || it.symbol.includes("CRYPTO:")
  )
  const hasStocks = activeSaleItems.some((it) => !hasCrypto)

  return (
    <div className="flex flex-col gap-4 bg-background/60 rounded-2xl p-4 border border-border/40 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            🇪🇸 Calculadora Fiscal IRPF & Guía de Renta (España)
          </h4>
          <p className="text-xs text-muted-foreground">
            Selecciona de forma individual qué acciones y qué % vas a vender simultáneamente
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-all hover:opacity-90 flex items-center gap-2 cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <span>📄 Descargar Informe PDF / Imprimir</span>
        </button>
      </div>

      <div className="flex flex-col gap-3 bg-secondary/30 p-3.5 rounded-xl border border-border/30 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/20 pb-2">
          <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
            <span>⚙️ Selección de Venta Individual por Acción:</span>
          </span>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleSetAll(100)}
              className="px-2 py-1 rounded-lg bg-card border border-border/40 hover:bg-secondary text-[10px] font-bold text-foreground cursor-pointer"
            >
              Vender 100% Todo
            </button>
            <button
              type="button"
              onClick={() => handleSetAll(50)}
              className="px-2 py-1 rounded-lg bg-card border border-border/40 hover:bg-secondary text-[10px] font-bold text-foreground cursor-pointer"
            >
              Vender 50% Todo
            </button>
            <button
              type="button"
              onClick={() => handleSetAll(0)}
              className="px-2 py-1 rounded-lg bg-card border border-border/40 hover:bg-secondary text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Desactivar Todo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
          {items.map((it) => {
            const currentPct = customSales[it.symbol] ?? 0
            const isSelling = currentPct > 0

            const itemSaleInv = it.investedDisp * (currentPct / 100)
            const itemSaleCur = it.currentDisp * (currentPct / 100)
            const itemSalePL = itemSaleCur - itemSaleInv

            return (
              <div
                key={it.symbol}
                className={`p-2.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
                  isSelling
                    ? "bg-card border-primary/40 shadow-2xs"
                    : "bg-secondary/20 border-border/20 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelling}
                      onChange={(e) =>
                        setCustomSales((prev) => ({
                          ...prev,
                          [it.symbol]: e.target.checked ? 100 : 0,
                        }))
                      }
                      className="rounded accent-primary h-3.5 w-3.5 cursor-pointer"
                    />
                    <span className="font-bold text-foreground truncate text-xs">{it.label}</span>
                  </div>

                  <span className="text-xs font-black tabular-nums text-primary">
                    {currentPct}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={currentPct}
                    onChange={(e) =>
                      setCustomSales((prev) => ({
                        ...prev,
                        [it.symbol]: parseInt(e.target.value, 10),
                      }))
                    }
                    className="flex-1 accent-primary h-1.5 bg-secondary rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                  <span>
                    Venta: <strong className="text-foreground">{dispSym}{itemSaleCur.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</strong>
                  </span>
                  <span
                    className={`font-black tabular-nums ${
                      itemSalePL >= 0 ? "text-positive" : "text-destructive"
                    }`}
                  >
                    {itemSalePL >= 0 ? "+" : ""}{dispSym}{itemSalePL.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-3 border bg-card border-border/40 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-muted-foreground">Venta Total Simulada</span>
          <span className="text-lg font-black text-foreground tabular-nums">
            {dispSym}{totalCurrent.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-muted-foreground/80 font-medium">
            Invertido: {dispSym}{totalInvested.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="rounded-xl p-3 border bg-card border-border/40 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-muted-foreground">Ganancia Patrimonial Bruta</span>
          <span
            className={`text-lg font-black tabular-nums ${
              totalGain >= 0 ? "text-positive" : "text-destructive"
            }`}
          >
            {totalGain >= 0 ? "+" : ""}{dispSym}{totalGain.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-muted-foreground/80 font-medium">
            Base Imponible del Ahorro
          </span>
        </div>

        <div className="rounded-xl p-3 border bg-amber-500/5 border-amber-500/20 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-amber-500">Estimación Impuestos IRPF</span>
          <span className="text-lg font-black text-amber-500 tabular-nums">
            {dispSym}{taxCalculation.tax.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] font-bold text-amber-500/90">
            Tipo Efectivo: {taxCalculation.effectiveRate.toFixed(2)}%
          </span>
        </div>

        <div className="rounded-xl p-3 border bg-emerald-500/5 border-emerald-500/20 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-emerald-400">Beneficio Neto Limpio</span>
          <span className="text-lg font-black text-emerald-400 tabular-nums">
            {dispSym}{netProfit.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] font-bold text-emerald-400/90">
            Dinero neto tras impuestos
          </span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-report, .printable-report * {
            visibility: visible;
          }
          .printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            border: none !important;
            box-shadow: none !important;
          }
          .printable-report span, .printable-report p, .printable-report th, .printable-report td, .printable-report h5 {
            color: black !important;
          }
        }
      `}} />

      <div className="printable-report rounded-2xl p-5 bg-background border border-border/60 text-xs flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div>
            <h5 className="font-extrabold text-foreground text-base">
              📋 Informe Fiscal IRPF & Guía de Renta (Modelo 100 - España)
            </h5>
            <p className="text-xs text-muted-foreground mt-0.5">
              Resumen de operaciones y casillas exactas para la Agencia Tributaria (AEAT)
            </p>
          </div>
          <span className="text-xs font-bold text-foreground bg-secondary/80 px-3 py-1 rounded-md border border-border/50 shrink-0">
            Ejercicio Fiscal {new Date().getFullYear()}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold text-foreground uppercase tracking-wide">
            Desglose de Venta ({activeSaleItems.length} activos seleccionados)
          </p>

          <div className="overflow-x-auto rounded-xl border border-border/40 bg-background/50 p-1 shadow-2xs">
            <table className="w-full text-left border-collapse text-xs min-w-[540px]">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-bold bg-secondary/40">
                  <th className="py-2 px-3">Activo / Símbolo</th>
                  <th className="py-2 px-3 text-right">Valor Venta ({dispSym})</th>
                  <th className="py-2 px-3 text-right">Coste Adquisición ({dispSym})</th>
                  <th className="py-2 px-3 text-right">Ganancia / Pérdida ({dispSym})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 font-medium">
                {activeSaleItems.map((it) => {
                  const currentPct = (customSales[it.symbol] ?? 0) / 100
                  const saleCur = it.currentDisp * currentPct
                  const saleInv = it.investedDisp * currentPct
                  const salePL = saleCur - saleInv
                  return (
                    <tr key={it.symbol} className="hover:bg-secondary/20">
                      <td className="py-2 px-3 font-bold text-foreground">
                        {it.label} <span className="text-[10px] text-muted-foreground font-normal">({it.symbol})</span>
                        {currentPct < 1 && (
                          <span className="ml-1 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {currentPct * 100}%
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-foreground font-semibold">
                        {dispSym}{saleCur.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                        {dispSym}{saleInv.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td
                        className={`py-2 px-3 text-right tabular-nums font-bold ${
                          salePL >= 0 ? "text-positive" : "text-destructive"
                        }`}
                      >
                        {salePL >= 0 ? "+" : ""}{dispSym}{salePL.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/30 pt-3">
          <p className="text-[11px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
            <span>🏛️ Casillas Exactas Renta (Modelo 100 AEAT):</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/40 flex flex-col gap-1">
              <span className="font-bold text-foreground">1. Casillas de Declaración:</span>
              {hasStocks && (
                <p className="text-muted-foreground">
                  • <strong className="text-foreground">Acciones / ETFs:</strong> Ir a las <strong className="text-primary font-bold">Casillas 0326 a 0338</strong> (Ganancias y pérdidas patrimoniales derivadas de transmisiones de acciones).
                </p>
              )}
              {hasCrypto && (
                <p className="text-muted-foreground mt-1">
                  • <strong className="text-foreground">Criptomonedas:</strong> Ir a las <strong className="text-primary font-bold">Casillas 1800 a 1804</strong> (Criptoactivos).
                </p>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/40 flex flex-col gap-1">
              <span className="font-bold text-foreground">2. Compensación y Recompra:</span>
              <p className="text-muted-foreground">
                • <strong className="text-foreground">Compensación de Pérdidas:</strong> En caso de saldo negativo, compensar en las <strong className="text-primary font-bold">Casillas 0392 a 0404</strong> (hasta 25% con dividendos e intereses).
              </p>
              <p className="text-muted-foreground">
                • <strong className="text-foreground">Regla 2 Meses:</strong> No recomprar los mismos títulos 2 meses antes/después de vender con pérdida.
              </p>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground border-t border-border/30 pt-2 flex justify-between items-center">
          <span>Budgenext App - Documento de Apoyo Fiscal</span>
          <span>AEAT - Modelo 100</span>
        </div>
      </div>
    </div>
  )
}

// ─── Price Alerts & Macro Economic Calendar ────────────────────────────────────

export interface MacroEvent {
  id: string
  title: string
  variant: string
  dateStr: string
  timeStr: string
  country: string
  flag: string
  impact: "HIGH" | "MEDIUM"
  forecast: string
  previous: string
}

export interface EarningsItem {
  symbol: string
  name: string
  nextEarningsDate: string
  daysUntil: number
  epsEstimate: string
  urgency: "TODAY" | "WEEK" | "MONTH" | "LATER"
}

export function PriceAlertsMacroCalendar({ symbols }: { symbols: string[] }) {
  const [macroEvents, setMacroEvents] = useState<MacroEvent[]>([])
  const [loadingMacro, setLoadingMacro] = useState(true)
  const [earnings, setEarnings] = useState<EarningsItem[]>([])
  const [loadingEarnings, setLoadingEarnings] = useState(true)

  useEffect(() => {
    async function fetchMacroCalendar() {
      try {
        const res = await fetch("/api/macro-calendar")
        const data = await res.json()
        if (Array.isArray(data.events)) setMacroEvents(data.events)
      } catch { /* ignore */ } finally { setLoadingMacro(false) }
    }
    fetchMacroCalendar()
  }, [])

  useEffect(() => {
    if (symbols.length === 0) { setLoadingEarnings(false); return }
    async function fetchEarnings() {
      try {
        const res = await fetch(`/api/earnings?symbols=${symbols.join(",")}`)
        const data = await res.json()
        if (Array.isArray(data.earnings)) setEarnings(data.earnings)
      } catch { /* ignore */ } finally { setLoadingEarnings(false) }
    }
    fetchEarnings()
  }, [symbols.join(",")])

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-150">
      <div className="rounded-2xl bg-gradient-to-br from-card via-background to-amber-950/10 p-4 border border-amber-500/20 shadow-md">
        <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              📅
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-foreground">
                Calendario Macroeconómico Semanal & Eventos en Directo
              </h3>
              <p className="text-xs text-muted-foreground">
                Datos semanales en tiempo real de IPC, decisiones de tipos Fed/BCE y mercado laboral
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">
            API EN DIRECTO 🟢
          </span>
        </div>

        {loadingMacro ? (
          <div className="flex items-center justify-center p-8 gap-3 text-xs text-muted-foreground animate-pulse">
            <span className="h-3 w-3 rounded-full bg-amber-500 animate-ping" />
            <span>Cargando eventos macroeconómicos semanales desde la API en directo…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {macroEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex flex-col justify-between p-3 rounded-xl bg-secondary/30 border border-border/40 hover:border-amber-500/40 transition-all gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-black flex items-center gap-1.5 text-foreground">
                    <span>{evt.flag}</span>
                    <span className="truncate max-w-[130px]">{evt.country}</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {evt.variant && (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        {evt.variant}
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${
                        evt.impact === "HIGH"
                          ? "bg-red-500/10 text-red-500 border-red-500/30"
                          : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                      }`}
                    >
                      {evt.impact === "HIGH" ? "🔴 ALTO" : "🟡 MEDIO"}
                    </span>
                  </div>
                </div>

                <p className="text-xs font-bold text-foreground leading-snug line-clamp-2">
                  {evt.title}
                </p>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/20 mt-1">
                  <span className="font-extrabold text-amber-400">
                    ⏱️ {evt.dateStr} · {evt.timeStr}
                  </span>
                  <span className="text-muted-foreground font-semibold">
                    Prev: <strong className="text-foreground">{evt.forecast}</strong>
                    {evt.previous && evt.previous !== "N/D" && (
                      <span className="text-muted-foreground"> · Ant: {evt.previous}</span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-card via-background to-emerald-950/10 p-4 border border-emerald-500/20 shadow-md">
        <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">📈</span>
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Próximos Resultados Trimestrales de tu Cartera</h3>
              <p className="text-xs text-muted-foreground">Fecha de publicación de resultados para tus acciones vía TradingView</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">API EN DIRECTO 🟢</span>
        </div>

        {loadingEarnings ? (
          <div className="flex items-center justify-center p-8 gap-3 text-xs text-muted-foreground animate-pulse">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
            <span>Consultando fechas de resultados en TradingView…</span>
          </div>
        ) : earnings.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No se encontraron próximas fechas de resultados para tus acciones.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {earnings.map((item) => {
              const urgencyStyle =
                item.urgency === "TODAY" ? "border-red-500/40 bg-red-500/5"
                : item.urgency === "WEEK" ? "border-amber-500/40 bg-amber-500/5"
                : item.urgency === "MONTH" ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border/40 bg-secondary/20"
              const urgencyBadge =
                item.urgency === "TODAY" ? "🔴 HOY"
                : item.urgency === "WEEK" ? "🟡 Esta semana"
                : item.urgency === "MONTH" ? "🟢 Este mes"
                : "🔵 Próximamente"

              return (
                <div key={item.symbol} className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${urgencyStyle}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-foreground">{item.symbol}</p>
                      <p className="text-[10px] text-muted-foreground font-medium truncate max-w-[150px]">{item.name}</p>
                    </div>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-background/60 border border-border/40 text-muted-foreground">
                      {urgencyBadge}
                    </span>
                  </div>
                  <div className="border-t border-border/20 pt-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-semibold">📅 Fecha:</span>
                      <span className="font-extrabold text-foreground">{item.nextEarningsDate}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-semibold">⏳ Faltan:</span>
                      <span className="font-black text-emerald-400">
                        {item.daysUntil === 0 ? "¡HOY!" : `${item.daysUntil} días`}
                      </span>
                    </div>
                    {item.epsEstimate !== "N/D" && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-semibold">BPA estimado:</span>
                        <span className="font-bold text-foreground">{item.epsEstimate}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Financial News Ticker Bar Component ─────────────────────────────────────

export function FinancialNewsTickerBar() {
  const [news, setNews] = useState<{ id: string; title: string; category: string; timeAgo: string; url: string }[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchNews() {
    try {
      const res = await fetch("/api/news")
      const data = await res.json()
      if (Array.isArray(data.news) && data.news.length > 0) {
        setNews(data.news)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, 300000)
    return () => clearInterval(interval)
  }, [])

  if (loading && news.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-secondary/40 px-3 py-2 border border-border/30 text-xs text-muted-foreground animate-pulse mb-3">
        <span className="h-2 w-2 rounded-full bg-red-500 animate-ping shrink-0" />
        <span>Cargando noticias de macroeconomía e inversión en directo…</span>
      </div>
    )
  }

  const displayNews = [...news, ...news]

  function getCategoryBadgeStyle(cat: string) {
    if (cat.includes("MACRO") || cat.includes("IPC")) {
      return "bg-amber-500/15 border-amber-500/40 text-amber-500 font-extrabold"
    }
    if (cat.includes("EUROPA")) {
      return "bg-cyan-500/15 border-cyan-500/40 text-cyan-400 font-extrabold"
    }
    if (cat.includes("USA")) {
      return "bg-blue-500/15 border-blue-500/40 text-blue-400 font-extrabold"
    }
    if (cat.includes("ASIA")) {
      return "bg-purple-500/15 border-purple-500/40 text-purple-400 font-extrabold"
    }
    if (cat.includes("COMMODITIES") || cat.includes("ORO")) {
      return "bg-amber-500/15 border-amber-500/40 text-amber-400 font-extrabold"
    }
    if (cat.includes("CRIPTO")) {
      return "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-extrabold"
    }
    return "bg-secondary/80 border-border/40 text-foreground font-bold"
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-2xl bg-gradient-to-r from-red-950/20 via-background to-emerald-950/20 border border-border/50 p-2.5 sm:px-3.5 sm:py-2.5 text-sm shadow-xs mb-4">
      <div className="flex items-center justify-between sm:justify-start shrink-0 border-b sm:border-b-0 border-border/20 pb-1.5 sm:pb-0">
        <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-red-500/40 text-red-500 font-black text-[11px] sm:text-xs shadow-2xs">
          <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-red-500"></span>
          </span>
          <span className="tracking-wider uppercase">NOTICIAS 12H</span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden min-w-0">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-background to-transparent z-10" />

        <div className="animate-marquee flex items-center gap-6 whitespace-nowrap">
          {displayNews.map((item, idx) => (
            <a
              key={`${item.id}-${idx}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <span className={`px-2 py-0.5 rounded-md text-[11px] sm:text-xs border uppercase ${getCategoryBadgeStyle(item.category)}`}>
                {item.category}
              </span>
              <span className="font-bold text-xs sm:text-sm text-foreground hover:underline tracking-tight">
                {item.title}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground/80">
                • {item.timeAgo}
              </span>
              <span className="mx-2 text-muted-foreground/30 font-bold">|</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
