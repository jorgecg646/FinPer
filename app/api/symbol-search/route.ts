import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export interface SymbolSearchResult {
  id: string
  symbol: string
  description: string
  exchange: string
  fullExchange: string
  type: string
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim()

  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TradingView = require("@mathieuc/tradingview")

    const results = await TradingView.searchMarketV3(query)

    const mapped: SymbolSearchResult[] = (results as Array<{
      id: string
      symbol: string
      description: string
      exchange: string
      fullExchange: string
      type: string
    }>)
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        symbol: r.id,
        description: r.description,
        exchange: r.exchange,
        fullExchange: r.fullExchange,
        type: r.type,
      }))

    return NextResponse.json(
      { results: mapped },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
        },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message, results: [] }, { status: 500 })
  }
}
