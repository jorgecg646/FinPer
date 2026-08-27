"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { RefreshCw, LayoutGrid, Rows, TrendingUp, TrendingDown, AlertTriangle, X, ExternalLink } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

export type PeriodMode = "1D" | "1M" | "YTD"

interface TickerItem {
  symbol: string
  short: string
  flag?: string
  logo?: string
  chartSymbol?: string
  category: "indices" | "bonds" | "commodities" | "crypto"
  price: number
  change: number
  changePercent: number
  monthChangePercent: number
  ytdChangePercent: number
  status: "loading" | "ok" | "error"
}

// ─── Asset Items Metadata List ────────────────────────────────────────────────

const ALL_ITEMS: Pick<TickerItem, "symbol" | "short" | "flag" | "logo" | "chartSymbol" | "category">[] = [
  // Indices — flag = ISO-2 country code
  { symbol: "SP:SPX",          short: "S&P 500",   flag: "US", chartSymbol: "FOREXCOM:SPXUSD", category: "indices"     },
  { symbol: "NASDAQ:NDX",      short: "NASDAQ",    flag: "US", chartSymbol: "FOREXCOM:NSXUSD", category: "indices"     },
  { symbol: "DJ:DJI",          short: "DOW",       flag: "US", chartSymbol: "FOREXCOM:DJI",    category: "indices"     },
  { symbol: "TVC:SXXP",        short: "STOXX 600", flag: "EU", chartSymbol: "STOXX:SXXP",      category: "indices"     },
  { symbol: "XETR:DAX",        short: "DAX",       flag: "DE", chartSymbol: "XETR:DAX",        category: "indices"     },
  { symbol: "SPREADEX:FTSE",   short: "FTSE 100",  flag: "GB", chartSymbol: "CURRENCYCOM:UK100",category: "indices"     },
  { symbol: "TVC:NI225",       short: "NIKKEI",    flag: "JP", chartSymbol: "CURRENCYCOM:JP225",category: "indices"     },
  { symbol: "TVC:KOSPI",       short: "KOSPI",     flag: "KR", chartSymbol: "KRX:KOSPI",       category: "indices"     },
  { symbol: "TVC:SHCOMP",      short: "SHANGHAI",  flag: "CN", chartSymbol: "SSE:000001",      category: "indices"     },
  { symbol: "BME:IBC",         short: "IBEX 35",   flag: "ES", chartSymbol: "BME:IBC",         category: "indices"     },
  // Bonds — explicit maturity duration + embeddable rate symbols
  { symbol: "TVC:US02Y",       short: "US 2Y",     flag: "US", chartSymbol: "US02Y",           category: "bonds"       },
  { symbol: "TVC:US10Y",       short: "US 10Y",    flag: "US", chartSymbol: "US10Y",           category: "bonds"       },
  { symbol: "TVC:US30Y",       short: "US 30Y",    flag: "US", chartSymbol: "US30Y",           category: "bonds"       },
  { symbol: "TVC:DE10Y",       short: "BUND 10Y",  flag: "DE", chartSymbol: "DE10Y",           category: "bonds"       },
  { symbol: "TVC:GB10Y",       short: "GILT 10Y",  flag: "GB", chartSymbol: "GB10Y",           category: "bonds"       },
  { symbol: "TVC:JP10Y",       short: "JGB 10Y",   flag: "JP", chartSymbol: "JP10Y",           category: "bonds"       },
  // Commodities — TradingView High-Res SVG logos
  { symbol: "TVC:GOLD",        short: "GOLD",   logo: "https://s3-symbol-logo.tradingview.com/metal/gold--big.svg",     chartSymbol: "OANDA:XAUUSD",           category: "commodities" },
  { symbol: "TVC:SILVER",      short: "SILVER", logo: "https://s3-symbol-logo.tradingview.com/silver.svg",              chartSymbol: "OANDA:XAGUSD",           category: "commodities" },
  { symbol: "TVC:USOIL",       short: "WTI",    logo: "https://s3-symbol-logo.tradingview.com/crude-oil--big.svg",      chartSymbol: "OANDA:WTICOUSD",         category: "commodities" },
  { symbol: "TVC:UKOIL",       short: "BRENT",  logo: "https://s3-symbol-logo.tradingview.com/crude-oil--big.svg",      chartSymbol: "OANDA:BCOUSD",           category: "commodities" },
  { symbol: "TVC:NATGAS",      short: "NATGAS", logo: "https://s3-symbol-logo.tradingview.com/natural-gas--big.svg",   chartSymbol: "CAPITALCOM:NATURALGAS",  category: "commodities" },
  { symbol: "COMEX:HG1!",      short: "COPPER", logo: "https://s3-symbol-logo.tradingview.com/metal/copper--big.svg",  chartSymbol: "CAPITALCOM:XCUUSD",      category: "commodities" },
  // Crypto — TradingView SVG logos
  { symbol: "BINANCE:BTCUSDT", short: "BTC", logo: "https://s3-symbol-logo.tradingview.com/crypto/XTVCBTC.svg", category: "crypto" },
  { symbol: "BINANCE:ETHUSDT", short: "ETH", logo: "https://s3-symbol-logo.tradingview.com/crypto/XTVCETH.svg", category: "crypto" },
  { symbol: "BINANCE:SOLUSDT", short: "SOL", logo: "https://s3-symbol-logo.tradingview.com/crypto/XTVCSOL.svg", category: "crypto" },
]

const CACHE_KEY = "finper_markets_cache_v1"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<TickerItem["category"], string> = {
  indices:     "ÍNDICES",
  bonds:       "BONOS",
  commodities: "MATERIAS PRIMAS",
  crypto:      "CRIPTO",
}

const CATEGORY_COLOR: Record<TickerItem["category"], string> = {
  indices:     "text-sky-700 dark:text-sky-400 font-black",
  bonds:       "text-amber-700 dark:text-amber-400 font-black",
  commodities: "text-orange-700 dark:text-orange-400 font-black",
  crypto:      "text-violet-700 dark:text-violet-400 font-black",
}

function getDisplayedPct(item: TickerItem, period: PeriodMode): number {
  if (period === "1M") return item.monthChangePercent
  if (period === "YTD") return item.ytdChangePercent
  return item.changePercent
}

function fmtVal(val: number, isBond: boolean): string {
  const dec = isBond ? 3 : 2
  return Math.abs(val).toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// ─── Asset Icon / Flag Component ─────────────────────────────────────────────

function AssetIcon({ flag, logo, short }: { flag?: string; logo?: string; short?: string }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={short ?? "logo"}
        width={18}
        height={18}
        loading="lazy"
        decoding="async"
        className="inline-block rounded-full object-cover shrink-0 bg-stone-200 dark:bg-white/10 p-0.5"
      />
    )
  }
  if (flag) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://flagcdn.com/${flag.toLowerCase()}.svg`}
        alt={flag}
        width={20}
        height={14}
        loading="lazy"
        decoding="async"
        className="inline-block rounded-[2px] object-cover shrink-0"
      />
    )
  }
  return null
}

// ─── Single Ticker Entry Component ────────────────────────────────────────────

function TickerEntry({
  item,
  period,
  onSelect,
}: {
  item: TickerItem
  period: PeriodMode
  onSelect: (item: TickerItem) => void
}) {
  const pct = getDisplayedPct(item, period)
  const isUp = period === "1D" ? item.change >= 0 : pct >= 0
  const isBond = item.category === "bonds"
  const isHighVolatility = Math.abs(item.changePercent) >= 3.0

  if (item.status === "loading") {
    return (
      <span className="inline-flex items-center gap-2 px-4 border-r border-stone-300/80 dark:border-white/15 shrink-0">
        <AssetIcon flag={item.flag} logo={item.logo} short={item.short} />
        <span className="text-[11px] font-extrabold tracking-widest text-stone-500 dark:text-slate-300 uppercase">{item.short}</span>
        <span className="h-3 w-14 rounded bg-stone-300/60 dark:bg-white/20 animate-pulse inline-block" />
      </span>
    )
  }

  if (item.status === "error") return null

  const colorClass = isUp ? "text-emerald-700 dark:text-emerald-400 font-extrabold" : "text-rose-700 dark:text-rose-400 font-extrabold"

  return (
    <span
      onClick={() => onSelect(item)}
      title="Haz clic para ver gráfico interactivo"
      className={`inline-flex items-center gap-3 px-5 border-r border-stone-300/80 dark:border-white/15 shrink-0 cursor-pointer hover:bg-stone-300/40 dark:hover:bg-white/10 transition-colors ${
        isHighVolatility ? "bg-amber-500/10 dark:bg-amber-500/20" : ""
      }`}
    >
      {isHighVolatility && (
        <span className="text-[10px] font-black bg-amber-500/20 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200 border border-amber-500/40 rounded px-1.5 py-0.5 animate-pulse shrink-0">
          🚨 &gt;3%
        </span>
      )}
      <AssetIcon flag={item.flag} logo={item.logo} short={item.short} />
      <span className={`text-xs font-black tracking-wider uppercase ${CATEGORY_COLOR[item.category]}`}>
        {item.short}
      </span>
      <span className="text-sm font-black text-stone-900 dark:text-white tabular-nums">
        {fmtVal(item.price, isBond)}
        {isBond && <span className="text-xs text-stone-500 dark:text-slate-300 ml-0.5">%</span>}
      </span>
      <span className={`text-xs font-extrabold tabular-nums ${colorClass} flex items-center gap-1`}>
        <span>{isUp ? "▲" : "▼"}</span>
        {period === "1D" && <span>{isUp ? "+" : "-"}{fmtVal(item.change, isBond)}</span>}
        <span className="font-extrabold">({isUp ? "+" : "-"}{fmtVal(pct, false)}% <span className="text-[9px] text-stone-500 dark:text-slate-300 font-extrabold">{period}</span>)</span>
      </span>
    </span>
  )
}

// ─── Scrolling Ticker Builder ─────────────────────────────────────────────────

function buildTickerItems(
  items: TickerItem[],
  period: PeriodMode,
  prefix: string,
  onSelect: (item: TickerItem) => void
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const visibleCategories = new Set(items.filter((i) => i.status !== "error").map((i) => i.category))
  let lastCategory: TickerItem["category"] | null = null

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.status === "error") continue
    if (item.category !== lastCategory && visibleCategories.has(item.category)) {
      nodes.push(
        <span
          key={`${prefix}-cat-${item.category}`}
          className={`inline-flex items-center px-3.5 shrink-0 text-[10px] font-black tracking-[0.2em] uppercase ${CATEGORY_COLOR[item.category]} bg-stone-200/80 dark:bg-white/10 border-r border-stone-300/80 dark:border-white/15`}
        >
          {CATEGORY_LABELS[item.category]}
        </span>
      )
      lastCategory = item.category
    }
    nodes.push(<TickerEntry key={`${prefix}-${item.symbol}`} item={item} period={period} onSelect={onSelect} />)
  }
  return nodes
}

// ─── TradingView Interactive Chart Modal Component ───────────────────────────

function TradingViewModal({
  item,
  period,
  onClose,
}: {
  item: TickerItem
  period: PeriodMode
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartSymbol = item.chartSymbol ?? item.symbol
  const isBond = item.category === "bonds"
  const pct = getDisplayedPct(item, period)
  const isUp = period === "1D" ? item.change >= 0 : pct >= 0
  const colorClass = isUp ? "text-emerald-400 font-extrabold" : "text-rose-400 font-extrabold"
  const directTvUrl = `https://es.tradingview.com/chart/?symbol=${encodeURIComponent(chartSymbol)}`

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ""

    const widgetContainer = document.createElement("div")
    widgetContainer.id = "tv_chart_modal_container"
    widgetContainer.style.width = "100%"
    widgetContainer.style.height = "100%"
    containerRef.current.appendChild(widgetContainer)

    const initWidget = () => {
      if (typeof (window as any).TradingView !== "undefined") {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: chartSymbol,
          interval: "D",
          timezone: "Europe/Madrid",
          theme: "dark",
          style: "1",
          locale: "es",
          toolbar_bg: "#09111e",
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: "tv_chart_modal_container",
        })
      }
    }

    if ((window as any).TradingView) {
      initWidget()
    } else {
      const script = document.createElement("script")
      script.src = "https://s3.tradingview.com/tv.js"
      script.async = true
      script.onload = initWidget
      containerRef.current.appendChild(script)
    }
  }, [chartSymbol])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-[#09111e] border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[85vh] max-h-[720px] text-white relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#050b14] border-b border-white/15 shrink-0">
          <div className="flex items-center gap-3">
            <AssetIcon flag={item.flag} logo={item.logo} short={item.short} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black uppercase tracking-wider text-white">{item.short}</h3>
                <span className="text-xs font-mono font-bold text-slate-400">{chartSymbol}</span>
              </div>
              <a
                href={directTvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 hover:underline"
              >
                <span>Abrir directo en TradingView</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-base font-black text-white tabular-nums">
                {fmtVal(item.price, isBond)}
                {isBond && <span className="text-xs text-slate-300">%</span>}
              </div>
              <div className={`text-xs font-extrabold tabular-nums ${colorClass}`}>
                {isUp ? "▲" : "▼"} {isUp ? "+" : "-"}{fmtVal(pct, false)}% ({period})
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Cerrar gráfico"
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div ref={containerRef} className="flex-1 w-full h-full bg-[#09111e] relative min-h-[400px]" />
      </div>
    </div>
  )
}

// ─── Market Clock / Status Bar ────────────────────────────────────────────────

interface MarketClock {
  name: string
  flag: string
  localTime: string
  status: "open" | "closed" | "pre" | "after"
  statusLabel: string
}

const CLOCK_STATUS_STYLES: Record<MarketClock["status"], { dot: string; bg: string }> = {
  open:  { dot: "bg-emerald-500 animate-pulse", bg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-black" },
  pre:   { dot: "bg-amber-500 animate-pulse",   bg: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 font-black" },
  after: { dot: "bg-amber-500",                 bg: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 font-black" },
  closed:{ dot: "bg-rose-500",                  bg: "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30 font-black" },
}

function getMarketStatuses(now: Date): MarketClock[] {
  const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6
  const getMins = (tz: string) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hour12: false })
      .format(now)
      .split(":")
    const h = Number(parts[0]) % 24
    const m = Number(parts[1])
    return { h, m, mins: h * 60 + m }
  }

  const eu = getMins("Europe/Madrid")
  const ny = getMins("America/New_York")
  const cn = getMins("Asia/Shanghai")
  const jp = getMins("Asia/Tokyo")

  const fmtTime = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`

  return [
    {
      name: "Europa",
      flag: "EU",
      localTime: fmtTime(eu.h, eu.m),
      status: !isWeekend && eu.mins >= 540 && eu.mins < 1050 ? "open" : "closed",
      statusLabel: !isWeekend && eu.mins >= 540 && eu.mins < 1050 ? "Abierto" : "Cerrado",
    },
    {
      name: "Wall Street",
      flag: "US",
      localTime: fmtTime(ny.h, ny.m),
      status: isWeekend ? "closed" : ny.mins >= 570 && ny.mins < 960 ? "open" : ny.mins >= 240 && ny.mins < 570 ? "pre" : "closed",
      statusLabel: isWeekend ? "Cerrado" : ny.mins >= 570 && ny.mins < 960 ? "Abierto" : ny.mins >= 240 && ny.mins < 570 ? "Pre-Market" : "Cerrado",
    },
    {
      name: "China",
      flag: "CN",
      localTime: fmtTime(cn.h, cn.m),
      status: !isWeekend && cn.mins >= 570 && cn.mins < 900 ? (cn.mins >= 690 && cn.mins < 780 ? "closed" : "open") : "closed",
      statusLabel: !isWeekend && cn.mins >= 570 && cn.mins < 900 ? (cn.mins >= 690 && cn.mins < 780 ? "Descanso" : "Abierto") : "Cerrado",
    },
    {
      name: "Tokio",
      flag: "JP",
      localTime: fmtTime(jp.h, jp.m),
      status: !isWeekend && jp.mins >= 540 && jp.mins < 900 ? "open" : "closed",
      statusLabel: !isWeekend && jp.mins >= 540 && jp.mins < 900 ? "Abierto" : "Cerrado",
    },
    {
      name: "Cripto / 24h",
      flag: "",
      localTime: fmtTime(eu.h, eu.m),
      status: "open",
      statusLabel: "24/7 Live",
    },
  ]
}

function MarketClockBar() {
  const [clocks, setClocks] = useState<MarketClock[]>(() => getMarketStatuses(new Date()))

  useEffect(() => {
    const id = setInterval(() => setClocks(getMarketStatuses(new Date())), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-stone-200/80 dark:bg-[#040810] border-t border-stone-300/80 dark:border-white/15 overflow-x-auto no-scrollbar">
      <span className="text-[10px] font-black text-stone-600 dark:text-slate-300 uppercase tracking-wider shrink-0 px-1 hidden sm:inline">
        HORARIO MERCADOS:
      </span>
      <div className="flex items-center gap-2 flex-nowrap">
        {clocks.map((c) => {
          const style = CLOCK_STATUS_STYLES[c.status]
          return (
            <div
              key={c.name}
              className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white border border-stone-300/80 dark:bg-white/10 dark:border-white/15 shrink-0 shadow-2xs text-stone-900 dark:text-white"
            >
              <AssetIcon flag={c.flag} short={c.name} />
              <span className="text-xs font-black">{c.name}</span>
              <span className="text-[11px] font-extrabold text-stone-600 dark:text-slate-200 tabular-nums">{c.localTime}</span>
              <span className={`flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded border ${style.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                {c.statusLabel}
              </span>
            </div>
          )
        })}
      </div>
      <div className="ml-auto shrink-0 px-2 hidden lg:flex items-center gap-1 opacity-75 hover:opacity-100 transition-opacity">
        <span className="text-[9px] font-black tracking-wider text-stone-600 dark:text-slate-300 uppercase">
          Datos por TradingView
        </span>
      </div>
    </div>
  )
}

// ─── Main Panel Component ─────────────────────────────────────────────────────

export function MarketIndicesPanel() {
  // ⚡ Instant Cache Hydration for 0ms initial render
  const [items, setItems] = useState<TickerItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached) as TickerItem[]
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch {
        // fallback
      }
    }
    return ALL_ITEMS.map((i) => ({
      ...i,
      price: 0,
      change: 0,
      changePercent: 0,
      monthChangePercent: 0,
      ytdChangePercent: 0,
      status: "loading" as const,
    }))
  })

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [paused, setPaused] = useState(false)
  const [viewMode, setViewMode] = useState<"ticker" | "grid">("ticker")
  const [period, setPeriod] = useState<PeriodMode>("1D")
  const [flashing, setFlashing] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TickerItem | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/api/market-indices")
      if (!res.ok) throw new Error("HTTP " + res.status)
      const json = (await res.json()) as {
        symbol: string; price: number; change: number; changePercent: number
        monthChangePercent: number; ytdChangePercent: number
      }[]
      if (!Array.isArray(json)) throw new Error("Bad response")

      const updated = ALL_ITEMS.map((meta) => {
        const row = json.find((r) => r.symbol === meta.symbol)
        if (!row || row.price === 0) return { ...meta, price: 0, change: 0, changePercent: 0, monthChangePercent: 0, ytdChangePercent: 0, status: "error" as const }
        return {
          ...meta,
          price: row.price,
          change: row.change,
          changePercent: row.changePercent,
          monthChangePercent: row.monthChangePercent ?? row.changePercent,
          ytdChangePercent: row.ytdChangePercent ?? row.changePercent,
          status: "ok" as const,
        }
      })

      setItems(updated)
      setLastUpdated(new Date())
      setFlashing(true)
      setTimeout(() => setFlashing(false), 1500)

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(updated))
      } catch {
        // ignore
      }
    } catch {
      setItems((prev) => prev.map((i) => ({ ...i, status: "error" as const })))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    let id = setInterval(fetchAll, 10 * 1000)

    // ⚡ Tab Visibility Listener: Pause polling when tab is inactive, resume immediately on focus
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(id)
      } else {
        fetchAll()
        id = setInterval(fetchAll, 10 * 1000)
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [fetchAll])

  const handleSelectSymbol = useCallback((item: TickerItem) => setSelectedItem(item), [])

  const allNodes = useMemo(
    () => [
      ...buildTickerItems(items, period, "a", handleSelectSymbol),
      ...buildTickerItems(items, period, "b", handleSelectSymbol),
    ],
    [items, period, handleSelectSymbol]
  )

  const volatileItems = useMemo(
    () => items.filter((i) => i.status === "ok" && Math.abs(i.changePercent) >= 3.0),
    [items]
  )

  return (
    <section aria-label="Mercados globales en tiempo real" className="overflow-hidden rounded-2xl shadow-sm border border-stone-300/80 bg-stone-100/95 text-stone-900 dark:bg-[#09111e] dark:border-slate-700/80 dark:text-white transition-colors duration-300">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between bg-stone-200/90 dark:bg-[#09111e] border-b border-stone-300/80 dark:border-white/15 gap-y-1">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-stone-900 text-white dark:bg-[#0f2044] border-r border-stone-300/80 dark:border-white/15 shrink-0 min-w-[110px]">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
          <span className="text-[10px] font-black tracking-[0.18em] uppercase">Mercados</span>
        </div>

        {viewMode === "ticker" ? (
          <div
            className="flex-1 overflow-hidden relative min-w-[200px]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-stone-200/90 dark:from-[#09111e] to-transparent" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-stone-200/90 dark:from-[#09111e] to-transparent" />
            <div
              ref={trackRef}
              className={`flex items-center py-2 transition-colors duration-500 ${flashing ? "bg-primary/20" : ""}`}
              style={{
                animation: "ticker-scroll 90s linear infinite",
                animationPlayState: paused ? "paused" : "running",
                width: "max-content",
                willChange: "transform",
                transform: "translateZ(0)",
              }}
            >
              {allNodes}
            </div>
          </div>
        ) : (
          <div className="flex-1 px-4 py-2">
            <span className="text-xs font-black tracking-wider text-stone-900 dark:text-white uppercase">Vista Cuadrícula</span>
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2 border-l border-stone-300/80 dark:border-white/15 shrink-0 bg-stone-200/90 dark:bg-[#09111e]">
          <div className="flex items-center p-0.5 rounded-lg bg-stone-300/60 dark:bg-white/10 border border-stone-400/40 dark:border-white/15 text-[10px] font-bold">
            {(["1D", "1M", "YTD"] as PeriodMode[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded transition-all ${
                  period === p
                    ? "bg-sky-600 text-white dark:bg-sky-400 dark:text-slate-950 font-black shadow-xs"
                    : "text-stone-700 hover:text-stone-900 dark:text-slate-200 dark:hover:text-white font-bold hover:bg-stone-300/50 dark:hover:bg-white/10"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center p-0.5 rounded-lg bg-stone-300/60 dark:bg-white/10 border border-stone-400/40 dark:border-white/15">
            <button
              onClick={() => setViewMode("ticker")}
              title="Vista Ticker Scroll"
              aria-label="Vista Ticker Scroll"
              className={`p-1 rounded-md transition-colors ${
                viewMode === "ticker"
                  ? "bg-sky-600 text-white dark:bg-sky-400 dark:text-slate-950 font-bold"
                  : "text-stone-700 hover:text-stone-900 dark:text-slate-200 dark:hover:text-white hover:bg-stone-300/50 dark:hover:bg-white/10"
              }`}
            >
              <Rows className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              title="Vista Cuadrícula"
              aria-label="Vista Cuadrícula"
              className={`p-1 rounded-md transition-colors ${
                viewMode === "grid"
                  ? "bg-sky-600 text-white dark:bg-sky-400 dark:text-slate-950 font-bold"
                  : "text-stone-700 hover:text-stone-900 dark:text-slate-200 dark:hover:text-white hover:bg-stone-300/50 dark:hover:bg-white/10"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>

          {lastUpdated && (
            <span className="hidden sm:block text-[11px] font-extrabold text-stone-700 dark:text-slate-200 tabular-nums">
              {lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={fetchAll}
            disabled={refreshing}
            aria-label="Actualizar cotizaciones"
            className="text-stone-700 hover:text-stone-900 dark:text-slate-200 dark:hover:text-white transition-colors disabled:opacity-40 p-1 hover:bg-stone-300/50 dark:hover:bg-white/10 rounded-md"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Volatility Banner */}
      {volatileItems.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/15 dark:bg-amber-500/20 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold overflow-x-auto no-scrollbar">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300 animate-pulse" />
          <span className="uppercase text-[10px] tracking-wider shrink-0 text-amber-700 dark:text-amber-300 font-black">
            🚨 Volatilidad Alta Detectada (&gt;3%):
          </span>
          <div className="flex items-center gap-3 shrink-0">
            {volatileItems.map((vi) => (
              <span
                key={vi.symbol}
                onClick={() => handleSelectSymbol(vi)}
                className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 border border-amber-400/50 px-2 py-0.5 rounded text-[11px] tabular-nums font-bold cursor-pointer hover:underline"
              >
                {vi.short}: <span className={vi.changePercent >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                  {vi.changePercent >= 0 ? "+" : ""}{fmtVal(vi.changePercent, false)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="p-4 bg-stone-100/90 dark:bg-[#070e1a] border-b border-stone-200 dark:border-white/15">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items
              .filter((i) => i.status !== "error")
              .map((item) => {
                const pct = getDisplayedPct(item, period)
                const isUp = period === "1D" ? item.change >= 0 : pct >= 0
                const isBond = item.category === "bonds"
                const colorClass = isUp ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-rose-700 dark:text-rose-400 font-bold"
                const isHighVolatility = Math.abs(item.changePercent) >= 3.0

                const normalBgClass = isUp
                  ? "border-emerald-500/40 bg-emerald-50/90 text-stone-900 dark:bg-[#0b1f1a] dark:text-white hover:border-emerald-500"
                  : "border-rose-500/40 bg-rose-50/90 text-stone-900 dark:bg-[#1f0b12] dark:text-white hover:border-rose-500"

                const flashBgClass = isUp
                  ? "bg-emerald-500/40 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.6)] scale-[1.02]"
                  : "bg-rose-500/40 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.6)] scale-[1.02]"

                return (
                  <div
                    key={item.symbol}
                    onClick={() => handleSelectSymbol(item)}
                    title="Haz clic para ver gráfico interactivo"
                    className={`p-3 rounded-xl border transition-all duration-300 ease-out relative overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                      flashing ? flashBgClass : normalBgClass
                    } ${isHighVolatility ? "ring-1 ring-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.3)]" : ""}`}
                  >
                    {isHighVolatility && (
                      <div className="absolute top-1 right-1 bg-amber-500/30 border border-amber-400/70 text-amber-900 dark:text-amber-200 text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                        🚨 &gt;3%
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <AssetIcon flag={item.flag} logo={item.logo} short={item.short} />
                        <span className={`text-xs font-black tracking-wider uppercase ${CATEGORY_COLOR[item.category]}`}>
                          {item.short}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold ${colorClass}`}>
                        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </span>
                    </div>

                    <p className="text-base font-black text-stone-900 dark:text-white tabular-nums leading-tight">
                      {fmtVal(item.price, isBond)}
                      {isBond && <span className="text-xs text-stone-500 dark:text-slate-300 ml-0.5">%</span>}
                    </p>

                    <div className={`mt-1 text-xs font-extrabold tabular-nums ${colorClass} flex items-center gap-1 flex-wrap`}>
                      <span>{isUp ? "▲" : "▼"}</span>
                      {period === "1D" && <span>{isUp ? "+" : "-"}{fmtVal(item.change, isBond)}</span>}
                      <span className="font-extrabold text-[11px]">({isUp ? "+" : "-"}{fmtVal(pct, false)}% <span className="text-[9px] text-stone-500 dark:text-slate-300 font-bold">{period}</span>)</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Clocks bar */}
      <MarketClockBar />

      {/* Modal */}
      {selectedItem && (
        <TradingViewModal
          item={selectedItem}
          period={period}
          onClose={() => setSelectedItem(null)}
        />
      )}

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  )
}
