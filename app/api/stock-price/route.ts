import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    })
  }

  // 1. Primary fast method: TradingView Global Scanner HTTP API (Thread-safe, 0 WebSocket race conditions)
  try {
    const scanRes = await fetch("https://scanner.tradingview.com/global/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      body: JSON.stringify({
        symbols: { tickers: [symbol] },
        columns: [
          "close",
          "change_abs",
          "change",
          "Perf.YTD",
          "high",
          "low",
          "open",
          "volume",
          "description",
          "currency",
          "exchange",
          "logoid",
        ],
      }),
      signal: AbortSignal.timeout(6000),
    })

    if (scanRes.ok) {
      const scanData = await scanRes.json()
      const row = scanData.data?.[0]

      if (row && Array.isArray(row.d) && typeof row.d[0] === "number" && !isNaN(row.d[0])) {
        const [
          close,
          changeAbs,
          changePct,
          perfYtd,
          high,
          low,
          open,
          volume,
          description,
          currency,
          exchange,
          logoid,
        ] = row.d

        const price = Number(close)
        const change = typeof changeAbs === "number" ? Number(changeAbs) : 0
        const changePercent = typeof changePct === "number" ? Number(changePct) : 0
        const prevClose = price - change

        const result: StockPriceResult = {
          symbol,
          name: typeof description === "string" && description ? description : symbol,
          price,
          change,
          changePercent,
          ytdChangePercent: typeof perfYtd === "number" && !isNaN(perfYtd) ? Number(perfYtd) : changePercent,
          high: typeof high === "number" ? high : price,
          low: typeof low === "number" ? low : price,
          open: typeof open === "number" ? open : prevClose,
          prevClose,
          volume: typeof volume === "number" ? volume : 0,
          currency: typeof currency === "string" && currency ? currency.toUpperCase() : "USD",
          exchange: typeof exchange === "string" ? exchange : symbol.split(":")[0] || "",
          timestamp: now,
          logoid: typeof logoid === "string" ? logoid : "",
        }

        priceCache.set(symbol, { timestamp: now, data: result })

        return NextResponse.json(result, {
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
        })
      }
    }
  } catch {
    // fallback to secondary method below
  }

  // 2. Secondary Fallback: Isolated Quote Session
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TradingView = require("@mathieuc/tradingview")
    const client = new TradingView.Client()

    const result = await new Promise<StockPriceResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { client.end() } catch { /* ignore */ }
        reject(new Error("Timeout fetching price for " + symbol))
      }, 10000)

      const quote = new client.Session.Quote({ fields: "all" })
      const market = new quote.Market(symbol)

      let resolved = false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accumulated: Record<string, any> = {}

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      market.onData((data: any) => {
        Object.assign(accumulated, data)

        // Ensure the packet belongs to this market and has price
        if (!accumulated.lp || resolved) return
        resolved = true
        clearTimeout(timeout)
        try { market.close() } catch { /* ignore */ }
        try { quote.delete() } catch { /* ignore */ }
        try { client.end() } catch { /* ignore */ }

        const price = accumulated.lp ?? 0
        const change = accumulated.ch ?? 0
        const changePercent = accumulated.chp ?? 0
        const prevClose = accumulated.prev_close_price ?? price - change

        resolve({
          symbol,
          name: accumulated.description ?? accumulated.short_name ?? symbol,
          price,
          change,
          changePercent,
          ytdChangePercent: accumulated["Perf.YTD"] ?? accumulated["Perf.1Y"] ?? changePercent,
          high: accumulated.high_price ?? price,
          low: accumulated.low_price ?? price,
          open: accumulated.open_price ?? prevClose,
          prevClose,
          volume: accumulated.volume ?? 0,
          currency: accumulated.currency_code ?? "USD",
          exchange: accumulated.exchange ?? "",
          timestamp: Date.now(),
          logoid: accumulated.logoid ?? "",
        })
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      market.onError((...args: any[]) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        try { client.end() } catch { /* ignore */ }
        reject(new Error("Market error: " + args.join(", ")))
      })
    })

    priceCache.set(symbol, { timestamp: now, data: result })

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
