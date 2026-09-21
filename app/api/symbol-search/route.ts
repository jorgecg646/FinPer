import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export interface SymbolSearchResult {
  id: string
  symbol: string
  description: string
  exchange: string
  fullExchange: string
  type: string
  logoid?: string
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim()

  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] })
  }

  // 1. Primary: Direct TradingView Symbol Search v3 (returns rich logos including crypto base logos)
  try {
    const tvRes = await fetch(
      `https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(
        query
      )}&hl=0&lang=es&domain=production`,
      {
        headers: {
          Origin: "https://www.tradingview.com",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        signal: AbortSignal.timeout(5000),
      }
    )

    if (tvRes.ok) {
      const tvData = await tvRes.json()
      if (Array.isArray(tvData.symbols) && tvData.symbols.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: SymbolSearchResult[] = []
        const seenIds = new Set<string>()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const s of tvData.symbols.slice(0, 30)) {
          const cleanSym = (s.symbol || "").replace(/<[^>]+>/g, "").trim()
          if (!cleanSym) continue
          const exch = (s.prefix || s.exchange || "").trim().toUpperCase()
          const id = exch ? `${exch}:${cleanSym}` : cleanSym
          if (seenIds.has(id)) continue
          seenIds.add(id)

          const description = (s.description || cleanSym).replace(/<[^>]+>/g, "").trim()
          const rawLogo =
            s.logo?.logoid ||
            s["base-currency-logoid"] ||
            s["currency-logoid"] ||
            s.logoid ||
            ""

          mapped.push({
            id,
            symbol: cleanSym,
            description,
            exchange: s.exchange || s.prefix || "",
            fullExchange: s.source2?.name || s.exchange || "",
            type: s.type || "",
            logoid: typeof rawLogo === "string" ? rawLogo : "",
          })
          if (mapped.length >= 25) break
        }

        return NextResponse.json(
          { results: mapped },
          {
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            },
          }
        )
      }
    }
  } catch {
    /* fallback below */
  }

  // 2. Fallback: @mathieuc/tradingview
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
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message, results: [] }, { status: 500 })
  }
}
