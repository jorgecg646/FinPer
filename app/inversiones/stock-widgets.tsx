"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
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
  Newspaper,
} from "lucide-react"
import type { StockPosition } from "@/app/actions"
import { CURRENCY_SYMBOLS, getFxPair, getTradingViewLogoUrl, fmtCurrency, fmtSignedCurrency } from "@/lib/format"
import { useVisibilityPolling } from "@/lib/hooks"

// ─── Types & Constants ────────────────────────────────────────────────────────

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

export const SUGGESTIONS = [
  { label: "Apple", symbol: "NASDAQ:AAPL", logoid: "apple" },
  { label: "NVIDIA", symbol: "NASDAQ:NVDA", logoid: "nvidia" },
  { label: "Microsoft", symbol: "NASDAQ:MSFT", logoid: "microsoft" },
  { label: "S&P 500 ETF", symbol: "AMEX:SPY", logoid: "spdr-sp-500-etf-trust" },
  { label: "Ibex 35", symbol: "BME:IBC", logoid: "country/ES" },
  { label: "Amazon", symbol: "NASDAQ:AMZN", logoid: "amazon" },
  { label: "Tesla", symbol: "NASDAQ:TSLA", logoid: "tesla" },
  { label: "Oro", symbol: "TVC:GOLD", logoid: "metal/gold--big" },
  { label: "Bitcoin", symbol: "BINANCE:BTCUSDT", logoid: "crypto/XTVCBTC" },
  { label: "Ethereum", symbol: "BINANCE:ETHUSDT", logoid: "crypto/XTVCETH" },
  { label: "Solana", symbol: "BINANCE:SOLUSDT", logoid: "crypto/XTVCSOL" },
]

export async function fetchQuote(symbol: string): Promise<StockQuote> {
  const res = await fetch(`/api/stock-price?symbol=${encodeURIComponent(symbol)}`)
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error ?? "Error de red")
  return json as StockQuote
}

export async function fetchQuotes(symbols: string[]): Promise<Record<string, StockQuote>> {
  if (symbols.length === 0) return {}
  const res = await fetch(`/api/stock-price?symbols=${encodeURIComponent(symbols.join(","))}`)
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error ?? "Error de red")
  return json as Record<string, StockQuote>
}

// ─── Portfolio Position Breakdown ─────────────────────────────────────────────

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
  avgFxRate: number | null
  currentPrice: number
  currency: string
  displayCurrency: string
  conversionRate: number
}) {
  const needsConv = currency !== displayCurrency
  const nSym = CURRENCY_SYMBOLS[currency] ?? currency
  const dSym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency
  const fSym = dSym

  // Native calculations
  const invNative = shares * avgPrice
  const curNative = shares * currentPrice
  const nPL = curNative - invNative
  const nPLPct = invNative > 0 ? (nPL / invNative) * 100 : 0
  const isNGain = nPL >= 0

  // FX calculations
  const buyFx = avgFxRate && avgFxRate > 0 ? avgFxRate : conversionRate
  const invDisp = invNative * buyFx
  const curDisp = curNative * conversionRate
  const totPL = curDisp - invDisp
  const totPct = invDisp > 0 ? (totPL / invDisp) * 100 : 0
  const isTotGain = totPL >= 0

  // FX impact
  const fxImp = curNative * (conversionRate - buyFx)
  const fxPct = buyFx > 0 ? ((conversionRate - buyFx) / buyFx) * 100 : 0

  return (
    <div className="flex flex-col gap-1.5 pt-2 border-t border-border/30">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Capital invertido</span>
        <span className="font-bold text-foreground tabular-nums">
          {fmtCurrency(invDisp, fSym)}
          {needsConv && <span className="text-muted-foreground/60 ml-1 text-[9px]">({fmtCurrency(invNative, nSym)})</span>}
        </span>
      </div>

      {/* Valor actual */}
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Valor actual</span>
        <span className="font-bold text-foreground tabular-nums">
          {fmtCurrency(curDisp, fSym)}
          {needsConv && <span className="text-muted-foreground/60 ml-1 text-[9px]">({fmtCurrency(curNative, nSym)})</span>}
        </span>
      </div>

      {needsConv && (
        <div className="my-1 rounded-lg bg-background/60 p-2 flex flex-col gap-1 text-[11px] border border-border/40">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <span>📈 Rendimiento activo</span><span className="text-[9px] text-muted-foreground/60">({currency})</span>
            </span>
            <span className={`font-bold tabular-nums ${isNGain ? "text-positive" : "text-destructive"}`}>
              {fmtSignedCurrency(nPL, nSym)} <span className="text-[10px]">({isNGain ? "+" : ""}{nPLPct.toFixed(2)}%)</span>
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-border/30 pt-1">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <span>💱 Impacto Divisa (FX)</span><span className="text-[9px] text-muted-foreground/60">({currency}→{displayCurrency})</span>
            </span>
            <span className={`font-bold tabular-nums ${fxImp >= 0 ? "text-positive" : "text-destructive"}`}>
              {fmtSignedCurrency(fxImp, dSym)} <span className="text-[10px]">({fxImp >= 0 ? "+" : ""}{fxPct.toFixed(2)}%)</span>
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-between text-xs border-t border-border/30 pt-1">
        <span className="font-semibold text-muted-foreground">Rentabilidad Total</span>
        <span className={`font-extrabold tabular-nums ${isTotGain ? "text-positive" : "text-destructive"}`}>
          {fmtSignedCurrency(totPL, fSym)} <span className="font-bold">({isTotGain ? "+" : ""}{totPct.toFixed(2)}%)</span>
        </span>
      </div>
    </div>
  )
}

// ─── Position Form ────────────────────────────────────────────────────────────

export function PositionForm({
  shares, avgPrice, avgFxRate, currency, displayCurrency, conversionRate, onSave, onCancel,
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
  const [sInput, setSInput] = useState(shares != null ? String(shares) : "")
  const [pInput, setPInput] = useState(avgPrice != null ? String(avgPrice) : "")
  const initFx = avgFxRate != null && avgFxRate > 0 && conversionRate > 0 ? (((conversionRate - avgFxRate) / avgFxRate) * 100).toFixed(2) : "0"
  const [fxInput, setFxInput] = useState(initFx)
  const isForeign = currency !== displayCurrency

  const handleSave = () => {
    const s = parseFloat(sInput.replace(",", "."))
    const p = parseFloat(pInput.replace(",", "."))
    const pct = parseFloat(fxInput.replace(",", "."))
    if (!isNaN(s) && s > 0 && !isNaN(p) && p > 0) {
      const fx = isForeign && !isNaN(pct) && conversionRate > 0 ? conversionRate / (1 + pct / 100) : undefined
      onSave(s, p, fx)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-col gap-2">
      <p className="text-[10px] font-bold text-primary uppercase tracking-wide flex items-center gap-1">
        <Edit2 className="h-3 w-3" />Editar posición
      </p>
      <div className={`grid gap-2 ${isForeign ? "grid-cols-3" : "grid-cols-2"}`}>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Nº acciones</label>
          <input
            type="number" min="0" step="0.000001" placeholder="10" value={sInput} autoFocus
            onChange={(e) => setSInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Precio medio ({currency})</label>
          <input
            type="number" min="0" step="0.01" placeholder="150.00" value={pInput}
            onChange={(e) => setPInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        {isForeign && (
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Impacto FX (%)</label>
            <div className="relative flex items-center">
              <input
                type="number" step="0.1" placeholder="0.0" value={fxInput}
                onChange={(e) => setFxInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="w-full rounded-lg border border-border bg-background pl-2 pr-5 py-1.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
              />
              <span className="absolute right-1.5 text-[10px] font-bold text-muted-foreground">%</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-1">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary cursor-pointer">Cancelar</button>
        <button type="button" onClick={handleSave} disabled={!sInput.trim() || !pInput.trim()} className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1">
          <Check className="h-3 w-3" />Guardar
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
  quote: externalQuote,
  status: externalStatus,
  onRefresh,
}: {
  position: StockPosition
  onRemove: () => void
  onUpdate: (shares: number, avgPrice: number, avgFxRate?: number) => void
  onPriceLoaded: (symbol: string, price: number, currency: string) => void
  displayCurrency: string
  fxRates: Record<string, number>
  quote?: StockQuote | null
  status?: "idle" | "loading" | "ok" | "error"
  onRefresh?: () => Promise<void> | void
}) {
  const [internalState, setInternalState] = useState<QuoteState>({ status: "idle" })
  const [editing, setEditing] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [showChartModal, setShowChartModal] = useState(false)

  useEffect(() => { setLogoError(false) }, [position.symbol])

  const state: QuoteState = externalQuote
    ? { status: "ok", data: externalQuote }
    : externalStatus === "loading"
    ? { status: "loading" }
    : externalStatus === "error"
    ? { status: "error", message: "Error al cargar cotización" }
    : internalState

  const handleRefresh = useCallback(async () => {
    setRotating(true)
    try {
      if (onRefresh) {
        await onRefresh()
      } else {
        setInternalState({ status: "loading" })
        const data = await fetchQuote(position.symbol)
        setInternalState({ status: "ok", data })
        onPriceLoaded(position.symbol, data.price, data.currency)
      }
    } catch (e) {
      setInternalState({ status: "error", message: e instanceof Error ? e.message : "Error desconocido" })
    } finally {
      setTimeout(() => setRotating(false), 600)
    }
  }, [onRefresh, position.symbol, onPriceLoaded])

  const hasPos = position.shares != null && position.avgPrice != null && position.shares > 0 && position.avgPrice > 0
  const isPos = state.status === "ok" ? state.data.changePercent >= 0 : null
  const dispName = state.status === "ok" && state.data.name && !state.data.name.includes(":") ? state.data.name : position.label || position.symbol

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:border-border/80 hover:bg-card/90 dark:hover:bg-[#181a20]">
        <div className="flex items-start justify-between gap-2">
          <div onClick={() => setShowChartModal(true)} title="Haz clic para ver gráfico interactivo" className="flex items-center gap-2.5 min-w-0 cursor-pointer group">
            {state.status === "ok" && state.data.logoid && !logoError && getTradingViewLogoUrl(state.data.logoid) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getTradingViewLogoUrl(state.data.logoid)!} alt={dispName} className="h-9 w-9 shrink-0 rounded-xl object-contain bg-secondary/60 p-1 group-hover:scale-105 transition-transform" onError={() => setLogoError(true)} />
            ) : (
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl group-hover:scale-105 transition-transform ${isPos === true ? "bg-positive/10 text-positive" : isPos === false ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                {isPos === true ? <TrendingUp className="h-4 w-4" /> : isPos === false ? <TrendingDown className="h-4 w-4" /> : <BarChart2 className="h-4 w-4" />}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-1">
                <span>{dispName}</span>
                <BarChart2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              <p className="text-[10px] text-muted-foreground font-mono truncate">{position.symbol}</p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button type="button" onClick={handleRefresh} disabled={state.status === "loading"} aria-label="Actualizar" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${rotating ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={() => setEditing((v) => !v)} title="Editar posición" aria-label="Editar" className={`rounded-full p-1.5 transition-colors cursor-pointer ${editing ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onRemove} aria-label="Eliminar" className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer">
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
                {state.data.price.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                <span className="text-xs font-semibold text-muted-foreground ml-1">{state.data.currency}</span>
              </span>
              <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${state.data.changePercent >= 0 ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"}`}>
                {state.data.changePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {state.data.changePercent >= 0 ? "+" : ""}{state.data.changePercent.toFixed(2)}%
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[10px] text-muted-foreground">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-[9px] uppercase tracking-wide">Apertura</span>
                <span className="font-bold text-foreground tabular-nums">{state.data.open > 0 ? state.data.open.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "—"}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-[9px] uppercase tracking-wide">Máx / Mín</span>
                <span className="font-bold text-foreground tabular-nums text-[10px]">{state.data.high > 0 ? state.data.high.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"} / {state.data.low > 0 ? state.data.low.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-[9px] uppercase tracking-wide">Variación</span>
                <span className={`font-bold tabular-nums ${state.data.change >= 0 ? "text-positive" : "text-destructive"}`}>
                  {state.data.change >= 0 ? "+" : ""}{state.data.change.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </span>
              </div>
            </div>

            {hasPos && !editing && (() => {
              const { currentFx } = getFxPair(state.data.currency, displayCurrency, fxRates)
              return (
                <PortfolioPosition
                  shares={position.shares!} avgPrice={position.avgPrice!} avgFxRate={position.avgFxRate ?? null}
                  currentPrice={state.data.price} currency={state.data.currency} displayCurrency={displayCurrency} conversionRate={currentFx}
                />
              )
            })()}

            {!hasPos && !editing && (
              <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary/70 hover:text-primary transition-colors cursor-pointer">
                <Plus className="h-3 w-3" />Añadir nº acciones y precio medio
              </button>
            )}

            <p className="text-[9px] text-muted-foreground/60">
              Act. {new Date(state.data.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              {state.data.exchange ? ` · ${state.data.exchange}` : ""}
            </p>
          </>
        )}

        {state.status === "error" && (
          <div className="flex items-center gap-2 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" /><span className="line-clamp-2">{state.message}</span>
          </div>
        )}

        {editing && (() => {
          const curr = state.status === "ok" ? state.data.currency : "USD"
          const { currentFx } = getFxPair(curr, displayCurrency, fxRates)
          return (
            <PositionForm
              shares={position.shares ?? null} avgPrice={position.avgPrice ?? null} avgFxRate={position.avgFxRate ?? null}
              currency={curr} displayCurrency={displayCurrency} conversionRate={currentFx}
              onSave={(s, p, fx) => { onUpdate(s, p, fx); setEditing(false) }}
              onCancel={() => setEditing(false)}
            />
          )
        })()}
      </div>

      {showChartModal && (
        <StockTradingViewModal
          symbol={position.symbol} name={dispName}
          price={state.status === "ok" ? state.data.price : undefined}
          changePercent={state.status === "ok" ? state.data.changePercent : undefined}
          currency={state.status === "ok" ? state.data.currency : undefined}
          onClose={() => setShowChartModal(false)}
        />
      )}
    </>
  )
}

// ─── Stock TradingView Interactive Chart Modal ────────────────────────────────

export function StockTradingViewModal({
  symbol, name, price, changePercent, currency, onClose,
}: {
  symbol: string; name: string; price?: number; changePercent?: number; currency?: string; onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isUp = (changePercent ?? 0) >= 0

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ""
    const div = document.createElement("div")
    div.id = "tv_stock_modal_container"
    div.style.width = "100%"
    div.style.height = "100%"
    containerRef.current.appendChild(div)

    const init = () => {
      if ((window as any).TradingView) {
        new (window as any).TradingView.widget({
          autosize: true, symbol, interval: "D", timezone: "Europe/Madrid",
          theme: "dark", style: "1", locale: "es", toolbar_bg: "#09111e",
          enable_publishing: false, allow_symbol_change: true, container_id: "tv_stock_modal_container",
        })
      }
    }

    if ((window as any).TradingView) {
      init()
    } else {
      const s = document.createElement("script")
      s.src = "https://s3.tradingview.com/tv.js"
      s.async = true
      s.onload = init
      containerRef.current.appendChild(s)
    }
  }, [symbol])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-5xl bg-[#09111e] border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[85vh] max-h-[720px] text-white relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#050b14] border-b border-white/15 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black uppercase tracking-wider text-white">{name}</h3>
              <span className="text-xs font-mono font-bold text-slate-400">{symbol}</span>
            </div>
            <a href={`https://es.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 hover:underline">
              <span>Abrir directo en TradingView</span><ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center gap-4">
            {price !== undefined && (
              <div className="text-right">
                <div className="text-base font-black text-white tabular-nums">
                  {price.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {currency}
                </div>
                {changePercent !== undefined && (
                  <div className={`text-xs font-extrabold tabular-nums ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                    {isUp ? "▲ +" : "▼ "}{changePercent.toFixed(2)}%
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose} aria-label="Cerrar gráfico" className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div ref={containerRef} className="flex-1 w-full h-full bg-[#09111e] relative min-h-[400px]" />
      </div>
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
  logoid?: string
}

export const TYPE_LABEL: Record<string, string> = {
  stock: "Acción", crypto: "Cripto", fund: "Fondo", futures: "Futuros", forex: "Forex", cfd: "CFD", index: "Índice", economic: "Económico", dr: "DR",
}

function SymbolRow({
  label,
  sub,
  logoid,
  badge,
  onSelect,
}: {
  label: string
  sub: string
  logoid?: string
  badge?: string
  onSelect: () => void
}) {
  const logo = getTradingViewLogoUrl(logoid)
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-secondary/30 p-2 text-left hover:bg-primary/10 hover:border-primary/40 cursor-pointer"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="h-6 w-6 shrink-0 rounded-md object-contain bg-secondary/60 p-0.5"
            onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }}
          />
        ) : (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary/60 text-muted-foreground text-xs font-bold">
            {label[0]}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-foreground truncate">{label}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{sub}</span>
        </div>
      </div>
      {badge && (
        <span className="text-[9px] font-bold text-muted-foreground bg-secondary rounded px-1.5 py-0.5">
          {badge}
        </span>
      )}
    </button>
  )
}

export function AddSymbolModal({
  onAdd, onClose,
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
    if (!query.trim()) { setResults([]); setSearchError(""); setSearching(false); return }
    const controller = new AbortController()
    setSearching(true)
    setSearchError("")
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbol-search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        const json = await res.json()
        if (!controller.signal.aborted) {
          setResults(json.results ?? [])
          if (json.error) setSearchError(json.error)
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") { setSearchError("Error al buscar"); setResults([]) }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  const handleSelect = (sym: string, lbl: string) => {
    const s = parseFloat(shares.replace(",", "."))
    const p = parseFloat(avgPrice.replace(",", "."))
    onAdd({
      symbol: sym.toUpperCase(),
      label: lbl || sym.toUpperCase(),
      ...(shares && !isNaN(s) && s > 0 ? { shares: s } : {}),
      ...(avgPrice && !isNaN(p) && p > 0 ? { avgPrice: p } : {}),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />Añadir símbolo
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-[10px] font-bold text-primary uppercase tracking-wide mb-2 flex items-center gap-1">
            <Target className="h-3 w-3" />Mi posición (opcional)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Nº acciones</label>
              <input type="number" min="0" step="0.000001" placeholder="10" value={shares} onChange={(e) => setShares(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Precio medio</label>
              <input type="number" min="0" step="0.01" placeholder="150.00" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="relative mb-3">
          {searching ? <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary animate-spin" /> : <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />}
          <input type="text" placeholder="Buscar por nombre o ticker… (ej. GDX, Apple, BTC)" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} className="w-full rounded-xl border border-border bg-background pl-8 pr-8 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
          {query && (
            <button type="button" onClick={() => { setQuery(""); setResults([]); setSearchError("") }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {searchError && <p className="text-xs text-destructive mb-2 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{searchError}</p>}

        <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
          {!query.trim() ? (
            <>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Sugerencias populares</p>
              {SUGGESTIONS.map((s) => (
                <SymbolRow
                  key={s.symbol}
                  label={s.label}
                  sub={s.symbol}
                  logoid={s.logoid}
                  onSelect={() => handleSelect(s.symbol, s.label)}
                />
              ))}
            </>
          ) : results.length === 0 && !searching ? (
            <p className="text-center text-xs text-muted-foreground py-6">Sin resultados para &ldquo;{query}&rdquo;</p>
          ) : (
            results.map((r, idx) => (
              <SymbolRow
                key={`${r.id}-${r.exchange}-${idx}`}
                label={r.description || r.symbol}
                sub={r.id}
                logoid={r.logoid}
                badge={r.exchange}
                onSelect={() => handleSelect(r.id, r.description || r.symbol)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Re-exports of Extracted Components (Code-Split) ──────────────────────────
export * from "./spanish-tax-calculator"
export * from "./macro-calendar-widget"

// ─── Financial News Ticker Bar ────────────────────────────────────────────────

export function FinancialNewsTickerBar() {
  const [news, setNews] = useState<{ id: string; title: string; category: string; timeAgo: string; url: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("TODAS")

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch("/api/news")
      const data = await res.json()
      if (Array.isArray(data.news)) setNews(data.news)
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  useVisibilityPolling(fetchNews, 300_000)

  const categories = useMemo(() => {
    const list = Array.from(new Set(news.map((n) => n.category)))
    return ["TODAS", ...list]
  }, [news])

  const filteredNews = useMemo(() => {
    return news.filter((item) => {
      const matchesCategory = selectedCategory === "TODAS" || item.category === selectedCategory
      const matchesSearch = !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [news, selectedCategory, searchQuery])

  if (loading && news.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-secondary/40 px-3 py-2 border border-border/30 text-xs text-muted-foreground animate-pulse mb-3">
        <span className="h-2 w-2 rounded-full bg-red-500 animate-ping shrink-0" />
        <span>Cargando noticias de inversión en directo…</span>
      </div>
    )
  }

  const BADGE_STYLES: Record<string, string> = {
    "🇺🇸 WALL STREET": "bg-blue-500/15 border-blue-500/40 text-blue-400",
    "🇪🇺 EUROPE / ECB": "bg-cyan-500/15 border-cyan-500/40 text-cyan-400",
    "🌏 ASIA / GLOBAL": "bg-purple-500/15 border-purple-500/40 text-purple-400",
    "📊 MACRO / CPI": "bg-amber-500/15 border-amber-500/40 text-amber-400",
    "⚡ TECH / AI": "bg-violet-500/15 border-violet-500/40 text-violet-400",
    "🥇 GOLD": "bg-amber-400/20 border-amber-400/50 text-amber-300",
    "🛢️ COMMODITIES": "bg-yellow-600/15 border-yellow-600/40 text-yellow-400",
    "🪙 CRYPTO": "bg-emerald-500/15 border-emerald-500/40 text-emerald-400",
    "💼 BUSINESS / EARNINGS": "bg-rose-500/15 border-rose-500/40 text-rose-400",
    "🧠 TOP INVESTORS": "bg-indigo-500/15 border-indigo-500/40 text-indigo-400",
  }

  function getCategoryBadgeStyle(cat: string) {
    return BADGE_STYLES[cat] || "bg-blue-500/15 border-blue-500/40 text-blue-400"
  }

  function renderCategoryIcon(cat: string) {
    if (cat.includes("INVESTORS") || cat.includes("INVERSORES") || cat.includes("BURRY") || cat.includes("BUFFETT") || cat.includes("DALIO")) {
      return <span className="text-xs shrink-0" role="img" aria-label="Top Investors">🧠</span>
    }
    if (cat.includes("WALL STREET") || cat.includes("USA") || cat.includes("US")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="https://flagcdn.com/us.svg"
          alt="USA"
          width={16}
          height={11}
          loading="lazy"
          decoding="async"
          className="inline-block rounded-[2px] object-cover shrink-0"
        />
      )
    }
    if (cat.includes("EUROPE") || cat.includes("EUROPA") || cat.includes("ECB") || cat.includes("BCE")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="https://flagcdn.com/eu.svg"
          alt="EU"
          width={16}
          height={11}
          loading="lazy"
          decoding="async"
          className="inline-block rounded-[2px] object-cover shrink-0"
        />
      )
    }
    if (cat.includes("ASIA") || cat.includes("GLOBAL")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="https://flagcdn.com/un.svg"
          alt="Global"
          width={16}
          height={11}
          loading="lazy"
          decoding="async"
          className="inline-block rounded-[2px] object-cover shrink-0"
        />
      )
    }
    if (cat.includes("GOLD") || cat.includes("ORO")) {
      return <span className="text-xs shrink-0" role="img" aria-label="Gold">🥇</span>
    }
    if (cat.includes("COMMODITIES") || cat.includes("OIL") || cat.includes("PETRÓLEO")) {
      return <span className="text-xs shrink-0" role="img" aria-label="Commodities">🛢️</span>
    }
    if (cat.includes("CRYPTO") || cat.includes("CRIPTO") || cat.includes("BITCOIN")) {
      return <span className="text-xs shrink-0" role="img" aria-label="Crypto">🪙</span>
    }
    if (cat.includes("TECH") || cat.includes("AI")) {
      return <span className="text-xs shrink-0" role="img" aria-label="Tech">⚡</span>
    }
    if (cat.includes("MACRO") || cat.includes("CPI")) {
      return <span className="text-xs shrink-0" role="img" aria-label="Macro">📊</span>
    }
    return <span className="text-xs shrink-0" role="img" aria-label="Business">💼</span>
  }

  function cleanCategoryText(cat: string) {
    return cat.replace(/^[^\w\s/]+/, "").trim()
  }

  const displayNews = [...news, ...news]

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-2xl bg-gradient-to-r from-red-950/20 via-background to-emerald-950/20 border border-border/50 p-2.5 sm:px-3.5 sm:py-2.5 text-sm shadow-xs mb-4">
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-500/50 bg-red-950/20 text-red-500 dark:text-red-400 font-extrabold text-[11px] sm:text-xs tracking-wider uppercase shrink-0 select-none shadow-2xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span>MERCADOS GLOBALES · 12H</span>
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
              className="flex items-center gap-2 text-foreground hover:text-primary transition-colors cursor-pointer shrink-0"
            >
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] border uppercase tracking-wider font-extrabold ${getCategoryBadgeStyle(item.category)}`}>
                {renderCategoryIcon(item.category)}
                <span>{cleanCategoryText(item.category)}</span>
              </span>
              <span className="font-bold text-xs sm:text-sm text-foreground hover:underline tracking-tight">
                {item.title}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground/80">• {item.timeAgo}</span>
              <span className="mx-2 text-muted-foreground/30 font-bold">|</span>
            </a>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card dark:bg-[#1a1c23] hover:bg-secondary text-foreground text-xs font-bold border border-border transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0 shadow-2xs cursor-pointer"
        title="Ver todas las noticias en lista completa"
      >
        <Newspaper className="h-3.5 w-3.5 text-primary" />
        <span className="font-bold">Ver todas</span>
        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/15 text-primary font-black tabular-nums">
          {news.length}
        </span>
      </button>

      {/* Modal Ver todas las noticias */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-card rounded-3xl border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Newspaper className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                    Noticias de Mercados en Tiempo Real
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {filteredNews.length} {filteredNews.length === 1 ? "noticia disponible" : "noticias disponibles"} · Últimas 12 horas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search & Categories Bar */}
            <div className="p-4 sm:px-5 border-b border-border flex flex-col gap-3 bg-muted/20">
              {/* Search input */}
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar noticias por palabra clave (ej: Fed, Ibex, Nvidia, Inflación)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs scale-[1.02]"
                          : "bg-muted text-muted-foreground border border-border hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      {cat !== "TODAS" && renderCategoryIcon(cat)}
                      <span>{cat === "TODAS" ? `Todas (${news.length})` : cleanCategoryText(cat)}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* News List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-2.5 divide-y divide-border/40">
              {filteredNews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="text-3xl mb-2">🔍</span>
                  <p className="text-sm font-bold text-foreground">No se encontraron noticias</p>
                  <p className="text-xs text-muted-foreground mt-1">Prueba con otra palabra clave o selecciona otra categoría.</p>
                </div>
              ) : (
                filteredNews.map((item, idx) => (
                  <a
                    key={`${item.id}-${idx}`}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] border uppercase tracking-wider font-extrabold shrink-0 mt-0.5 ${getCategoryBadgeStyle(item.category)}`}>
                        {renderCategoryIcon(item.category)}
                        <span>{cleanCategoryText(item.category)}</span>
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
                        {item.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-2">
                      <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                        {item.timeAgo}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
