"use client"

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import {
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  Search,
  Star,
  BookMarked,
  Pencil,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  GripVertical,
  Loader2,
  Check,
} from "lucide-react"
import type { StockQuote } from "./stock-widgets"
import { getTradingViewLogoUrl } from "@/lib/format"
import { useStockQuotes } from "./stock-quotes-context"

// ─── Constants ────────────────────────────────────────────────────────────────

import { PANEL_W, COLLAPSED_KEY, TOGGLE_EVENT, WatchlistContentOffset } from "./watchlist-content-offset"
export { WatchlistContentOffset }

const STORAGE_KEY = "finper_watchlist_v3"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WatchItem {
  symbol: string
  label: string
  name?: string
  logoid?: string
}

interface WatchGroup {
  id: string
  name: string
  collapsed: boolean
  items: WatchItem[]
}

// ─── Defaults (TradingView watchlist 75991094 sin G2X) ────────────────────────

const DEFAULT_GROUPS: WatchGroup[] = [
  {
    id: "indices_etfs",
    name: "Índices y ETFs",
    collapsed: false,
    items: [
      { symbol: "TVC:SPX", label: "SPX", name: "S&P 500", logoid: "country/US" },
      { symbol: "NASDAQ:NDX", label: "NDX", name: "NASDAQ 100", logoid: "country/US" },
      { symbol: "TVC:IBEX35", label: "IBEX35", name: "IBEX 35", logoid: "country/ES" },
      { symbol: "XETR:VUAA", label: "VUAA", name: "Vanguard S&P 500 ETF", logoid: "vanguard" },
      { symbol: "XETR:SXRV", label: "SXRV", name: "iShares Nasdaq 100 ETF", logoid: "ishares" },
      { symbol: "XETR:SEC0", label: "SEC0", name: "Amundi MSCI USA ETF", logoid: "amundi" },
    ],
  },
  {
    id: "acciones",
    name: "Acciones",
    collapsed: false,
    items: [
      { symbol: "NYSE:BRK.B", label: "BRK.B", name: "Berkshire Hathaway", logoid: "berkshire-hathaway" },
      { symbol: "NYSE:GEV", label: "GEV", name: "GE Vernova", logoid: "ge-vernova" },
      { symbol: "NYSE:JPM", label: "JPM", name: "JPMorgan Chase", logoid: "jpmorgan-chase" },
      { symbol: "NASDAQ:MSFT", label: "MSFT", name: "Microsoft", logoid: "microsoft" },
      { symbol: "NASDAQ:TSLA", label: "TSLA", name: "Tesla", logoid: "tesla" },
      { symbol: "NASDAQ:AAPL", label: "AAPL", name: "Apple", logoid: "apple" },
      { symbol: "NASDAQ:GOOGL", label: "GOOGL", name: "Alphabet Class A", logoid: "alphabet" },
      { symbol: "NASDAQ:META", label: "META", name: "Meta Platforms", logoid: "meta-platforms" },
      { symbol: "NASDAQ:AMZN", label: "AMZN", name: "Amazon", logoid: "amazon" },
      { symbol: "NASDAQ:NVDA", label: "NVDA", name: "NVIDIA", logoid: "nvidia" },
    ],
  },
  {
    id: "forex_bonos",
    name: "Forex & Bonos",
    collapsed: false,
    items: [
      { symbol: "FX:EURUSD", label: "EUR/USD", name: "Euro / Dólar USA", logoid: "country/EU" },
      { symbol: "FX:GBPUSD", label: "GBP/USD", name: "Libra / Dólar USA", logoid: "country/GB" },
      { symbol: "TVC:US10Y", label: "US10Y", name: "Bono USA 10 Años", logoid: "country/US" },
    ],
  },
  {
    id: "futuros_materias",
    name: "Futuros & Materias Primas",
    collapsed: false,
    items: [
      { symbol: "TVC:USOIL", label: "USOIL", name: "Petróleo WTI", logoid: "crude-oil" },
      { symbol: "TVC:GOLD", label: "GOLD", name: "Oro", logoid: "metal/gold--big" },
      { symbol: "TVC:SILVER", label: "SILVER", name: "Plata", logoid: "silver" },
    ],
  },
  {
    id: "cripto",
    name: "Cripto",
    collapsed: false,
    items: [
      { symbol: "BITSTAMP:BTCUSD", label: "BTC/USD", name: "Bitcoin", logoid: "crypto/XTVCBTC" },
      { symbol: "BITSTAMP:ETHUSD", label: "ETH/USD", name: "Ethereum", logoid: "crypto/XTVCETH" },
      { symbol: "COINBASE:SOLUSD", label: "SOL/USD", name: "Solana", logoid: "crypto/XTVCSOL" },
    ],
  },
]

const SUGGESTIONS = [
  // Índices y ETFs
  { label: "S&P 500", symbol: "TVC:SPX", logoid: "country/US" },
  { label: "NASDAQ 100", symbol: "NASDAQ:NDX", logoid: "country/US" },
  { label: "IBEX 35", symbol: "TVC:IBEX35", logoid: "country/ES" },
  { label: "Vanguard S&P 500 (VUAA)", symbol: "XETR:VUAA", logoid: "vanguard" },
  { label: "iShares Nasdaq 100 (SXRV)", symbol: "XETR:SXRV", logoid: "ishares" },
  { label: "Amundi MSCI USA (SEC0)", symbol: "XETR:SEC0", logoid: "amundi" },
  { label: "DAX", symbol: "XETR:DAX", logoid: "country/DE" },
  { label: "FTSE 100", symbol: "SPREADEX:FTSE", logoid: "country/GB" },
  { label: "Nikkei 225", symbol: "TVC:NI225", logoid: "country/JP" },
  { label: "Dow Jones", symbol: "DJ:DJI", logoid: "country/US" },
  { label: "STOXX 600", symbol: "TVC:SXXP", logoid: "country/EU" },
  { label: "KOSPI", symbol: "TVC:KOSPI", logoid: "country/KR" },
  { label: "Shanghai", symbol: "TVC:SHCOMP", logoid: "country/CN" },
  // Acciones
  { label: "Berkshire Hathaway B", symbol: "NYSE:BRK.B", logoid: "berkshire-hathaway" },
  { label: "GE Vernova", symbol: "NYSE:GEV", logoid: "ge-vernova" },
  { label: "JPMorgan Chase", symbol: "NYSE:JPM", logoid: "jpmorgan-chase" },
  { label: "Apple", symbol: "NASDAQ:AAPL", logoid: "apple" },
  { label: "Microsoft", symbol: "NASDAQ:MSFT", logoid: "microsoft" },
  { label: "NVIDIA", symbol: "NASDAQ:NVDA", logoid: "nvidia" },
  { label: "Tesla", symbol: "NASDAQ:TSLA", logoid: "tesla" },
  { label: "Amazon", symbol: "NASDAQ:AMZN", logoid: "amazon" },
  { label: "Alphabet (Google)", symbol: "NASDAQ:GOOGL", logoid: "alphabet" },
  { label: "Meta", symbol: "NASDAQ:META", logoid: "meta-platforms" },
  { label: "JPMorgan", symbol: "NYSE:JPM", logoid: "jpmorgan-chase" },
  { label: "Berkshire B", symbol: "NYSE:BRK.B", logoid: "berkshire-hathaway" },
  { label: "Visa", symbol: "NYSE:V", logoid: "visa" },
  { label: "UnitedHealth", symbol: "NYSE:UNH", logoid: "unitedhealth" },
  { label: "Exxon Mobil", symbol: "NYSE:XOM", logoid: "exxon-mobil" },
  { label: "Broadcom", symbol: "NASDAQ:AVGO", logoid: "broadcom" },
  { label: "Samsung", symbol: "KRX:005930", logoid: "samsung" },
  { label: "TSMC", symbol: "NYSE:TSM", logoid: "taiwan-semiconductor" },
  { label: "Inditex", symbol: "BME:ITX", logoid: "industria-de-diseno-textil" },
  { label: "Santander", symbol: "BME:SAN", logoid: "banco-santander" },
  { label: "BBVA", symbol: "BME:BBVA", logoid: "bbva" },
  { label: "Repsol", symbol: "BME:REP", logoid: "repsol" },
  { label: "Ferrovial", symbol: "BME:FER", logoid: "ferrovial" },
  { label: "Telefonica", symbol: "BME:TEF", logoid: "telefonica" },
  // Materias primas
  { label: "Oro", symbol: "TVC:GOLD", logoid: "metal/gold--big" },
  { label: "Plata", symbol: "TVC:SILVER", logoid: "silver" },
  { label: "Petróleo WTI", symbol: "TVC:USOIL", logoid: "crude-oil" },
  { label: "Petróleo Brent", symbol: "TVC:UKOIL", logoid: "crude-oil--big" },
  { label: "Gas Natural", symbol: "TVC:NATGAS", logoid: "natural-gas--big" },
  { label: "Cobre", symbol: "COMEX:HG1!", logoid: "metal/copper--big" },
  // Divisas
  { label: "EUR/USD", symbol: "FX_IDC:EURUSD", logoid: "country/EU" },
  { label: "USD/JPY", symbol: "FX_IDC:USDJPY", logoid: "country/US" },
  { label: "GBP/USD", symbol: "FX_IDC:GBPUSD", logoid: "country/GB" },
  { label: "EUR/GBP", symbol: "FX_IDC:EURGBP", logoid: "country/EU" },
  { label: "USD Index (DXY)", symbol: "TVC:DXY", logoid: "country/US" },
  // Bonos
  { label: "US 10Y", symbol: "TVC:US10Y", logoid: "country/US" },
  { label: "US 2Y", symbol: "TVC:US02Y", logoid: "country/US" },
  { label: "Bund 10Y (DE)", symbol: "TVC:DE10Y", logoid: "country/DE" },
  // Crypto
  { label: "Bitcoin", symbol: "BINANCE:BTCUSDT", logoid: "crypto/XTVCBTC" },
  { label: "Ethereum", symbol: "BINANCE:ETHUSDT", logoid: "crypto/XTVCETH" },
  { label: "Solana", symbol: "BINANCE:SOLUSDT", logoid: "crypto/XTVCSOL" },
  { label: "BNB", symbol: "BINANCE:BNBUSDT", logoid: "crypto/XTVCBNB" },
  { label: "XRP", symbol: "BINANCE:XRPUSDT", logoid: "crypto/XTVCXRP" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(price: number): string {
  if (price >= 10000) return price.toLocaleString("es-ES", { maximumFractionDigits: 0 })
  if (price >= 1000) return price.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (price >= 100) return price.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return price.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 3 })
}

function fmtPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
}


// ─── Symbol Logo ──────────────────────────────────────────────────────────────

function SymbolLogo({ logoid, symbol, size = 22 }: { logoid?: string; symbol: string; size?: number }) {
  const [err, setErr] = useState(false)
  const url = logoid ? getTradingViewLogoUrl(logoid) : null
  const initials = symbol.split(":").pop()?.slice(0, 2).toUpperCase() ?? "??"

  useEffect(() => {
    setErr(false)
  }, [url])

  if (!url || err) {
    return (
      <div
        className="rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initials}
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={symbol}
      width={size}
      height={size}
      className="rounded-full object-contain shrink-0 bg-white/5"
      onError={() => setErr(true)}
      suppressHydrationWarning
    />
  )
}

// ─── Add Symbol Modal (TradingView-style with Live Search) ─────────────────────

type CategoryFilter = "ALL" | "stock" | "index" | "crypto" | "forex" | "fund"

const CATEGORIES: { id: CategoryFilter; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "stock", label: "Acciones" },
  { id: "index", label: "Índices" },
  { id: "crypto", label: "Cripto" },
  { id: "forex", label: "Divisas" },
  { id: "fund", label: "ETFs / Fondos" },
]

function matchesCategory(itemType: string, cat: CategoryFilter): boolean {
  if (cat === "ALL") return true
  const t = (itemType || "").toLowerCase()
  if (cat === "stock") return t === "stock" || t === "dr" || t === "common stock" || t.includes("stock")
  if (cat === "index") return t === "index"
  if (cat === "crypto") return t === "crypto" || t === "spot"
  if (cat === "forex") return t === "forex" || t === "fx"
  if (cat === "fund") return t === "fund" || t === "etf" || t === "structured"
  return true
}

function getTypeBadge(type: string): string {
  const t = (type || "").toLowerCase()
  if (t === "stock" || t === "dr") return "Acción"
  if (t === "index") return "Índice"
  if (t === "crypto" || t === "spot") return "Cripto"
  if (t === "forex" || t === "fx") return "Forex"
  if (t === "fund" || t === "etf") return "ETF"
  if (t === "structured") return "Derivado"
  if (t === "commodity" || t === "futures") return "Futuros"
  return type ? type.toUpperCase() : ""
}

interface SearchItem {
  id: string
  symbol: string
  description: string
  exchange: string
  fullExchange?: string
  type: string
  logoid?: string
}

function AddSymbolModal({
  defaultGroupId,
  groups,
  onAdd,
  onClose,
}: {
  defaultGroupId: string
  groups: WatchGroup[]
  onAdd: (groupId: string, item: WatchItem) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<CategoryFilter>("ALL")
  const [targetGroup, setTargetGroup] = useState(defaultGroupId)
  const [loading, setLoading] = useState(false)
  const [apiResults, setApiResults] = useState<SearchItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Live TradingView Symbol Search with 200ms debounce
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setApiResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbol-search?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.results)) {
            setApiResults(data.results)
          } else {
            setApiResults([])
          }
        } else {
          setApiResults([])
        }
      } catch {
        setApiResults([])
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(timeout)
  }, [query])

  // Local fallback suggestions
  const activeSuggestions: SearchItem[] = SUGGESTIONS.map((s) => ({
    id: s.symbol,
    symbol: s.symbol.includes(":") ? s.symbol.split(":")[1] : s.symbol,
    description: s.label,
    exchange: s.symbol.includes(":") ? s.symbol.split(":")[0] : "",
    type: (s as unknown as { type?: string }).type || "stock",
    logoid: s.logoid,
  }))

  const rawList: SearchItem[] = query.trim()
    ? (apiResults.length > 0
        ? apiResults
        : activeSuggestions.filter((s) =>
            s.symbol.toLowerCase().includes(query.toLowerCase()) ||
            s.description.toLowerCase().includes(query.toLowerCase()) ||
            s.id.toLowerCase().includes(query.toLowerCase())
          ))
    : activeSuggestions

  const displayList = rawList.filter((item) => matchesCategory(item.type, category))

  // Reset selected index when query or category changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query, category])

  function handleSelect(s: SearchItem) {
    onAdd(targetGroup, {
      symbol: s.id,
      label: s.symbol || s.id,
      name: s.description,
      logoid: s.logoid,
    })
    onClose()
  }

  function handleCustom() {
    const raw = query.trim()
    if (!raw) return
    const sym = raw.includes(":") ? raw.toUpperCase() : `NASDAQ:${raw.toUpperCase()}`
    const label = raw.toUpperCase().split(":").pop() ?? raw.toUpperCase()
    onAdd(targetGroup, { symbol: sym, label, name: label })
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, displayList.length - 1)))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (displayList.length > 0 && selectedIndex < displayList.length) {
        handleSelect(displayList[selectedIndex])
      } else if (query.trim()) {
        handleCustom()
      }
    } else if (e.key === "Escape") {
      onClose()
    }
  }

  // Check if item already in target group
  const currentGroupItems = groups.find((g) => g.id === targetGroup)?.items ?? []
  const currentGroupSymbolSet = new Set(currentGroupItems.map((i) => i.symbol))

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[460px] rounded-2xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 max-h-[82vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-bold text-foreground">Búsqueda de símbolos</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="px-4 pt-2.5 pb-1 shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-border/50">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${
                category === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="px-4 py-3 shrink-0 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar: Bending Spoons, AAPL, IBEX, Bitcoin…"
              className="w-full pl-9 pr-9 py-2 rounded-xl bg-secondary/70 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {loading && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />}
              {query && !loading && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("")
                    inputRef.current?.focus()
                  }}
                  className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Group selector */}
        {groups.length > 1 && (
          <div className="px-4 py-2 shrink-0 flex items-center gap-2 bg-secondary/20 border-b border-border/40">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">Añadir en:</span>
            <div className="flex gap-1.5 flex-wrap">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setTargetGroup(g.id)}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                    targetGroup === g.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary/70 text-muted-foreground hover:text-foreground border border-border/60 hover:bg-secondary"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1 p-2 space-y-1 divide-y divide-border/20">
          {displayList.length === 0 && !loading && query.trim() && (
            <div className="py-6 px-4 text-center flex flex-col items-center gap-3">
              <p className="text-xs text-muted-foreground">
                No encontramos resultados para <span className="font-bold text-foreground">"{query}"</span>
              </p>
              <button
                type="button"
                onClick={handleCustom}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Añadir como símbolo exacto: {query.toUpperCase()}</span>
              </button>
            </div>
          )}

          {displayList.map((s, idx) => {
            const alreadyInGroup = currentGroupSymbolSet.has(s.id)
            const isSelected = selectedIndex === idx
            const typeBadge = getTypeBadge(s.type)

            return (
              <button
                key={`${s.id}-${idx}`}
                type="button"
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all group/item ${
                  isSelected
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-secondary/70 border border-transparent"
                }`}
              >
                <SymbolLogo logoid={s.logoid} symbol={s.id} size={26} />

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-foreground tracking-tight">{s.symbol || s.id}</span>
                    {s.exchange && (
                      <span className="text-[10px] font-mono font-medium text-muted-foreground bg-secondary/80 px-1.5 py-0.2 rounded border border-border/40">
                        {s.exchange}
                      </span>
                    )}
                    {typeBadge && (
                      <span className="text-[9px] font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.2 rounded">
                        {typeBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                    {s.description || s.symbol}
                  </p>
                </div>

                <div className="shrink-0 flex items-center">
                  {alreadyInGroup ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                      <Check className="h-3 w-3" />
                      <span>En lista</span>
                    </span>
                  ) : (
                    <div
                      className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground group-hover/item:text-foreground group-hover/item:bg-primary/20 group-hover/item:text-primary"
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </button>
            )
          })}

          {query.trim() && displayList.length > 0 && (
            <div className="pt-2 px-2 pb-1">
              <button
                type="button"
                onClick={handleCustom}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground text-[11px] transition-colors border border-dashed border-border"
              >
                <Plus className="h-3 w-3" />
                <span>Usar símbolo exacto: <strong className="text-foreground">{query.toUpperCase()}</strong></span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Watchlist Row (draggable) ────────────────────────────────────────────────

function WatchlistRow({
  item,
  quote,
  onRemove,
  dragging,
  dragOverTop,
  dragOverBottom,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: WatchItem
  quote?: StockQuote
  onRemove: () => void
  dragging: boolean
  dragOverTop?: boolean
  dragOverBottom?: boolean
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const isUp = (quote?.changePercent ?? 0) >= 0
  const subName = item.name || (quote?.name && quote.name !== item.symbol && quote.name !== item.label ? quote.name : undefined)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all group/row cursor-grab active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      } ${dragOverTop ? "border-t-2 border-primary" : "border-t-2 border-transparent"} ${
        dragOverBottom ? "border-b-2 border-primary" : "border-b-2 border-transparent"
      } hover:bg-secondary/50 dark:hover:bg-white/[0.05]`}
    >
      {/* Drag handle */}
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/row:text-muted-foreground/70 shrink-0 transition-colors" />

      {/* Logo */}
      <SymbolLogo logoid={quote?.logoid || item.logoid} symbol={item.symbol} size={22} />

      {/* Label and Subtitle */}
      <div className="flex-1 min-w-0 flex flex-col justify-center" title={`${item.symbol} — ${subName || item.label}`}>
        <span className="text-xs font-bold text-foreground truncate leading-tight">{item.label}</span>
        {subName && (
          <span className="text-[11px] text-muted-foreground/80 truncate leading-tight mt-0.5">
            {subName}
          </span>
        )}
      </div>

      {/* Price + % — always visible */}
      <div className="flex flex-col items-end shrink-0 tabular-nums" suppressHydrationWarning>
        {quote ? (
          <>
            <span className="text-xs font-semibold text-foreground leading-tight" suppressHydrationWarning>{fmtPrice(quote.price)}</span>
            <span className={`text-[11px] font-bold leading-tight ${isUp ? "text-emerald-500" : "text-rose-500"}`} suppressHydrationWarning>
              {fmtPct(quote.changePercent)}
            </span>
          </>
        ) : (
          <>
            <span className="h-3 w-12 bg-secondary/60 rounded animate-pulse mb-1" />
            <span className="h-2.5 w-8 bg-secondary/40 rounded animate-pulse" />
          </>
        )}
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        aria-label={`Eliminar ${item.label}`}
        className="h-5 w-5 flex items-center justify-center rounded-md hover:bg-destructive/20 text-muted-foreground/0 group-hover/row:text-muted-foreground hover:!text-destructive transition-colors shrink-0 cursor-pointer"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

// ─── Group Header (draggable) ─────────────────────────────────────────────────

function GroupHeader({
  group,
  dragOver,
  onToggle,
  onRename,
  onDelete,
  onAddSymbol,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  group: WatchGroup
  dragOver: boolean
  onToggle: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onAddSymbol: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(group.name)
  const inputRef = useRef<HTMLInputElement>(null)

  function commitRename() {
    const trimmed = draft.trim()
    if (trimmed) onRename(trimmed)
    setEditing(false)
  }

  useEffect(() => {
    if (editing) {
      setDraft(group.name)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [editing, group.name])

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 group/gh cursor-grab active:cursor-grabbing ${dragOver ? "border-t-2 border-primary" : "border-t-2 border-transparent"}`}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/20 group-hover/gh:text-muted-foreground/50 shrink-0 transition-colors" />

      <button type="button" onClick={onToggle} className="flex-1 flex items-center gap-1.5 min-w-0 text-left">
        <span className="text-muted-foreground shrink-0">
          {group.collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditing(false) }}
            onBlur={commitRename}
            className="flex-1 min-w-0 bg-transparent border-b border-primary text-xs font-black uppercase tracking-wider text-foreground focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-xs font-black uppercase tracking-wider text-muted-foreground group-hover/gh:text-foreground transition-colors truncate">
            {group.name}
          </span>
        )}
      </button>

      <div className="flex items-center gap-1 opacity-0 group-hover/gh:opacity-100 transition-opacity">
        <button type="button" onClick={(e) => { e.stopPropagation(); onAddSymbol() }} className="h-5 w-5 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Añadir símbolo">
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(true) }} className="h-5 w-5 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Renombrar">
          <Pencil className="h-3 w-3" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete() }} className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors cursor-pointer" title="Eliminar grupo">
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Drag State ───────────────────────────────────────────────────────────────

interface DragState {
  type: "group" | "item"
  groupId: string
  itemIndex?: number // only for type="item"
}

interface DragOverTarget {
  type: "group" | "item"
  groupId: string
  itemIndex?: number
  half?: "top" | "bottom" // insert before (top) or after (bottom)
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function WatchlistPanel() {
  const [groups, setGroups] = useState<WatchGroup[]>(DEFAULT_GROUPS)
  const [panelCollapsed, setPanelCollapsed] = useState(true)
  const { quotes, registerSymbols, unregisterSymbols } = useStockQuotes()
  const [addModal, setAddModal] = useState<{ groupId: string } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<DragOverTarget | null>(null)

  // Persistence
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setGroups(JSON.parse(stored))
      const col = localStorage.getItem(COLLAPSED_KEY)
      if (col !== null) {
        setPanelCollapsed(JSON.parse(col))
      } else {
        setPanelCollapsed(true)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(groups)) } catch {}
  }, [groups])

  function togglePanel() {
    setPanelCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)) } catch {}
      queueMicrotask(() => {
        window.dispatchEvent(new CustomEvent(TOGGLE_EVENT, { detail: next }))
      })
      return next
    })
  }

  // Close panel on Escape if open and modal is closed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !panelCollapsed && !addModal) {
        togglePanel()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [panelCollapsed, addModal])

  // Only register and poll watchlist symbols when the panel is VISIBLE (open)
  const symbolsKey = groups.flatMap((g) => g.items.map((i) => i.symbol)).sort().join(",")
  useEffect(() => {
    if (panelCollapsed) {
      unregisterSymbols("watchlist")
      return
    }

    const syms = symbolsKey ? symbolsKey.split(",") : []
    registerSymbols("watchlist", syms)
  }, [panelCollapsed, symbolsKey, registerSymbols, unregisterSymbols])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unregisterSymbols("watchlist")
    }
  }, [unregisterSymbols])

  // ── Group mutations ──────────────────────────────────────────────────────────

  function toggleGroup(id: string) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, collapsed: !g.collapsed } : g)))
  }
  function renameGroup(id: string, name: string) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)))
  }
  function deleteGroup(id: string) {
    setGroups((prev) => prev.filter((g) => g.id !== id))
  }
  function addGroup() {
    const id = `group_${Date.now()}`
    setGroups((prev) => [...prev, { id, name: "Nueva Lista", collapsed: false, items: [] }])
  }
  function addItem(groupId: string, item: WatchItem) {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        if (g.items.some((i) => i.symbol === item.symbol)) return g
        return { ...g, items: [...g.items, item] }
      })
    )
  }
  function removeItem(groupId: string, symbol: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, items: g.items.filter((i) => i.symbol !== symbol) } : g
      )
    )
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  function handleGroupDragStart(groupId: string) {
    setDrag({ type: "group", groupId })
  }

  function handleItemDragStart(groupId: string, itemIndex: number) {
    setDrag({ type: "item", groupId, itemIndex })
  }

  function handleGroupDragOver(e: React.DragEvent, groupId: string) {
    e.preventDefault()
    setDragOverTarget({ type: "group", groupId })
  }

  function handleItemDragOver(e: React.DragEvent, groupId: string, itemIndex: number) {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const half = e.clientY < rect.top + rect.height / 2 ? "top" : "bottom"
    setDragOverTarget({ type: "item", groupId, itemIndex, half })
  }

  function handleDrop() {
    if (!drag || !dragOverTarget) { setDrag(null); setDragOverTarget(null); return }

    setGroups((prev) => {
      const next = prev.map((g) => ({ ...g, items: [...g.items] }))

      if (drag.type === "group" && dragOverTarget.type === "group") {
        const fromIdx = next.findIndex((g) => g.id === drag.groupId)
        const toIdx = next.findIndex((g) => g.id === dragOverTarget.groupId)
        if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
          const [moved] = next.splice(fromIdx, 1)
          next.splice(toIdx, 0, moved)
        }
      } else if (drag.type === "item" && drag.itemIndex !== undefined) {
        const fromGroupIdx = next.findIndex((g) => g.id === drag.groupId)
        if (fromGroupIdx === -1) return prev

        // Clone the item before removing
        const item = { ...next[fromGroupIdx].items[drag.itemIndex] }

        // Remove from source
        next[fromGroupIdx].items.splice(drag.itemIndex, 1)

        if (dragOverTarget.type === "item" && dragOverTarget.itemIndex !== undefined) {
          const toGroupIdx = next.findIndex((g) => g.id === dragOverTarget.groupId)
          if (toGroupIdx === -1) return prev

          // Adjust insert index: if same group and target is after source, account for removal
          let insertAt = dragOverTarget.itemIndex
          if (dragOverTarget.half === "bottom") insertAt += 1
          // If same group and we removed an item before the insert point, adjust
          if (fromGroupIdx === toGroupIdx && drag.itemIndex < insertAt) insertAt -= 1
          insertAt = Math.max(0, Math.min(insertAt, next[toGroupIdx].items.length))

          next[toGroupIdx].items.splice(insertAt, 0, item)
        } else if (dragOverTarget.type === "group") {
          const toGroupIdx = next.findIndex((g) => g.id === dragOverTarget.groupId)
          if (toGroupIdx !== -1) next[toGroupIdx].items.push(item)
        }
      }

      return next
    })

    setDrag(null)
    setDragOverTarget(null)
  }

  function handleDragEnd() {
    setDrag(null)
    setDragOverTarget(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Mobile backdrop overlay */}
      {!panelCollapsed && (
        <div
          className="fixed inset-0 z-[98] bg-black/60 backdrop-blur-xs xl:hidden transition-opacity duration-300"
          onClick={togglePanel}
          aria-hidden="true"
        />
      )}

      {/* Toggle tab */}
      <button
        type="button"
        onClick={togglePanel}
        title={panelCollapsed ? "Abrir lista de seguimiento" : "Cerrar lista de seguimiento"}
        aria-label={panelCollapsed ? "Abrir lista de seguimiento" : "Cerrar lista de seguimiento"}
        className="fixed top-1/2 -translate-y-1/2 z-[100] flex items-center justify-center h-12 w-6 sm:w-7 rounded-l-xl border border-r-0 border-border bg-card/95 backdrop-blur-sm shadow-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-300 cursor-pointer group"
        style={{ right: panelCollapsed ? 0 : `min(${PANEL_W}px, 85vw)` }}
      >
        {panelCollapsed ? (
          <PanelRightOpen className="h-4 w-4 transition-transform group-hover:scale-110" />
        ) : (
          <PanelRightClose className="h-4 w-4 transition-transform group-hover:scale-110" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className="fixed top-0 right-0 h-dvh z-[99] flex flex-col bg-card border-l border-border shadow-2xl transition-transform duration-300 ease-in-out select-none max-w-[85vw]"
        style={{
          width: PANEL_W,
          transform: panelCollapsed ? "translateX(100%)" : "translateX(0)",
        }}
        aria-label="Lista de seguimiento"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <BookMarked className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-black text-foreground uppercase tracking-wider truncate">
              Lista de seguimiento
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={addGroup}
              title="Nuevo grupo"
              aria-label="Nuevo grupo"
              className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={togglePanel}
              title="Cerrar barra lateral"
              aria-label="Cerrar barra lateral"
              className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer xl:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Column labels */}
        <div className="flex items-center px-3 py-1.5 border-b border-border/50 shrink-0 bg-secondary/20">
          <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-7">
            Símbolo
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-20 text-right pr-6">
            Última / %
          </span>
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto py-1 px-1" onDragOver={(e) => e.preventDefault()}>
          {groups.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 px-3 text-center">
              <Star className="h-8 w-8 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground">
                Sin grupos. Pulsa <strong>+</strong> para crear uno.
              </p>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.id} className="mb-1">
              <GroupHeader
                group={group}
                dragOver={dragOverTarget?.type === "group" && dragOverTarget.groupId === group.id && drag?.type === "group"}
                onToggle={() => toggleGroup(group.id)}
                onRename={(name) => renameGroup(group.id, name)}
                onDelete={() => deleteGroup(group.id)}
                onAddSymbol={() => setAddModal({ groupId: group.id })}
                onDragStart={() => handleGroupDragStart(group.id)}
                onDragOver={(e) => handleGroupDragOver(e, group.id)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />

              {!group.collapsed && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setAddModal({ groupId: group.id })}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-primary transition-colors hover:bg-secondary/40 rounded-md"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Añadir símbolo</span>
                    </button>
                  ) : (
                    <>
                      {group.items.map((item, idx) => (
                        <WatchlistRow
                          key={item.symbol}
                          item={item}
                          quote={quotes[item.symbol]}
                          onRemove={() => removeItem(group.id, item.symbol)}
                          dragging={drag?.type === "item" && drag.groupId === group.id && drag.itemIndex === idx}
                          dragOverTop={
                            dragOverTarget?.type === "item" &&
                            dragOverTarget.groupId === group.id &&
                            dragOverTarget.itemIndex === idx &&
                            dragOverTarget.half === "top"
                          }
                          dragOverBottom={
                            dragOverTarget?.type === "item" &&
                            dragOverTarget.groupId === group.id &&
                            dragOverTarget.itemIndex === idx &&
                            dragOverTarget.half === "bottom"
                          }
                          onDragStart={() => handleItemDragStart(group.id, idx)}
                          onDragOver={(e) => handleItemDragOver(e, group.id, idx)}
                          onDrop={handleDrop}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setAddModal({ groupId: group.id })}
                        className="w-full flex items-center gap-1.5 px-4 py-1.5 text-xs text-muted-foreground hover:text-primary transition-colors opacity-70 hover:opacity-100 hover:bg-secondary/30 rounded-md"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Añadir</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2.5 border-t border-border/50 shrink-0 bg-card">
          <p className="text-[11px] text-muted-foreground/60 text-center font-medium">
            Datos vía TradingView · 60 s
          </p>
        </div>
      </aside>

      {/* Modal */}
      {addModal && (
        <AddSymbolModal
          defaultGroupId={addModal.groupId}
          groups={groups}
          onAdd={addItem}
          onClose={() => setAddModal(null)}
        />
      )}
    </>
  )
}
