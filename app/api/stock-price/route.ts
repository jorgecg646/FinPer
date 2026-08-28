import { NextRequest, NextResponse } from "next/server"

// Force Node.js runtime — @mathieuc/tradingview requires WebSockets (not available in Edge)
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface QuoteData {
  lp?: number
  ch?: number
  chp?: number
  high_price?: number
  low_price?: number
  open_price?: number
  prev_close_price?: number
  volume?: number
  description?: string
  short_name?: string
  currency_code?: string
  exchange?: string
  logoid?: string
}

export interface StockPriceResult {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  ytdChangePercent: number
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

// In-memory cache for live stock quotes (30s TTL)
const priceCache = new Map<string, { timestamp: number; data: StockPriceResult }>()
const CACHE_TTL_MS = 30_000

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase()

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 })
  }

  const now = Date.now()
  const cached = priceCache.get(symbol)
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TradingView = require("@mathieuc/tradingview")
    const client = new TradingView.Client()

    const result = await new Promise<StockPriceResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { client.end() } catch { /* ignore */ }
        reject(new Error("Timeout fetching price for " + symbol))
      }, 12000)

      // Use Quote Session — lighter than Chart, gives real-time price data
      const quote = new client.Session.Quote({ fields: "all" })
      const market = new quote.Market(symbol)

      let resolved = false
      const accumulated: QuoteData = {}

      market.onData((data: QuoteData) => {
        Object.assign(accumulated, data)

        // Wait until we have a last price
        if (!accumulated.lp || resolved) return
        resolved = true
        clearTimeout(timeout)
        try { market.close() } catch { /* ignore */ }
        try { quote.delete() } catch { /* ignore */ }
        try { client.end() } catch { /* ignore */ }

        const rawData = accumulated as Record<string, unknown>
        const perfYtd =
          typeof rawData["Perf.YTD"] === "number"
            ? rawData["Perf.YTD"]
            : typeof rawData["Perf.1Y"] === "number"
            ? rawData["Perf.1Y"]
            : accumulated.chp ?? 0

        resolve({
          symbol,
          name: accumulated.description ?? accumulated.short_name ?? symbol,
          price: accumulated.lp ?? 0,
          change: accumulated.ch ?? 0,
          changePercent: accumulated.chp ?? 0,
          ytdChangePercent: perfYtd,
          high: accumulated.high_price ?? 0,
          low: accumulated.low_price ?? 0,
          open: accumulated.open_price ?? 0,
          prevClose: accumulated.prev_close_price ?? 0,
          volume: accumulated.volume ?? 0,
          currency: accumulated.currency_code ?? "USD",
          exchange: accumulated.exchange ?? "",
          timestamp: Date.now(),
          logoid: accumulated.logoid ?? "",
        })
      })

      market.onError((...args: unknown[]) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        try { client.end() } catch { /* ignore */ }
        reject(new Error("Market error: " + args.join(", ")))
      })
    })

    // Fetch YTD performance from TradingView scanner API in parallel
    let perfYtd = 0
    try {
      const scanRes = await fetch("https://scanner.tradingview.com/global/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: { tickers: [symbol] },
          columns: ["Perf.YTD"],
        }),
      })
      if (scanRes.ok) {
        const scanData = await scanRes.json()
        const val = scanData.data?.[0]?.d?.[0]
        if (typeof val === "number" && !isNaN(val)) {
          perfYtd = val
        }
      }
    } catch {
      /* ignore */
    }

    const finalResult: StockPriceResult = {
      ...result,
      ytdChangePercent: perfYtd !== 0 ? perfYtd : result.changePercent,
    }

    priceCache.set(symbol, { timestamp: now, data: finalResult })

    return NextResponse.json(finalResult, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
