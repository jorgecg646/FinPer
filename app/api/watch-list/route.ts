import { NextRequest, NextResponse } from "next/server"
import { fetchStockQuotesServer } from "../stock-price/route"
import { getStockPositions } from "@/app/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Default symbols from TradingView watchlist (without G2X)
export const DEFAULT_WATCHLIST_SYMBOLS: string[] = [
  "TVC:SPX",
  "NASDAQ:NDX",
  "TVC:IBEX35",
  "XETR:VUAA",
  "XETR:SXRV",
  "XETR:SEC0",
  "NYSE:BRK.B",
  "NYSE:GEV",
  "NYSE:JPM",
  "NASDAQ:MSFT",
  "NASDAQ:TSLA",
  "NASDAQ:AAPL",
  "NASDAQ:GOOGL",
  "NASDAQ:META",
  "NASDAQ:AMZN",
  "NASDAQ:NVDA",
  "BITSTAMP:BTCUSD",
  "BITSTAMP:ETHUSD",
  "COINBASE:SOLUSD",
  "FX:EURUSD",
  "FX:GBPUSD",
  "TVC:GOLD",
  "TVC:SILVER",
  "TVC:USOIL",
  "TVC:US10Y",
]

/**
 * GET /api/watch-list
 * Fetches default watchlist + user's portfolio stocks cleanly without URL query parameters.
 * Appears in terminal logs simply as: GET /api/watch-list 200
 */
export async function GET() {
  try {
    let portfolioSymbols: string[] = []
    try {
      const positions = await getStockPositions()
      portfolioSymbols = positions.map((p) => p.symbol.trim().toUpperCase()).filter(Boolean)
    } catch {
      // In case session or user lookup is not yet active
    }

    const allSymbols = Array.from(new Set([...DEFAULT_WATCHLIST_SYMBOLS, ...portfolioSymbols]))
    const quotes = await fetchStockQuotesServer(allSymbols)

    return NextResponse.json(quotes, {
      headers: {
        "Cache-Control": "private, max-age=2, stale-while-revalidate=5",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching watchlist quotes" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/watch-list
 * Allows fetching custom user-added symbols without putting them in the URL query string.
 * Appears in terminal logs simply as: POST /api/watch-list 200
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const extraSymbols: string[] = Array.isArray(body?.symbols) ? body.symbols : []

    let portfolioSymbols: string[] = []
    try {
      const positions = await getStockPositions()
      portfolioSymbols = positions.map((p) => p.symbol.trim().toUpperCase()).filter(Boolean)
    } catch {}

    const allSymbols = Array.from(
      new Set([
        ...DEFAULT_WATCHLIST_SYMBOLS,
        ...portfolioSymbols,
        ...extraSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean),
      ])
    )

    const quotes = await fetchStockQuotesServer(allSymbols)

    return NextResponse.json(quotes, {
      headers: {
        "Cache-Control": "private, max-age=2, stale-while-revalidate=5",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching watchlist quotes" },
      { status: 500 }
    )
  }
}
