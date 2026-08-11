"use client"

import { useState, useEffect, useCallback, useTransition, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  X,
  Search,
  BarChart2,
  Minus,
  AlertCircle,
  ExternalLink,
  Edit2,
  Check,
  Wallet,
  Target,
} from "lucide-react"
import { upsertStockPosition, deleteStockPosition } from "@/app/actions"
import type { StockPosition } from "@/app/actions"

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockQuote {
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

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: StockQuote }
  | { status: "error"; message: string }

// ─── Suggestions ──────────────────────────────────────────────────────────────

const SUGGESTIONS = [
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

// ─── Currency constants ───────────────────────────────────────────────────────

const CURRENCIES = [
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "USD", label: "Dólar EE.UU.", symbol: "$" },
  { code: "GBP", label: "Libra Esterlina", symbol: "£" },
  { code: "CHF", label: "Franco Suizo", symbol: "Fr" },
  { code: "JPY", label: "Yen Japonés", symbol: "¥" },
  { code: "CAD", label: "Dólar Canadiense", symbol: "CA$" },
  { code: "AUD", label: "Dólar Australiano", symbol: "A$" },
]

const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.symbol])
)

const DISPLAY_CURRENCY_KEY = "finflow_display_currency"

async function fetchQuote(symbol: string): Promise<StockQuote> {
  const res = await fetch(`/api/stock-price?symbol=${encodeURIComponent(symbol)}`)
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error ?? "Error de red")
  return json as StockQuote
}

// ─── P&L Display ─────────────────────────────────────────────────────────────

function PortfolioPosition({
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

  // Purchase & current FX rates (displayCurrency per 1 native currency)
  const purchaseFx = avgFxRate && avgFxRate > 0 ? avgFxRate : (conversionRate > 0 ? conversionRate : 1)
  const currentFx = conversionRate > 0 ? conversionRate : purchaseFx

  // Converted values
  const investedDisp = needsConversion ? investedNative * purchaseFx : investedNative
  const currentDisp = needsConversion ? currentNative * currentFx : currentNative
  const totalPLDisp = currentDisp - investedDisp
  const totalPLPct = investedDisp > 0 ? (totalPLDisp / investedDisp) * 100 : 0
  const isTotalGain = totalPLDisp >= 0

  // FX Impact breakdown (only relevant if foreign currency)
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

        {/* Foreign currency impact breakdown */}
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

function PositionForm({
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

  // Calculate initial FX percentage difference: ((current - purchase) / purchase) * 100
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
        // purchaseFxRate = currentConversionRate / (1 + pct/100)
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

function TickerCard({
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

  // Reset logo error when position symbol changes
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
          {/* Logo or colored icon */}
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
            <p className="text-sm font-bold text-foreground truncate">
              {displayName}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {position.symbol}
            </p>
          </div>
        </div>

        {/* Action buttons */}
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

      {/* Price skeleton */}
      {state.status === "loading" && (
        <div className="flex items-center gap-2">
          <div className="h-7 w-24 animate-pulse rounded-lg bg-border/60" />
          <div className="h-4 w-16 animate-pulse rounded-lg bg-border/40" />
        </div>
      )}

      {/* Price data */}
      {state.status === "ok" && (
        <>
          {/* Current price + change */}
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

          {/* Sub-stats row */}
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

          {/* P&L block */}
          {hasPosition && !editing && (() => {
            const nativeCurrency = state.data.currency
            const fxKey = `${nativeCurrency}${displayCurrency}`
            const rate = nativeCurrency === displayCurrency ? 1 : (fxRates[fxKey] ?? 0)
            return (
              <PortfolioPosition
                shares={position.shares!}
                avgPrice={position.avgPrice!}
                avgFxRate={position.avgFxRate ?? null}
                currentPrice={state.data.price}
                currency={nativeCurrency}
                displayCurrency={displayCurrency}
                conversionRate={rate}
              />
            )
          })()}

          {/* CTA if no position set */}
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

      {/* Error state */}
      {state.status === "error" && (
        <div className="flex items-center gap-2 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="line-clamp-2">{state.message}</span>
        </div>
      )}

      {/* Inline edit form */}
      {editing && (() => {
        const nativeCurrency = state.status === "ok" ? state.data.currency : "USD"
        const fxKey = `${nativeCurrency}${displayCurrency}`
        const rate = nativeCurrency === displayCurrency ? 1 : (fxRates[fxKey] ?? 0)
        return (
          <PositionForm
            shares={position.shares ?? null}
            avgPrice={position.avgPrice ?? null}
            avgFxRate={position.avgFxRate ?? null}
            currency={nativeCurrency}
            displayCurrency={displayCurrency}
            conversionRate={rate}
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

interface SearchResult {
  id: string
  symbol: string
  description: string
  exchange: string
  type: string
}

const TYPE_LABEL: Record<string, string> = {
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

function AddSymbolModal({
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

  // Debounced search — fires 300ms after the user stops typing
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
    setResults([]) // Clear previous results immediately so old search results do not linger

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
        {/* Header */}
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

        {/* Position fields */}
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

        {/* Search input */}
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

        {/* Error */}
        {searchError && (
          <p className="text-xs text-destructive mb-2 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />{searchError}
          </p>
        )}

        {/* Results list */}
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

// ─── Visual Helpers & Colors ──────────────────────────────────────────────────

const ASSET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16",
  "#14b8a6", "#6366f1"
]

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  if (end - start >= 359.9) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`
  }
  const s = polarToCartesian(cx, cy, r, start)
  const e = polarToCartesian(cx, cy, r, end)
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${e.x} ${e.y} Z`
}

// ─── Compound Growth Projection Chart ─────────────────────────────────────────

function CompoundGrowthChart({
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
  const [monthlyContrib, setMonthlyContrib] = useState(200)

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
    return { years, balance, totalInvested, interestEarned }
  })

  const maxVal = Math.max(...projection.map((p) => p.balance), 1)

  // Canvas dimensions: 480 x 180
  const pointsTotal = projection.map((p, idx) => {
    const x = 40 + (idx / (yearsList.length - 1)) * 410
    const y = 150 - (p.balance / maxVal) * 120
    return { x, y, ...p }
  })

  const pointsInvested = projection.map((p, idx) => {
    const x = 40 + (idx / (yearsList.length - 1)) * 410
    const y = 150 - (p.totalInvested / maxVal) * 120
    return { x, y }
  })

  const pathTotal = pointsTotal.reduce(
    (acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
    ""
  )

  const areaTotal = `${pathTotal} L ${pointsTotal[pointsTotal.length - 1].x} 150 L ${pointsTotal[0].x} 150 Z`

  const pathInvested = pointsInvested.reduce(
    (acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
    ""
  )

  const areaInvested = `${pathInvested} L ${pointsInvested[pointsInvested.length - 1].x} 150 L ${pointsInvested[0].x} 150 Z`

  const year30 = projection[projection.length - 1]

  return (
    <div className="flex flex-col gap-4 bg-background/60 rounded-2xl p-5 border border-border/40 shadow-xs">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            🚀 Proyección de Interés Compuesto
          </h4>
          <p className="text-xs text-muted-foreground">
            Patrimonio inicial: <span className="font-extrabold text-foreground">{dispSym}{initialValue.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 bg-secondary/80 rounded-xl px-3 py-1.5 border border-border/50">
            <span className="text-xs font-semibold text-muted-foreground">Rendimiento anual:</span>
            <input
              type="number"
              min="1"
              max="50"
              step="0.5"
              value={returnPct}
              onChange={(e) => setReturnPct(parseFloat(e.target.value) || 0)}
              className="w-12 bg-transparent font-extrabold text-primary focus:outline-none text-right text-xs"
            />
            <span className="font-bold text-primary text-xs">%</span>
          </div>

          <div className="flex items-center gap-1.5 bg-secondary/80 rounded-xl px-3 py-1.5 border border-border/50">
            <span className="text-xs font-semibold text-muted-foreground">Aporte mensual:</span>
            <input
              type="number"
              min="0"
              step="50"
              value={monthlyContrib}
              onChange={(e) => setMonthlyContrib(parseFloat(e.target.value) || 0)}
              className="w-16 bg-transparent font-extrabold text-foreground focus:outline-none text-right text-xs"
            />
            <span className="font-bold text-foreground text-xs">{dispSym}/mes</span>
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-1">
            {[100, 200, 500].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setMonthlyContrib(amt)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                  monthlyContrib === amt
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/60 text-muted-foreground border-border/40 hover:text-foreground"
                }`}
              >
                +{amt}{dispSym}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Chart + Legend */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
        <div className="lg:col-span-3 flex flex-col items-center">
          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mb-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-primary/40 border border-primary shrink-0" />
              <span className="font-semibold text-muted-foreground">Patrimonio Total (con Intereses)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-secondary border border-border shrink-0" />
              <span className="font-semibold text-muted-foreground">Capital Aportado</span>
            </div>
          </div>

          <svg viewBox="0 0 480 180" className="w-full h-auto max-h-56 overflow-visible">
            <defs>
              <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary, #3b82f6)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--color-primary, #3b82f6)" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-secondary, #6b7280)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--color-secondary, #6b7280)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1="40"
                y1={150 - ratio * 120}
                x2="450"
                y2={150 - ratio * 120}
                stroke="currentColor"
                strokeDasharray="3 3"
                className="text-border/40"
              />
            ))}

            {/* Total Area & Line */}
            <path d={areaTotal} fill="url(#totalGrad)" />
            <path d={pathTotal} fill="none" stroke="var(--color-primary, #3b82f6)" strokeWidth="3" />

            {/* Invested Area & Line */}
            <path d={areaInvested} fill="url(#investedGrad)" />
            <path d={pathInvested} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />

            {/* Points & Year Labels */}
            {pointsTotal.map((p) => (
              <g key={p.years} className="group cursor-pointer">
                <circle cx={p.x} cy={p.y} r="5" fill="var(--color-primary, #3b82f6)" className="transition-all group-hover:r-7" />
                <text x={p.x} y="170" textAnchor="middle" className="text-[11px] fill-muted-foreground font-bold">
                  {p.years}a
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Highlight Card for 30 Years */}
        <div className="flex flex-col gap-2.5 rounded-2xl bg-primary/10 border border-primary/30 p-4 text-center">
          <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">
            Resultado a 30 Años
          </span>
          <p className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight">
            {dispSym}
            {year30?.balance.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
          </p>
          <div className="flex justify-between text-xs border-t border-primary/20 pt-2 mt-1">
            <span className="text-muted-foreground font-medium">Aportaciones</span>
            <span className="font-bold text-foreground">
              {dispSym}
              {year30?.totalInvested.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground font-medium">Interés generado</span>
            <span className="font-extrabold text-positive">
              +{dispSym}
              {year30?.interestEarned.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Index Comparison Line Chart (Smooth Bezier Curves) ──────────────────────

const BENCHMARKS = [
  { symbol: "VANTAGE:SP500", name: "S&P 500", icon: "🇺🇸", ytdPct: 12.51, color: "#3b82f6" },
  { symbol: "FOREXCOM:NSXUSD", name: "Nasdaq 100", icon: "🚀", ytdPct: 15.84, color: "#8b5cf6" },
  { symbol: "BME:IBC", name: "Ibex 35", icon: "🇪🇸", ytdPct: 16.86, color: "#f59e0b" },
  { symbol: "TVC:GOLD", name: "Oro (Gold)", icon: "🥇", ytdPct: 1.49, color: "#eab308" },
  { symbol: "BINANCE:BTCUSDT", name: "Bitcoin", icon: "🪙", ytdPct: -27.52, color: "#ef4444" },
]

const TIME_MONTHS = ["Ene", "Mar", "May", "Jul", "Sep", "Nov", "YTD (Año)"]

function getBezierPathD(pts: { x: number; y: number }[]) {
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

function IndexComparisonChart({
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

  // Valid user positions
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

  // Collect all month labels from history (e.g., Ene, Feb, Mar, Abr, May, Jun, Jul, Ago)
  const sampleHist = Object.values(historyData).find((h) => Array.isArray(h) && h.length > 0)
  const monthLabels = sampleHist && sampleHist.length >= 3
    ? sampleHist.map((h) => h.month)
    : TIME_MONTHS

  // Calculate portfolio's total invested capital in display currency
  const totalInvestedDisp = validPositions.reduce((acc, pos) => {
    const priceData = currentPrices[pos.symbol]
    const nativeCurr = priceData?.currency ?? "USD"
    const fxKey = `${nativeCurr}${displayCurrency}`
    const currentFx = nativeCurr === displayCurrency ? 1 : (fxRates[fxKey] ?? 1)
    const purchaseFx = pos.avgFxRate && pos.avgFxRate > 0 ? pos.avgFxRate : currentFx
    return acc + pos.shares! * pos.avgPrice! * purchaseFx
  }, 0)

  // Calculate real monthly weighted portfolio return trajectory
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

  // Calculate max absolute percentage to center the 0% Y baseline
  const allPcts = allSeries.flatMap((s) => s.history.map((h) => Math.abs(h.pct)))
  const maxAbsPct = Math.max(...allPcts, 15)

  // Chart dimensions
  const svgWidth = 540
  const svgHeight = 240
  const paddingLeft = 45
  const paddingRight = 65
  const paddingTop = 25
  const paddingBottom = 35

  const chartWidth = svgWidth - paddingLeft - paddingRight
  const chartHeight = svgHeight - paddingTop - paddingBottom
  const zeroY = paddingTop + chartHeight / 2 // Center line for 0%

  // Build points per series using real monthly candle history
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
      {/* Header */}
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

      {/* Interactive Legend Bar */}
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

      {/* Ultra-Premium SVG Chart */}
      <div className="flex flex-col items-center relative">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-80 overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Soft Green Tint for Positive Zone */}
            <linearGradient id="posZoneGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            {/* Soft Red Tint for Negative Zone */}
            <linearGradient id="negZoneGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.0" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.08" />
            </linearGradient>
            {/* Glow Filter for Portfolio Line */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Zone Tints */}
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

          {/* Grid lines */}
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

          {/* 0% Baseline */}
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

          {/* Hover Crosshair Guide Line */}
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

          {/* Render Smooth Bezier Series Lines */}
          {seriesPaths.map((s) => {
            const isH = s.symbol === activeHighlight
            const strokeWidth = s.isPortfolio ? 3.5 : isH ? 3 : 2.2
            const opacity = activeHighlight === null ? 0.9 : isH || s.isPortfolio ? 1 : 0.2

            return (
              <g key={s.symbol} className="transition-all duration-200">
                {/* Area Fill for Portfolio */}
                {s.isPortfolio && (
                  <path d={s.areaD} fill={s.color} opacity="0.12" />
                )}

                {/* Line Path */}
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

                {/* Points on Line */}
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

                {/* End Point Badge */}
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

          {/* X-Axis Month Hover Targets */}
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

        {/* Hover Month Breakdown Card */}
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

// ─── Official TradingView Technical Chart Widget (Comparison Mode) ─────────

function TradingViewAdvancedWidget({
  positions,
}: {
  positions: StockPosition[]
}) {
  const containerId = useRef(`tv_chart_${Math.random().toString(36).substring(2, 9)}`).current
  const [scriptLoaded, setScriptLoaded] = useState(false)

  // Reactive compare symbols list and weighted portfolio formula derived from user DB inputs
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
        style: "2", // Line chart comparison
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

function PortfolioChartsPanel({
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
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"allocation" | "ranking" | "index" | "tradingview" | "compound">("allocation")

  const dispSym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency

  // Calculate items with valid data
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
      const fxKey = `${nativeCurr}${displayCurrency}`
      const currentFx = nativeCurr === displayCurrency ? 1 : (fxRates[fxKey] ?? 1)
      const purchaseFx = pos.avgFxRate && pos.avgFxRate > 0 ? pos.avgFxRate : currentFx

      const investedDisp = pos.shares * pos.avgPrice * purchaseFx
      const currentDisp = pos.shares * priceData.price * currentFx
      const plDisp = currentDisp - investedDisp
      const plPct = investedDisp > 0 ? (plDisp / investedDisp) * 100 : 0

      return {
        symbol: pos.symbol,
        label: pos.label || pos.symbol,
        currentDisp,
        investedDisp,
        plDisp,
        plPct,
        color: ASSET_COLORS[idx % ASSET_COLORS.length],
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  if (items.length === 0) return null

  const totalCurrentValue = items.reduce((acc, it) => acc + it.currentDisp, 0)
  const totalInvestedValue = items.reduce((acc, it) => acc + it.investedDisp, 0)
  const totalPL = totalCurrentValue - totalInvestedValue
  const totalPLPct = totalInvestedValue > 0 ? (totalPL / totalInvestedValue) * 100 : 0

  const itemsWithWeight = items.map((it) => ({
    ...it,
    weightPct: totalCurrentValue > 0 ? (it.currentDisp / totalCurrentValue) * 100 : 0,
  }))

  // Donut chart slice calculations
  let currentAngle = 0
  const slices = itemsWithWeight.map((it) => {
    const angle = (it.weightPct / 100) * 360
    const start = currentAngle
    const end = currentAngle + angle
    currentAngle = end
    return { ...it, startAngle: start, endAngle: end }
  })

  // Max P&L for bar scaling
  const maxPL = Math.max(...items.map((it) => Math.abs(it.plDisp)), 1)
  const activeItem = itemsWithWeight.find((it) => it.symbol === hoveredSymbol) || itemsWithWeight[0]

  // Ranking by yield % (descending)
  const rankedItems = [...items].sort((a, b) => b.plPct - a.plPct)
  const maxRankPct = Math.max(...rankedItems.map((it) => Math.abs(it.plPct)), 1)

  return (
    <div className="mt-4 rounded-2xl border border-border/50 bg-secondary/20 p-4 flex flex-col gap-4">
      {/* Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/30 pb-2">
        <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <BarChart2 className="h-3.5 w-3.5 text-primary" />
          Análisis Gráfico de Cartera
        </h3>

        <div className="flex flex-wrap items-center gap-1 bg-secondary/60 p-1 rounded-xl text-xs w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("allocation")}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer text-[11px] flex-1 sm:flex-initial text-center ${
              activeTab === "allocation"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📊 Distribución & P&L
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ranking")}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer text-[11px] flex-1 sm:flex-initial text-center ${
              activeTab === "ranking"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🏆 Ranking
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("index")}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer text-[11px] flex-1 sm:flex-initial text-center ${
              activeTab === "index"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📈 Comparativa
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("compound")}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer text-[11px] flex-1 sm:flex-initial text-center ${
              activeTab === "compound"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🚀 Interés Compuesto
          </button>
        </div>
      </div>

      {/* Tab 1: Allocation Donut & Horizontal P&L Bar Chart */}
      {activeTab === "allocation" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center animate-in fade-in duration-150">
          {/* Donut Chart: Asset Distribution */}
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
                  {/* Inner cutout for Donut */}
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

          {/* Horizontal Bar Chart: Rentabilidad por Activo */}
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
                    <div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden flex">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isGain ? "bg-positive" : "bg-destructive"
                        }`}
                        style={{ width: `${Math.max(barPct, 4)}%` }}
                      />
                    </div>
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

                    <div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden flex">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isGain ? "bg-positive" : "bg-destructive"
                        }`}
                        style={{ width: `${Math.max(barPct, 5)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
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
  const [, startTransition] = useTransition()
  const router = useRouter()

  // Load saved currency choice from localStorage
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

  // Sync client state when server data changes (after router.refresh)
  useEffect(() => {
    setPositions(initialPositions)
  }, [initialPositions])

  const handlePriceLoaded = useCallback(
    (symbol: string, price: number, currency: string) => {
      setCurrentPrices((prev) => ({ ...prev, [symbol]: { price, currency } }))
    },
    []
  )

  // Fetch FX rates when needed for currentPrices vs displayCurrency
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
    // Optimistic update
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

  // ── Portfolio summary ─────────────────────────────────────────────────────

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
      const fxKey = `${nativeCurr}${displayCurrency}`
      const currentFx = nativeCurr === displayCurrency ? 1 : (fxRates[fxKey] ?? 1)
      const purchaseFx = pos.avgFxRate && pos.avgFxRate > 0 ? pos.avgFxRate : currentFx

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
    <section className="rounded-3xl bg-card p-5 shadow-sm border border-border/50">
      {/* Header */}
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
          {/* Currency selector */}
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

      {/* Portfolio summary banner */}
      {showSummary && (
        <div
          className={`mt-4 rounded-2xl p-4 border ${
            isPLPositive
              ? "bg-positive/5 border-positive/20"
              : "bg-destructive/5 border-destructive/20"
          }`}
        >
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              Resumen de cartera · {portfolioSummary.count} posición
              {portfolioSummary.count !== 1 ? "es" : ""} con datos
            </span>
            <span className="text-[10px] font-bold text-muted-foreground/80">
              Mostrando en {displayCurrency} ({dispSym})
            </span>
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">
                Capital invertido
              </p>
              <p className="text-lg font-extrabold text-foreground tabular-nums leading-tight">
                {dispSym}
                {portfolioSummary.invested.toLocaleString("es-ES", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">
                Valor actual
              </p>
              <p className="text-lg font-extrabold text-foreground tabular-nums leading-tight">
                {dispSym}
                {portfolioSummary.current.toLocaleString("es-ES", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">
                Rentabilidad total
              </p>
              <p
                className={`text-lg font-extrabold tabular-nums leading-tight ${
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
              <p
                className={`text-[11px] font-bold ${
                  isPLPositive ? "text-positive" : "text-destructive"
                }`}
              >
                ({isPLPositive ? "+" : ""}
                {totalPLPct.toFixed(2)}%)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Visual Portfolio Charts */}
      {showSummary && (
        <PortfolioChartsPanel
          positions={positions}
          currentPrices={currentPrices}
          displayCurrency={displayCurrency}
          fxRates={fxRates}
        />
      )}

      {/* Cards grid */}
      {positions.length === 0 ? (
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
          {/* Add more card */}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-4 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer min-h-[120px]"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs font-semibold">Añadir símbolo</span>
          </button>
        </div>
      )}

      {showModal && (
        <AddSymbolModal onAdd={handleAdd} onClose={() => setShowModal(false)} />
      )}
    </section>
  )
}

