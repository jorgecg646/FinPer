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
} from "lucide-react"
import type { StockPosition } from "@/app/actions"
import { CURRENCY_SYMBOLS, getFxPair, getTradingViewLogoUrl, fmtCurrency } from "@/lib/format"

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
  const res = await fetch(`/api/stock-price?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" })
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error ?? "Error de red")
  return json as StockQuote
}

const fmtN = (n: number, sym = "", d = 2) => fmtCurrency(n, sym, d, d)

// ─── Portfolio Position ───────────────────────────────────────────────────────

export function PortfolioPosition({
  shares, avgPrice, avgFxRate, currentPrice, currency, displayCurrency, conversionRate,
}: {
  shares: number
  avgPrice: number
  avgFxRate?: number | null
  currentPrice: number
  currency: string
  displayCurrency: string
  conversionRate: number
}) {
  const invNative = shares * avgPrice
  const curNative = shares * currentPrice
  const nPL = curNative - invNative
  const nPLPct = invNative > 0 ? (nPL / invNative) * 100 : 0
  const isNGain = nPL >= 0

  const needsConv = displayCurrency !== currency && conversionRate > 0
  const dSym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency
  const nSym = CURRENCY_SYMBOLS[currency] ?? currency
  const pFx = avgFxRate && avgFxRate > 0 ? avgFxRate : conversionRate > 0 ? conversionRate : 1
  const cFx = conversionRate > 0 ? conversionRate : pFx

  const invDisp = needsConv ? invNative * pFx : invNative
  const curDisp = needsConv ? curNative * cFx : curNative
  const totPL = curDisp - invDisp
  const totPct = invDisp > 0 ? (totPL / invDisp) * 100 : 0
  const isTotGain = totPL >= 0
  const fxImp = curNative * (cFx - pFx)
  const fxPct = pFx > 0 ? ((cFx - pFx) / pFx) * 100 : 0
  const fSym = needsConv ? dSym : nSym

  return (
    <div className={`mt-2 rounded-xl p-3 border ${isTotGain ? "bg-positive/5 border-positive/20" : "bg-destructive/5 border-destructive/20"}`}>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1"><Target className="h-3 w-3" />Mi Posición</span>
        {needsConv && <span className="text-[9px] font-semibold text-muted-foreground/80">FX: 1 {currency} = {cFx.toFixed(4)} {displayCurrency}</span>}
      </p>

      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] text-muted-foreground">
          {shares.toLocaleString("es-ES", { maximumFractionDigits: 6 }).replace(/\.?0+$/, "")} acc. × {nSym}{avgPrice.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/acc.
        </p>

        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Capital invertido</span>
          <span className="font-bold text-foreground tabular-nums">
            {fmtN(invDisp, fSym)}
            {needsConv && <span className="text-muted-foreground/60 ml-1 text-[9px]">({fmtN(invNative, nSym)})</span>}
          </span>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Valor actual</span>
          <span className="font-bold text-foreground tabular-nums">
            {fmtN(curDisp, fSym)}
            {needsConv && <span className="text-muted-foreground/60 ml-1 text-[9px]">({fmtN(curNative, nSym)})</span>}
          </span>
        </div>

        {needsConv && (
          <div className="my-1 rounded-lg bg-background/60 p-2 flex flex-col gap-1 text-[11px] border border-border/40">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <span>📈 Rendimiento activo</span><span className="text-[9px] text-muted-foreground/60">({currency})</span>
              </span>
              <span className={`font-bold tabular-nums ${isNGain ? "text-positive" : "text-destructive"}`}>
                {isNGain ? "+" : ""}{fmtN(nPL, nSym)} <span className="text-[10px]">({isNGain ? "+" : ""}{nPLPct.toFixed(2)}%)</span>
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-border/30 pt-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <span>💱 Impacto Divisa (FX)</span><span className="text-[9px] text-muted-foreground/60">({currency}→{displayCurrency})</span>
              </span>
              <span className={`font-bold tabular-nums ${fxImp >= 0 ? "text-positive" : "text-destructive"}`}>
                {fxImp >= 0 ? "+" : ""}{fmtN(fxImp, dSym)} <span className="text-[10px]">({fxImp >= 0 ? "+" : ""}{fxPct.toFixed(2)}%)</span>
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-between text-xs border-t border-border/30 pt-1">
          <span className="font-semibold text-muted-foreground">Rentabilidad Total</span>
          <span className={`font-extrabold tabular-nums ${isTotGain ? "text-positive" : "text-destructive"}`}>
            {isTotGain ? "+" : ""}{fmtN(totPL, fSym)} <span className="font-bold">({isTotGain ? "+" : ""}{totPct.toFixed(2)}%)</span>
          </span>
        </div>
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
  position, onRemove, onUpdate, onPriceLoaded, displayCurrency, fxRates,
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
  const [showChartModal, setShowChartModal] = useState(false)

  useEffect(() => { setLogoError(false) }, [position.symbol])

  const load = useCallback(async () => {
    setState({ status: "loading" })
    setRotating(true)
    try {
      const data = await fetchQuote(position.symbol)
      setState({ status: "ok", data })
      onPriceLoaded(position.symbol, data.price, data.currency)
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Error desconocido" })
    } finally {
      setTimeout(() => setRotating(false), 600)
    }
  }, [position.symbol, onPriceLoaded])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  const hasPos = position.shares != null && position.avgPrice != null && position.shares > 0 && position.avgPrice > 0
  const isPos = state.status === "ok" ? state.data.changePercent >= 0 : null
  const dispName = state.status === "ok" && state.data.name && !state.data.name.includes(":") ? state.data.name : position.label || position.symbol

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-secondary/30 p-4 transition-all hover:border-primary/30 hover:bg-secondary/50">
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
            <button type="button" onClick={load} disabled={state.status === "loading"} aria-label="Actualizar" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-50">
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
              {SUGGESTIONS.map((s) => {
                const logo = getTradingViewLogoUrl(s.logoid)
                return (
                  <button key={s.symbol} type="button" onClick={() => handleSelect(s.symbol, s.label)} className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/30 p-2 text-left hover:bg-primary/10 hover:border-primary/40 cursor-pointer">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" className="h-6 w-6 shrink-0 rounded-md object-contain bg-secondary/60 p-0.5" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary/60 text-muted-foreground text-xs font-bold">{s.label[0]}</div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-foreground truncate">{s.label}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{s.symbol}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </>
          ) : results.length === 0 && !searching ? (
            <p className="text-center text-xs text-muted-foreground py-6">Sin resultados para &ldquo;{query}&rdquo;</p>
          ) : (
            results.map((r) => {
              const logo = getTradingViewLogoUrl(r.logoid)
              return (
                <button key={r.id} type="button" onClick={() => handleSelect(r.id, r.description || r.symbol)} className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-secondary/30 p-2 text-left hover:bg-primary/10 hover:border-primary/40 cursor-pointer">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt="" className="h-6 w-6 shrink-0 rounded-md object-contain bg-secondary/60 p-0.5" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
                    ) : (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary/60 text-muted-foreground text-xs font-bold">{(r.description || r.symbol)[0]}</div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-foreground truncate">{r.description || r.symbol}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{r.id}</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-muted-foreground bg-secondary rounded px-1.5 py-0.5">{r.exchange}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Spanish Tax Calculator ───────────────────────────────────────────────────

export const TAX_BRACKETS = [
  { limit: 6000, rate: 0.19, label: "Hasta 6.000 €" },
  { limit: 44000, rate: 0.21, label: "6.000 € a 50.000 €" },
  { limit: 150000, rate: 0.23, label: "50.000 € a 200.000 €" },
  { limit: 100000, rate: 0.27, label: "200.000 € a 300.000 €" },
  { limit: Infinity, rate: 0.28, label: "Más de 300.000 €" },
]

export function calculateSpanishTax(gain: number) {
  if (gain <= 0) return { tax: 0, effectiveRate: 0, breakdown: [] }
  let remaining = gain, totalTax = 0
  const breakdown: { bracket: string; rate: number; taxable: number; tax: number }[] = []

  for (const b of TAX_BRACKETS) {
    if (remaining <= 0) break
    const taxable = Math.min(remaining, b.limit)
    const tax = taxable * b.rate
    totalTax += tax
    remaining -= taxable
    breakdown.push({ bracket: b.label, rate: b.rate * 100, taxable, tax })
  }
  return { tax: totalTax, effectiveRate: (totalTax / gain) * 100, breakdown }
}

export function SpanishTaxExportCalculator({
  items, displayCurrency,
}: {
  items: { symbol: string; label: string; currentDisp: number; investedDisp: number; plDisp: number; plPct: number }[]
  displayCurrency: string
}) {
  const dispSym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency
  const [customSales, setCustomSales] = useState<Record<string, number>>(() => Object.fromEntries(items.map((it) => [it.symbol, 100])))

  const activeSaleItems = useMemo(() => items.filter((it) => (customSales[it.symbol] ?? 0) > 0), [items, customSales])

  const { totalInvested, totalCurrent, totalGain, taxCalculation, netProfit } = useMemo(() => {
    let inv = 0, cur = 0
    items.forEach((it) => {
      const pct = (customSales[it.symbol] ?? 0) / 100
      if (pct > 0) { inv += it.investedDisp * pct; cur += it.currentDisp * pct }
    })
    const gain = cur - inv
    const tax = calculateSpanishTax(gain)
    return { totalInvested: inv, totalCurrent: cur, totalGain: gain, taxCalculation: tax, netProfit: gain - tax.tax }
  }, [items, customSales])

  const hasCrypto = activeSaleItems.some((it) => it.symbol.includes("BTC") || it.symbol.includes("ETH") || it.symbol.includes("BINANCE:"))
  const hasStocks = activeSaleItems.some((it) => !hasCrypto)

  return (
    <div className="flex flex-col gap-4 bg-background/60 rounded-2xl p-4 border border-border/40 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">🇪🇸 Calculadora Fiscal IRPF & Guía de Renta (España)</h4>
          <p className="text-xs text-muted-foreground">Selecciona individualmente qué acciones y qué % vas a vender</p>
        </div>
        <button type="button" onClick={() => window.print()} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 flex items-center gap-2 cursor-pointer shadow-xs self-start sm:self-auto">
          <span>📄 Descargar Informe PDF / Imprimir</span>
        </button>
      </div>

      <div className="flex flex-col gap-3 bg-secondary/30 p-3.5 rounded-xl border border-border/30 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/20 pb-2">
          <span className="font-bold text-foreground text-xs">⚙️ Selección de Venta Individual:</span>
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button type="button" onClick={() => setCustomSales(Object.fromEntries(items.map((it) => [it.symbol, 100])))} className="px-2 py-1 rounded-lg bg-card border border-border/40 hover:bg-secondary text-[10px] font-bold text-foreground cursor-pointer">Vender 100%</button>
            <button type="button" onClick={() => setCustomSales(Object.fromEntries(items.map((it) => [it.symbol, 50])))} className="px-2 py-1 rounded-lg bg-card border border-border/40 hover:bg-secondary text-[10px] font-bold text-foreground cursor-pointer">Vender 50%</button>
            <button type="button" onClick={() => setCustomSales(Object.fromEntries(items.map((it) => [it.symbol, 0])))} className="px-2 py-1 rounded-lg bg-card border border-border/40 hover:bg-secondary text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer">Desactivar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
          {items.map((it) => {
            const pct = customSales[it.symbol] ?? 0
            const isSelling = pct > 0
            const sCur = it.currentDisp * (pct / 100), sInv = it.investedDisp * (pct / 100), sPL = sCur - sInv

            return (
              <div key={it.symbol} className={`p-2.5 rounded-xl border transition-all flex flex-col gap-1.5 ${isSelling ? "bg-card border-primary/40 shadow-2xs" : "bg-secondary/20 border-border/20 opacity-60"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <input type="checkbox" checked={isSelling} onChange={(e) => setCustomSales((prev) => ({ ...prev, [it.symbol]: e.target.checked ? 100 : 0 }))} className="rounded accent-primary h-3.5 w-3.5 cursor-pointer" />
                    <span className="font-bold text-foreground truncate text-xs">{it.label}</span>
                  </div>
                  <span className="text-xs font-black tabular-nums text-primary">{pct}%</span>
                </div>
                <input type="range" min="0" max="100" step="5" value={pct} onChange={(e) => setCustomSales((prev) => ({ ...prev, [it.symbol]: parseInt(e.target.value, 10) }))} className="flex-1 accent-primary h-1.5 bg-secondary rounded-lg cursor-pointer" />
                <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                  <span>Venta: <strong className="text-foreground">{dispSym}{sCur.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</strong></span>
                  <span className={`font-black tabular-nums ${sPL >= 0 ? "text-positive" : "text-destructive"}`}>{sPL >= 0 ? "+" : ""}{dispSym}{sPL.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-3 border bg-card border-border/40 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-muted-foreground">Venta Total</span>
          <span className="text-lg font-black text-foreground tabular-nums">{dispSym}{totalCurrent.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-muted-foreground/80 font-medium">Invertido: {dispSym}{totalInvested.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="rounded-xl p-3 border bg-card border-border/40 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-muted-foreground">Ganancia Bruta</span>
          <span className={`text-lg font-black tabular-nums ${totalGain >= 0 ? "text-positive" : "text-destructive"}`}>{totalGain >= 0 ? "+" : ""}{dispSym}{totalGain.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-muted-foreground/80 font-medium">Base Imponible Ahorro</span>
        </div>
        <div className="rounded-xl p-3 border bg-amber-500/5 border-amber-500/20 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-amber-500">Estimación IRPF</span>
          <span className="text-lg font-black text-amber-500 tabular-nums">{dispSym}{taxCalculation.tax.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</span>
          <span className="text-[10px] font-bold text-amber-500/90">Tipo Efectivo: {taxCalculation.effectiveRate.toFixed(2)}%</span>
        </div>
        <div className="rounded-xl p-3 border bg-emerald-500/5 border-emerald-500/20 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-emerald-400">Beneficio Neto</span>
          <span className="text-lg font-black text-emerald-400 tabular-nums">{dispSym}{netProfit.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</span>
          <span className="text-[10px] font-bold text-emerald-400/90">Limpio tras impuestos</span>
        </div>
      </div>

      <div className="printable-report rounded-2xl p-5 bg-background border border-border/60 text-xs flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div>
            <h5 className="font-extrabold text-foreground text-base">📋 Informe Fiscal IRPF & Guía de Renta (Modelo 100 - España)</h5>
            <p className="text-xs text-muted-foreground mt-0.5">Resumen de operaciones y casillas exactas para la AEAT</p>
          </div>
          <span className="text-xs font-bold text-foreground bg-secondary/80 px-3 py-1 rounded-md border border-border/50 shrink-0">Ejercicio {new Date().getFullYear()}</span>
        </div>

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
                const pct = (customSales[it.symbol] ?? 0) / 100
                const sCur = it.currentDisp * pct, sInv = it.investedDisp * pct, sPL = sCur - sInv
                return (
                  <tr key={it.symbol} className="hover:bg-secondary/20">
                    <td className="py-2 px-3 font-bold text-foreground">{it.label} <span className="text-[10px] text-muted-foreground font-normal">({it.symbol})</span></td>
                    <td className="py-2 px-3 text-right tabular-nums text-foreground font-semibold">{dispSym}{sCur.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{dispSym}{sInv.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={`py-2 px-3 text-right tabular-nums font-bold ${sPL >= 0 ? "text-positive" : "text-destructive"}`}>{sPL >= 0 ? "+" : ""}{dispSym}{sPL.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border/30 pt-3">
          <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/40 flex flex-col gap-1">
            <span className="font-bold text-foreground">1. Casillas de Declaración:</span>
            {hasStocks && <p className="text-muted-foreground">• <strong>Acciones / ETFs:</strong> Casillas <strong>0326 a 0338</strong>.</p>}
            {hasCrypto && <p className="text-muted-foreground">• <strong>Criptomonedas:</strong> Casillas <strong>1800 a 1804</strong>.</p>}
          </div>
          <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/40 flex flex-col gap-1">
            <span className="font-bold text-foreground">2. Compensación y Recompra:</span>
            <p className="text-muted-foreground">• <strong>Compensación:</strong> Casillas <strong>0392 a 0404</strong> (hasta 25%).</p>
            <p className="text-muted-foreground">• <strong>Regla 2 Meses:</strong> No recomprar 2 meses antes/después con pérdida.</p>
          </div>
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
  actual: string | null
  actualRaw: number | null
  forecast: string
  forecastRaw: number | null
  previous: string
  previousRaw: number | null
  isReleased: boolean
  unit?: string
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
    fetch("/api/macro-calendar")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.events)) setMacroEvents(d.events) })
      .catch(() => {})
      .finally(() => setLoadingMacro(false))
  }, [])

  const symKey = symbols.join(",")
  useEffect(() => {
    if (!symKey) { setLoadingEarnings(false); return }
    fetch(`/api/earnings?symbols=${encodeURIComponent(symKey)}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.earnings)) setEarnings(d.earnings) })
      .catch(() => {})
      .finally(() => setLoadingEarnings(false))
  }, [symKey])

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-150">
      <div className="rounded-2xl bg-gradient-to-br from-card via-background to-amber-950/10 p-4 border border-amber-500/20 shadow-md">
        <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">📅</span>
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Calendario Macroeconómico Semanal & Eventos en Directo</h3>
              <p className="text-xs text-muted-foreground">Datos semanales en tiempo real de IPC, tipos Fed/BCE y mercado laboral</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">API EN DIRECTO 🟢</span>
        </div>

        {loadingMacro ? (
          <div className="flex items-center justify-center p-8 gap-3 text-xs text-muted-foreground animate-pulse">
            <span className="h-3 w-3 rounded-full bg-amber-500 animate-ping" /><span>Cargando eventos macroeconómicos…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {macroEvents.map((evt) => {
              const isReleased = evt.isReleased || !!evt.actual
              const isToday = evt.dateStr === "HOY"

              return (
                <div key={evt.id} className={`flex flex-col justify-between p-3 rounded-xl border transition-all gap-2 ${isReleased ? isToday ? "bg-gradient-to-br from-emerald-500/10 via-secondary/40 to-card border-emerald-500/50" : "bg-secondary/40 border-emerald-500/30" : "bg-secondary/30 border-border/40 hover:border-amber-500/40"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-black flex items-center gap-1.5 text-foreground">
                      <span>{evt.flag}</span><span className="truncate max-w-[130px]">{evt.country}</span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {evt.variant && <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30">{evt.variant}</span>}
                      {isReleased ? (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">{isToday ? "🟢 PUBLICADO HOY" : "🟢 PUBLICADO"}</span>
                      ) : (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${evt.impact === "HIGH" ? "bg-red-500/10 text-red-500 border-red-500/30" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"}`}>
                          {evt.impact === "HIGH" ? "🔴 ALTO" : "🟡 MEDIO"}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs font-bold text-foreground leading-snug line-clamp-2">{evt.title}</p>

                  {isReleased && evt.actual ? (
                    <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 mt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Dato Real:</span>
                        <span className="text-sm font-black text-emerald-400 tabular-nums">{evt.actual}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                        {evt.forecast && evt.forecast !== "Pendiente" && <span>Prev: <strong className="text-foreground">{evt.forecast}</strong></span>}
                        {evt.previous && evt.previous !== "N/D" && <span>· Ant: {evt.previous}</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/20 mt-1">
                      <span className="font-extrabold text-amber-400">⏱️ {evt.dateStr} · {evt.timeStr}</span>
                      <span className="text-muted-foreground font-semibold">Prev: <strong className="text-foreground">{evt.forecast}</strong></span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-card via-background to-emerald-950/10 p-4 border border-emerald-500/20 shadow-md">
        <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">📈</span>
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Próximos Resultados Trimestrales de tu Cartera</h3>
              <p className="text-xs text-muted-foreground">Fecha de publicación de resultados vía TradingView</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">API EN DIRECTO 🟢</span>
        </div>

        {loadingEarnings ? (
          <div className="flex items-center justify-center p-8 gap-3 text-xs text-muted-foreground animate-pulse">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" /><span>Consultando fechas de resultados…</span>
          </div>
        ) : earnings.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No se encontraron próximas fechas de resultados para tus acciones.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {earnings.map((item) => (
              <div key={item.symbol} className="p-3 rounded-xl border border-border/40 bg-secondary/20 transition-all flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-foreground">{item.symbol}</p>
                    <p className="text-[10px] text-muted-foreground font-medium truncate max-w-[150px]">{item.name}</p>
                  </div>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-background/60 border border-border/40 text-muted-foreground">
                    {item.urgency === "TODAY" ? "🔴 HOY" : item.urgency === "WEEK" ? "🟡 Esta semana" : "🟢 Próximamente"}
                  </span>
                </div>
                <div className="border-t border-border/20 pt-2 flex flex-col gap-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground font-semibold">📅 Fecha:</span><span className="font-extrabold text-foreground">{item.nextEarningsDate}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground font-semibold">⏳ Faltan:</span><span className="font-black text-emerald-400">{item.daysUntil === 0 ? "¡HOY!" : `${item.daysUntil} días`}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Financial News Ticker Bar ────────────────────────────────────────────────

export function FinancialNewsTickerBar() {
  const [news, setNews] = useState<{ id: string; title: string; category: string; timeAgo: string; url: string }[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch("/api/news", { cache: "no-store" })
      const data = await res.json()
      if (Array.isArray(data.news)) setNews(data.news)
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, 300_000)
    return () => clearInterval(interval)
  }, [fetchNews])

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
    "📈 MARKETS": "bg-sky-500/15 border-sky-500/40 text-sky-400",
  }

  function getCategoryBadgeStyle(cat: string) {
    return BADGE_STYLES[cat] || "bg-sky-500/15 border-sky-500/40 text-sky-400"
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
    if (cat.includes("BUSINESS") || cat.includes("EARNINGS")) {
      return <span className="text-xs shrink-0" role="img" aria-label="Business">💼</span>
    }
    return <span className="text-xs shrink-0" role="img" aria-label="Markets">📈</span>
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
    </div>
  )
}
