import { NextRequest, NextResponse } from "next/server"

// Force Node.js runtime — @mathieuc/tradingview requires WebSockets (not available in Edge)
export const runtime = "nodejs"

interface QuoteData {
  /** Last price */
  lp?: number
  /** Change */
  ch?: number
  /** Change percent */
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
  /** Logo identifier — used to build https://s3-symbol-logo.tradingview.com/{logoid}--big.svg */
  logoid?: string
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase()

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TradingView = require("@mathieuc/tradingview")
    const client = new TradingView.Client()

    const result = await new Promise<{
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
    }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { client.end() } catch { /* ignore */ }
        reject(new Error("Timeout fetching price for " + symbol))
      }, 12000)

      // Use Quote Session — lighter than Chart, gives real-time price data
      const quote = new client.Session.Quote({ fields: "all" })
      const market = new quote.Market(symbol)

      let resolved = false

      market.onData((data: QuoteData) => {
        // Wait until we have a last price
        if (!data.lp || resolved) return
        resolved = true
        clearTimeout(timeout)
        try { market.close() } catch { /* ignore */ }
        try { quote.delete() } catch { /* ignore */ }
        try { client.end() } catch { /* ignore */ }

        const rawData = data as Record<string, unknown>
        const perfYtd =
          typeof rawData["Perf.YTD"] === "number"
            ? rawData["Perf.YTD"]
            : typeof rawData["Perf.1Y"] === "number"
            ? rawData["Perf.1Y"]
            : data.chp ?? 0

        resolve({
          symbol,
          name: data.description ?? data.short_name ?? symbol,
          price: data.lp ?? 0,
          change: data.ch ?? 0,
          changePercent: data.chp ?? 0,
          ytdChangePercent: perfYtd,
          high: data.high_price ?? 0,
          low: data.low_price ?? 0,
          open: data.open_price ?? 0,
          prevClose: data.prev_close_price ?? 0,
          volume: data.volume ?? 0,
          currency: data.currency_code ?? "USD",
          exchange: data.exchange ?? "",
          timestamp: Date.now(),
          logoid: data.logoid ?? "",
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

    const finalResult = {
      ...result,
      ytdChangePercent: perfYtd !== 0 ? perfYtd : result.changePercent,
    }

    return NextResponse.json(finalResult, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

