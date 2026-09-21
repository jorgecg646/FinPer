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

function resolveTradingViewLogoId(
  symbol: string,
  logoid?: string | null,
  baseCurrencyLogoid?: string | null
): string {
  if (typeof logoid === "string" && logoid.trim()) return logoid.trim()
  if (typeof baseCurrencyLogoid === "string" && baseCurrencyLogoid.trim()) return baseCurrencyLogoid.trim()

  const sym = symbol.toUpperCase()
  // Crypto fallback mappings for TradingView SVG logos
  const cryptoMatch = sym.match(/(?:BINANCE:|CRYPTO:|COINBASE:|BITSTAMP:|OKX:|BYBIT:|KRAKEN:)?([A-Z0-9]+)(?:USDT|USD|EUR|BTC|ETH)?$/)
  const base = cryptoMatch ? cryptoMatch[1] : ""
  if (base && ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK", "NEAR", "SUI", "PEPE", "SHIB", "TRX", "LTC", "BCH", "UNI", "MATIC", "POL", "APT", "RENDER", "ICP", "FET", "FIL", "ATOM", "XLM", "MONERO", "XMR", "KAS", "TON"].includes(base)) {
    return `crypto/XTVC${base}`
  }
  return ""
}

// Helper to fetch fallback via isolated quote session
async function fetchFallbackQuote(symbol: string): Promise<StockPriceResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TradingView = require("@mathieuc/tradingview")
  const client = new TradingView.Client()

  return new Promise<StockPriceResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      try { client.end() } catch { /* ignore */ }
      reject(new Error("Timeout fetching price for " + symbol))
    }, 8000)

    const quote = new client.Session.Quote({ fields: "all" })
    const market = new quote.Market(symbol)

    let resolved = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accumulated: Record<string, any> = {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    market.onData((data: any) => {
      Object.assign(accumulated, data)

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
      const finalLogoId = resolveTradingViewLogoId(
        symbol,
        accumulated.logoid,
        accumulated.base_currency_logoid || accumulated["base-currency-logoid"]
      )

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
        logoid: finalLogoId,
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
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols")?.trim()
  const singleSymbolParam = req.nextUrl.searchParams.get("symbol")?.trim()

  if (!symbolsParam && !singleSymbolParam) {
    return NextResponse.json({ error: "symbol or symbols is required" }, { status: 400 })
  }

  const isBatch = Boolean(symbolsParam)
  const symbols = isBatch
    ? symbolsParam!.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : [singleSymbolParam!.toUpperCase()]

  if (symbols.length === 0) {
    return NextResponse.json(isBatch ? {} : { error: "No valid symbol provided" }, {
      status: isBatch ? 200 : 400,
    })
  }

  const now = Date.now()
  const results: Record<string, StockPriceResult> = {}
  const symbolsToFetch: string[] = []

  for (const sym of symbols) {
    const cached = priceCache.get(sym)
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      results[sym] = cached.data
    } else {
      symbolsToFetch.push(sym)
    }
  }

  // If everything was in cache, return immediately
  if (symbolsToFetch.length === 0) {
    return NextResponse.json(isBatch ? results : results[symbols[0]], {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    })
  }

  // 1. Primary method: TradingView Global Scanner HTTP API (supports multiple tickers at once)
  try {
    const scanRes = await fetch("https://scanner.tradingview.com/global/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      body: JSON.stringify({
        symbols: { tickers: symbolsToFetch },
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
          "base_currency_logoid",
        ],
      }),
      signal: AbortSignal.timeout(6000),
    })

    if (scanRes.ok) {
      const scanData = await scanRes.json()
      for (const row of scanData.data ?? []) {
        if (row && Array.isArray(row.d) && typeof row.d[0] === "number" && !isNaN(row.d[0])) {
          const rawSymbol = String(row.s || "")
          const matchedSymbol = symbolsToFetch.find((s) => s.toUpperCase() === rawSymbol.toUpperCase()) || rawSymbol

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
            baseCurrencyLogoid,
          ] = row.d

          const price = Number(close)
          const change = typeof changeAbs === "number" ? Number(changeAbs) : 0
          const changePercent = typeof changePct === "number" ? Number(changePct) : 0
          const prevClose = price - change
          const finalLogoId = resolveTradingViewLogoId(matchedSymbol, logoid, baseCurrencyLogoid)

          const result: StockPriceResult = {
            symbol: matchedSymbol,
            name: typeof description === "string" && description ? description : matchedSymbol,
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
            exchange: typeof exchange === "string" ? exchange : matchedSymbol.split(":")[0] || "",
            timestamp: now,
            logoid: finalLogoId,
          }

          priceCache.set(matchedSymbol, { timestamp: now, data: result })
          results[matchedSymbol] = result
        }
      }
    }
  } catch {
    // Continue to fallback check below
  }

  // 2. Secondary fallback for any symbols not resolved by Scanner
  const missing = symbolsToFetch.filter((sym) => !results[sym])
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (sym) => {
        // First check if stale cache exists
        const stale = priceCache.get(sym)
        if (stale) {
          results[sym] = stale.data
          return
        }

        try {
          const fallbackData = await fetchFallbackQuote(sym)
          priceCache.set(sym, { timestamp: Date.now(), data: fallbackData })
          results[sym] = fallbackData
        } catch {
          // If fallback fails, leave out or provide minimum empty quote
        }
      })
    )
  }

  if (!isBatch) {
    const single = results[symbols[0]]
    if (!single) {
      return NextResponse.json({ error: "Could not fetch quote for " + symbols[0] }, { status: 502 })
    }
    return NextResponse.json(single, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    })
  }

  return NextResponse.json(results, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
  })
}
