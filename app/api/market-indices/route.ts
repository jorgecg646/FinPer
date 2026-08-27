import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface IndexMeta {
  symbol: string
  short: string
  category: "indices" | "bonds" | "commodities" | "crypto"
}

export interface IndexResult extends IndexMeta {
  price: number
  change: number
  changePercent: number
  monthChangePercent: number
  ytdChangePercent: number
  high: number
  low: number
  currency: string
}

/** Fallback chains for symbols when TV scanner ticker differs */
const SCANNER_TICKERS: Record<string, string[]> = {
  "SP:SPX":          ["SP:SPX", "FOREXCOM:SPXUSD"],
  "NASDAQ:NDX":      ["NASDAQ:NDX", "FOREXCOM:NSXUSD"],
  "DJ:DJI":          ["DJ:DJI", "FOREXCOM:DJI"],
  "TVC:SXXP":        ["TVC:SXXP", "STOXX:SXXP"],
  "XETR:DAX":        ["XETR:DAX", "INDEX:DAX"],
  "SPREADEX:FTSE":   ["SPREADEX:FTSE", "INDEX:FTSE"],
  "TVC:NI225":       ["TVC:NI225", "INDEX:NKY"],
  "TVC:KOSPI":       ["TVC:KOSPI", "KRX:KOSPI", "INDEX:KOSPI"],
  "TVC:SHCOMP":      ["TVC:SHCOMP", "SSE:000001"],
  "BME:IBC":         ["BME:IBC", "INDEX:IBEX"],
  "TVC:US02Y":       ["TVC:US02Y"],
  "TVC:US10Y":       ["TVC:US10Y"],
  "TVC:US30Y":       ["TVC:US30Y"],
  "TVC:DE10Y":       ["TVC:DE10Y"],
  "TVC:GB10Y":       ["TVC:GB10Y"],
  "TVC:JP10Y":       ["TVC:JP10Y"],
  "TVC:GOLD":        ["TVC:GOLD", "OANDA:XAUUSD"],
  "TVC:SILVER":      ["TVC:SILVER", "OANDA:XAGUSD"],
  "TVC:USOIL":       ["TVC:USOIL", "TVC:WTI"],
  "TVC:UKOIL":       ["TVC:UKOIL", "TVC:BRENT"],
  "TVC:NATGAS":      ["TVC:NATGAS", "NYMEX:NG1!", "CAPITALCOM:NATURALGAS"],
  "COMEX:HG1!":      ["COMEX:HG1!", "CAPITALCOM:XCUUSD"],
  "BINANCE:BTCUSDT": ["BINANCE:BTCUSDT", "COINBASE:BTCUSD"],
  "BINANCE:ETHUSDT": ["BINANCE:ETHUSDT", "COINBASE:ETHUSD"],
  "BINANCE:SOLUSDT": ["BINANCE:SOLUSDT", "COINBASE:SOLUSD"],
}

export const INDICES: IndexMeta[] = [
  { symbol: "SP:SPX",          short: "S&P 500",    category: "indices"     },
  { symbol: "NASDAQ:NDX",      short: "NASDAQ",     category: "indices"     },
  { symbol: "DJ:DJI",          short: "DOW",        category: "indices"     },
  { symbol: "TVC:SXXP",        short: "STOXX 600",  category: "indices"     },
  { symbol: "XETR:DAX",        short: "DAX",        category: "indices"     },
  { symbol: "SPREADEX:FTSE",   short: "FTSE 100",   category: "indices"     },
  { symbol: "TVC:NI225",       short: "NIKKEI",     category: "indices"     },
  { symbol: "TVC:KOSPI",       short: "KOSPI",      category: "indices"     },
  { symbol: "TVC:SHCOMP",      short: "SHANGHAI",   category: "indices"     },
  { symbol: "BME:IBC",         short: "IBEX 35",    category: "indices"     },
  { symbol: "TVC:US02Y",       short: "US 2Y",      category: "bonds"       },
  { symbol: "TVC:US10Y",       short: "US 10Y",     category: "bonds"       },
  { symbol: "TVC:US30Y",       short: "US 30Y",     category: "bonds"       },
  { symbol: "TVC:DE10Y",       short: "BUND 10Y",   category: "bonds"       },
  { symbol: "TVC:GB10Y",       short: "GILT 10Y",   category: "bonds"       },
  { symbol: "TVC:JP10Y",       short: "JGB 10Y",    category: "bonds"       },
  { symbol: "TVC:GOLD",        short: "GOLD",       category: "commodities" },
  { symbol: "TVC:SILVER",      short: "SILVER",     category: "commodities" },
  { symbol: "TVC:USOIL",       short: "WTI",        category: "commodities" },
  { symbol: "TVC:UKOIL",       short: "BRENT",      category: "commodities" },
  { symbol: "TVC:NATGAS",      short: "NATGAS",     category: "commodities" },
  { symbol: "COMEX:HG1!",      short: "COPPER",     category: "commodities" },
  { symbol: "BINANCE:BTCUSDT", short: "BTC",        category: "crypto"      },
  { symbol: "BINANCE:ETHUSDT", short: "ETH",        category: "crypto"      },
  { symbol: "BINANCE:SOLUSDT", short: "SOL",        category: "crypto"      },
]

// Pre-compute unique tickers & request payload once at module load
const ALL_TICKERS = Array.from(new Set(Object.values(SCANNER_TICKERS).flat()))
const SCANNER_PAYLOAD = JSON.stringify({
  symbols: { tickers: ALL_TICKERS },
  columns: ["close", "change_abs", "change", "Perf.1M", "Perf.YTD", "high", "low"],
})

// In-memory cache — 5 second TTL (CNBC real-time speed)
let cache: { ts: number; data: IndexResult[] } | null = null
const CACHE_TTL_MS = 5_000

interface ParsedScan {
  price: number
  change: number
  changePercent: number
  monthChangePercent: number
  ytdChangePercent: number
  high: number
  low: number
}

/** High-speed batch fetch using TradingView Global Scanner REST API (~30-50ms) */
async function fetchScannerData(): Promise<Map<string, ParsedScan>> {
  const map = new Map<string, ParsedScan>()

  try {
    const res = await fetch("https://scanner.tradingview.com/global/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: SCANNER_PAYLOAD,
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) return map
    const json = (await res.json()) as { data?: { s: string; d: (number | null)[] }[] }
    if (!json.data || !Array.isArray(json.data)) return map

    for (let i = 0; i < json.data.length; i++) {
      const row = json.data[i]
      const d = row.d
      const close = d[0]
      if (typeof close === "number" && !isNaN(close) && close > 0) {
        const changeAbs = d[1]
        const changePct = d[2]
        const perf1M = d[3]
        const perfYtd = d[4]
        const high = d[5]
        const low = d[6]
        const cPct = typeof changePct === "number" && !isNaN(changePct) ? changePct : 0
        map.set(row.s, {
          price: close,
          change: typeof changeAbs === "number" && !isNaN(changeAbs) ? changeAbs : 0,
          changePercent: cPct,
          monthChangePercent: typeof perf1M === "number" && !isNaN(perf1M) ? perf1M : cPct,
          ytdChangePercent: typeof perfYtd === "number" && !isNaN(perfYtd) ? perfYtd : cPct,
          high: typeof high === "number" && !isNaN(high) ? high : close,
          low: typeof low === "number" && !isNaN(low) ? low : close,
        })
      }
    }
  } catch {
    // Return whatever was collected or empty map
  }

  return map
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(cache.data, {
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
      },
    })
  }

  try {
    const scanData = await fetchScannerData()

    const results: IndexResult[] = INDICES.map((idx) => {
      const candidates = SCANNER_TICKERS[idx.symbol] ?? [idx.symbol]
      let data: ParsedScan | undefined

      for (let i = 0; i < candidates.length; i++) {
        data = scanData.get(candidates[i])
        if (data && data.price > 0) break
      }

      return {
        ...idx,
        price: data?.price ?? 0,
        change: data?.change ?? 0,
        changePercent: data?.changePercent ?? 0,
        monthChangePercent: data?.monthChangePercent ?? 0,
        ytdChangePercent: data?.ytdChangePercent ?? 0,
        high: data?.high ?? 0,
        low: data?.low ?? 0,
        currency: "USD",
      }
    })

    if (results.some((r) => r.price > 0)) {
      cache = { ts: Date.now(), data: results }
    }

    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
