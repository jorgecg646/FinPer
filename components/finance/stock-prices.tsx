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

function formatCompactCurrency(val: number, dispSym: string) {
  if (val >= 1_000_000) {
    const formatted = (val / 1_000_000).toLocaleString("es-ES", {
      maximumFractionDigits: 2,
    })
    return `${formatted} M ${dispSym}`
  }
  if (val >= 10_000) {
    const formatted = (val / 1_000).toLocaleString("es-ES", {
      maximumFractionDigits: 0,
    })
    return `${formatted}k ${dispSym}`
  }
  if (val >= 1_000) {
    const formatted = (val / 1_000).toLocaleString("es-ES", {
      maximumFractionDigits: 1,
    })
    return `${formatted}k ${dispSym}`
  }
  return `${val.toFixed(0)} ${dispSym}`
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
  const [monthlyContrib, setMonthlyContrib] = useState(300)
  const [hoverYearIndex, setHoverYearIndex] = useState<number | null>(6) // Default to 30 years

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

  // Chart dimensions: 560 x 210
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
      {/* Visual Controls Header */}
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

        {/* Dynamic Sliders & Presets */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
          {/* Annual Return Input */}
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

          {/* Monthly Contribution Input */}
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

          {/* Quick Presets */}
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

      {/* Modern SVG Area Chart with Tailwind Glows */}
      <div className="flex flex-col gap-4">
        <div className="relative flex flex-col items-center">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto max-h-80 overflow-visible"
            onMouseLeave={() => setHoverYearIndex(6)}
          >
            <defs>
              {/* Ultra Vibrant Emerald to Indigo Gradient */}
              <linearGradient id="tailwindCompoundTotalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.55" />
                <stop offset="40%" stopColor="#14b8a6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>

              {/* Muted Slate Gradient */}
              <linearGradient id="tailwindCompoundInvestedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#64748b" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#64748b" stopOpacity="0.0" />
              </linearGradient>

              <filter id="emeraldGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Horizontal Grid lines */}
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

            {/* Total Balance Area (Interés Compuesto) */}
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

            {/* Capital Invested Area */}
            <path d={areaInvested} fill="url(#tailwindCompoundInvestedGrad)" />
            <path
              d={pathInvested}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />

            {/* Vertical Guide Line on Active Horizon */}
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

            {/* Interactive Horizon Points */}
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

        {/* Selected Horizon HUD Stats Banner (Tailwind Glassmorphism) */}
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

            {/* Interest Composition Bar */}
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

      {/* Key Horizon Milestone Cards (Tailwind Styling) */}
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

// ─── Sector & Risk Matrix Component ──────────────────────────────────────────

const SECTOR_CONFIGS: Record<
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

function detectSector(symbol: string, label: string): keyof typeof SECTOR_CONFIGS {
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

function SectorRiskAnalysis({
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

  // Group assets by sector
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

  // Weighted Portfolio Risk Score (1-10)
  const weightedRiskScore = useMemo(() => {
    if (totalValue === 0) return 5.0
    const weightedSum = sectorGroups.reduce((acc, g) => {
      return acc + (g.weightPct / 100) * g.config.riskScore
    }, 0)
    return parseFloat(weightedSum.toFixed(1))
  }, [sectorGroups, totalValue])

  // Herfindahl-Hirschman Index (HHI) for Concentration Risk
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
      {/* Header */}
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

      {/* Top Metrics Cards: Risk Score & Concentration HHI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Risk Score Meter */}
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

          {/* Risk Gauge Progress Bar */}
          <div className="h-2.5 w-full rounded-full bg-secondary/80 overflow-hidden flex relative mt-1">
            <div
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-positive via-amber-500 to-destructive"
              style={{ width: `${(weightedRiskScore / 10) * 100}%` }}
            />
          </div>
        </div>

        {/* Concentration Meter */}
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

          {/* Single Sector Dominance Alert */}
          {largestSector && largestSector.weightPct > 40 && (
            <p className="text-[10px] text-amber-500/90 font-medium flex items-center gap-1 mt-1">
              <span>⚠️ Tu sector principal ({largestSector.config.name}) representa el {largestSector.weightPct.toFixed(1)}% de tu capital.</span>
            </p>
          )}
        </div>
      </div>

      {/* Sector Breakdown List */}
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

// ─── Spanish Tax Calculator & Report Export Component ────────────────────────

function calculateSpanishTax(gain: number) {
  if (gain <= 0) return { tax: 0, effectiveRate: 0, breakdown: [] }

  let remaining = gain
  let totalTax = 0
  const breakdown: { bracket: string; rate: number; taxable: number; tax: number }[] = []

  // Bracket 1: 0 - 6,000 € @ 19%
  const b1 = Math.min(remaining, 6000)
  if (b1 > 0) {
    const t = b1 * 0.19
    totalTax += t
    remaining -= b1
    breakdown.push({ bracket: "Hasta 6.000 €", rate: 19, taxable: b1, tax: t })
  }

  // Bracket 2: 6,000.01 - 50,000 € @ 21%
  const b2 = Math.min(remaining, 44000)
  if (b2 > 0) {
    const t = b2 * 0.21
    totalTax += t
    remaining -= b2
    breakdown.push({ bracket: "6.000 € a 50.000 €", rate: 21, taxable: b2, tax: t })
  }

  // Bracket 3: 50,000.01 - 200,000 € @ 23%
  const b3 = Math.min(remaining, 150000)
  if (b3 > 0) {
    const t = b3 * 0.23
    totalTax += t
    remaining -= b3
    breakdown.push({ bracket: "50.000 € a 200.000 €", rate: 23, taxable: b3, tax: t })
  }

  // Bracket 4: 200,000.01 - 300,000 € @ 27%
  const b4 = Math.min(remaining, 100000)
  if (b4 > 0) {
    const t = b4 * 0.27
    totalTax += t
    remaining -= b4
    breakdown.push({ bracket: "200.000 € a 300.000 €", rate: 27, taxable: b4, tax: t })
  }

  // Bracket 5: > 300,000 € @ 28%
  if (remaining > 0) {
    const t = remaining * 0.28
    totalTax += t
    breakdown.push({ bracket: "Más de 300.000 €", rate: 28, taxable: remaining, tax: t })
  }

  const effectiveRate = gain > 0 ? (totalTax / gain) * 100 : 0
  return { tax: totalTax, effectiveRate, breakdown }
}

function SpanishTaxExportCalculator({
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

  // Custom sale percentage per stock (symbol -> percentage 0..100)
  const [customSales, setCustomSales] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((it) => [it.symbol, 100]))
  )

  // Presets: Select all / Deselect all
  function handleSetAll(pct: number) {
    setCustomSales(Object.fromEntries(items.map((it) => [it.symbol, pct])))
  }

  // Active items being sold (>0%)
  const activeSaleItems = useMemo(() => {
    return items.filter((it) => (customSales[it.symbol] ?? 0) > 0)
  }, [items, customSales])

  // Calculation for custom selection mix
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

  // Asset types present in active selection
  const hasCrypto = activeSaleItems.some((it) =>
    it.symbol.includes("BTC") || it.symbol.includes("ETH") || it.symbol.includes("BINANCE:") || it.symbol.includes("CRYPTO:")
  )
  const hasStocks = activeSaleItems.some((it) => !hasCrypto)

  return (
    <div className="flex flex-col gap-4 bg-background/60 rounded-2xl p-4 border border-border/40 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            🇪🇸 Calculadora Fiscal IRPF & Guía de Renta (España)
          </h4>
          <p className="text-xs text-muted-foreground">
            Selecciona de forma individual qué acciones y qué % vas a vender simultáneamente
          </p>
        </div>

        {/* Print / PDF Button */}
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-all hover:opacity-90 flex items-center gap-2 cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <span>📄 Descargar Informe PDF / Imprimir</span>
        </button>
      </div>

      {/* Per-Stock Individual Sale Selection Controls */}
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

        {/* Per-Stock Controls Grid */}
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
                        [it.symbol]: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-primary cursor-pointer h-1.5"
                  />
                </div>

                {isSelling ? (
                  <div className="flex justify-between text-[10px] text-muted-foreground pt-0.5">
                    <span>Vender: {dispSym}{itemSaleCur.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</span>
                    <span className={`font-bold tabular-nums ${itemSalePL >= 0 ? "text-positive" : "text-destructive"}`}>
                      Plusvalía: {itemSalePL >= 0 ? "+" : ""}{dispSym}{itemSalePL.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic">No se vende este activo</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tax Calculation Results Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Gross Capital Gain */}
        <div className="rounded-xl p-3.5 border bg-card border-border/40 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Plusvalía / Pérdida Bruta</span>
          <span className={`text-xl font-extrabold tabular-nums ${totalGain >= 0 ? "text-positive" : "text-destructive"}`}>
            {totalGain >= 0 ? "+" : ""}{dispSym}{totalGain.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {totalGain >= 0 ? "Ganancia patrimonial imponible" : "Pérdida patrimonial compensable"}
          </span>
        </div>

        {/* Estimated IRPF Tax */}
        <div className="rounded-xl p-3.5 border bg-card border-border/40 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Impuesto a Pagar en IRPF</span>
          <span className="text-xl font-extrabold text-destructive tabular-nums">
            -{dispSym}{taxCalculation.tax.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Tipo efectivo global: <span className="font-bold text-foreground">{taxCalculation.effectiveRate.toFixed(2)}%</span>
          </span>
        </div>

        {/* Net Profit in Pocket */}
        <div className="rounded-xl p-3.5 border bg-card border-border/40 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Beneficio Neto en Bolsillo</span>
          <span className={`text-xl font-extrabold tabular-nums ${netProfit >= 0 ? "text-positive" : "text-destructive"}`}>
            {netProfit >= 0 ? "+" : ""}{dispSym}{netProfit.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-muted-foreground">Limpio tras abonar IRPF</span>
        </div>
      </div>

      {/* Tax Brackets Breakdown */}
      {taxCalculation.breakdown.length > 0 && (
        <div className="flex flex-col gap-2 bg-secondary/20 p-3 rounded-xl border border-border/30">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
            Desglose por Tramos IRPF del Ahorro en España (Base Imponible del Ahorro)
          </p>

          <div className="flex flex-col gap-1.5">
            {taxCalculation.breakdown.map((b, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-border/20 last:border-0">
                <span className="text-muted-foreground">
                  Tramo {idx + 1}: <span className="font-semibold text-foreground">{b.bracket}</span> ({b.rate}%)
                </span>
                <span className="font-bold tabular-nums text-foreground">
                  Base: {dispSym}{b.taxable.toLocaleString("es-ES", { maximumFractionDigits: 0 })} →{" "}
                  <span className="text-destructive font-extrabold">-{dispSym}{b.tax.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Print Specific CSS Rules */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide everything outside the essential tax report */
          body * {
            visibility: hidden !important;
          }
          .printable-report, .printable-report * {
            visibility: visible !important;
          }
          .printable-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #111827 !important;
            border: 1px solid #d1d5db !important;
            padding: 24px !important;
            border-radius: 8px !important;
            box-shadow: none !important;
          }
          .printable-report * {
            color: #111827 !important;
          }
          button, select, input, nav, header, footer {
            display: none !important;
          }
        }
      `}} />

      {/* Printable Essential Tax Report & Agencia Tributaria Guide */}
      <div className="printable-report rounded-2xl p-5 bg-background border border-border/60 text-xs flex flex-col gap-4">
        {/* Document Header */}
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

        {/* Essential Asset Sale Table (100% Responsive) */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold text-foreground uppercase tracking-wide">
            Desglose de Venta ({activeSaleItems.length} activos seleccionados)
          </p>

          <div className="overflow-x-auto rounded-xl border border-border/40 bg-background/50 p-1 shadow-2xs">
            <table className="w-full text-left border-collapse text-xs min-w-[540px]">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-bold bg-secondary/40">
                  <th className="py-2 px-3">Activo / Símbolo</th>
                  <th className="py-2 px-3 text-center">% Venta</th>
                  <th className="py-2 px-3 text-right">Adquisición (Compra)</th>
                  <th className="py-2 px-3 text-right">Transmisión (Venta)</th>
                  <th className="py-2 px-3 text-right">Plusvalía / Pérdida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {activeSaleItems.map((it) => {
                  const pct = (customSales[it.symbol] ?? 0) / 100
                  const inv = it.investedDisp * pct
                  const cur = it.currentDisp * pct
                  const pl = cur - inv
                  return (
                    <tr key={it.symbol} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-2 px-3 font-extrabold text-foreground">{it.label} ({it.symbol})</td>
                      <td className="py-2 px-3 text-center font-bold">{customSales[it.symbol]}%</td>
                      <td className="py-2 px-3 text-right font-semibold tabular-nums">{dispSym}{inv.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="py-2 px-3 text-right font-semibold tabular-nums">{dispSym}{cur.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className={`py-2 px-3 text-right font-black tabular-nums ${pl >= 0 ? "text-positive" : "text-destructive"}`}>
                        {pl >= 0 ? "+" : ""}{dispSym}{pl.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Essential Operation Totals (100% Responsive Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-secondary/30 p-3.5 sm:p-4 rounded-xl border border-border/40">
          <div className="bg-background/40 p-2.5 rounded-lg border border-border/30">
            <span className="text-muted-foreground block text-[10px] font-bold uppercase">Total Compra (Adquisición):</span>
            <span className="font-extrabold text-sm tabular-nums text-foreground">{dispSym}{totalInvested.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-background/40 p-2.5 rounded-lg border border-border/30">
            <span className="text-muted-foreground block text-[10px] font-bold uppercase">Total Venta (Transmisión):</span>
            <span className="font-extrabold text-sm tabular-nums text-foreground">{dispSym}{totalCurrent.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-background/40 p-2.5 rounded-lg border border-border/30">
            <span className="text-muted-foreground block text-[10px] font-bold uppercase">Plusvalía Bruta Imponible:</span>
            <span className={`font-extrabold text-sm tabular-nums ${totalGain >= 0 ? "text-positive" : "text-destructive"}`}>
              {totalGain >= 0 ? "+" : ""}{dispSym}{totalGain.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-background/40 p-2.5 rounded-lg border border-border/30">
            <span className="text-muted-foreground block text-[10px] font-bold uppercase">Retención IRPF Estimada:</span>
            <span className="font-extrabold text-sm tabular-nums text-destructive">
              -{dispSym}{taxCalculation.tax.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Essential Step-by-Step Renta Web Guide */}
        <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
          <p className="font-bold text-foreground text-xs uppercase tracking-wide">
            📌 Casillas Oficiales para la Declaración en Renta Web (Modelo 100)
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            {/* Step 1 & 2 */}
            <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/40 flex flex-col gap-1">
              <span className="font-bold text-foreground">1. Casillas Exactas a Cumplimentar:</span>
              {hasStocks && (
                <p className="text-muted-foreground">
                  • <strong className="text-foreground">Acciones / Fondos / ETFs:</strong> Ir a <strong className="text-primary font-bold">Casilla 328 y 329</strong>. Indicar como <em>Valor de Transmisión</em>: <strong className="text-foreground">{dispSym}{totalCurrent.toFixed(2)}</strong> y como <em>Valor de Adquisición</em>: <strong className="text-foreground">{dispSym}{totalInvested.toFixed(2)}</strong>.
                </p>
              )}
              {hasCrypto && (
                <p className="text-muted-foreground mt-1">
                  • <strong className="text-foreground">Criptomonedas:</strong> Ir a las <strong className="text-primary font-bold">Casillas 1800 a 1804</strong> (Criptoactivos).
                </p>
              )}
            </div>

            {/* Step 3 & 4 */}
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

        {/* Document Footer */}
        <div className="text-[10px] text-muted-foreground border-t border-border/30 pt-2 flex justify-between items-center">
          <span>FinPer App - Documento de Apoyo Fiscal</span>
          <span>AEAT - Modelo 100</span>
        </div>
      </div>
    </div>
  )
}

// ─── Price Alerts & Macro Economic Calendar ────────────────────────────────────

interface MacroEvent {
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

interface EarningsItem {
  symbol: string
  name: string
  nextEarningsDate: string
  daysUntil: number
  epsEstimate: string
  urgency: "TODAY" | "WEEK" | "MONTH" | "LATER"
}

function PriceAlertsMacroCalendar({ symbols }: { symbols: string[] }) {
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
      {/* Top Banner: Macroeconomic Calendar */}
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

      {/* Earnings Calendar: next results per portfolio stock */}
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

// ─── Visual Portfolio Charts Panel ───────────────────────────────────────────

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

  // Compute values for positions with data
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

  // Donut chart slices calculation
  let cumulativeAngle = 0
  const slices = itemsWithWeight.map((it) => {
    const sliceAngle = (it.weightPct / 100) * 360
    const startAngle = cumulativeAngle
    const endAngle = cumulativeAngle + sliceAngle
    cumulativeAngle = endAngle
    return { ...it, startAngle, endAngle }
  })

  // Ranking items sorted by plPct descending
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
          <button
            type="button"
            onClick={() => setActiveTab("allocation")}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer text-[11px] flex-1 sm:flex-initial text-center ${
              activeTab === "allocation"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📊 Distribución
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
            onClick={() => setActiveTab("sector")}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer text-[11px] flex-1 sm:flex-initial text-center ${
              activeTab === "sector"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🛡️ Sectores
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer text-[11px] flex-1 sm:flex-initial text-center ${
              activeTab === "alerts"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🔔 Alertas & Macro
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
          <button
            type="button"
            onClick={() => setActiveTab("tax")}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer text-[11px] flex-1 sm:flex-initial text-center ${
              activeTab === "tax"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🇪🇸 Fiscalidad
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


// ─── Financial News Ticker Bar Component ─────────────────────────────────────

function FinancialNewsTickerBar() {
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
    if (cat.includes("USA")) {
      return "bg-blue-500/15 border-blue-500/40 text-blue-400 font-extrabold"
    }
    if (cat.includes("ASIA")) {
      return "bg-purple-500/15 border-purple-500/40 text-purple-400 font-extrabold"
    }
    if (cat.includes("ORO")) {
      return "bg-yellow-500/15 border-yellow-500/40 text-yellow-400 font-extrabold"
    }
    if (cat.includes("CRIPTO")) {
      return "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-extrabold"
    }
    return "bg-secondary/80 border-border/40 text-foreground font-bold"
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-2xl bg-gradient-to-r from-red-950/20 via-background to-emerald-950/20 border border-border/50 p-2.5 sm:px-3.5 sm:py-2.5 text-sm shadow-xs mb-4">
      {/* Mobile & Desktop Header Pill */}
      <div className="flex items-center justify-between sm:justify-start shrink-0 border-b sm:border-b-0 border-border/20 pb-1.5 sm:pb-0">
        <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-red-500/40 text-red-500 font-black text-[11px] sm:text-xs shadow-2xs">
          <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-red-500"></span>
          </span>
          <span className="tracking-wider uppercase">NOTICIAS 24H</span>
        </div>
      </div>

      {/* Marquee Track Container with Gradient Edge Masks */}
      <div className="relative flex-1 overflow-hidden min-w-0">
        {/* Left & Right Edge Fade Masks */}
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
    <section className="rounded-3xl bg-card p-4 sm:p-5 shadow-sm border border-border/50">
      {/* Live Financial News Ticker Bar */}
      <FinancialNewsTickerBar />

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

      {/* Responsive Portfolio summary banner */}
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

      {/* Dynamic Visual Portfolio Charts */}
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

      {/* Cards grid (Only visible in the first 3 sections: allocation, ranking, sector) */}
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
        )
      )}

      {showModal && (
        <AddSymbolModal onAdd={handleAdd} onClose={() => setShowModal(false)} />
      )}
    </section>
  )
}

