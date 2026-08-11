import { NextRequest, NextResponse } from "next/server"

// Force Node.js runtime
export const runtime = "nodejs"

/**
 * GET /api/fx-rate?from=USD&to=EUR
 * Returns the conversion rate: 1 {from} = {rate} {to}
 * Uses TradingView FX_IDC namespace which covers all major currency pairs.
 */
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from")?.toUpperCase()?.trim()
  const to = req.nextUrl.searchParams.get("to")?.toUpperCase()?.trim()

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 })
  }

  if (from === to) {
    return NextResponse.json({ rate: 1, from, to })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TradingView = require("@mathieuc/tradingview")
    const client = new TradingView.Client()

    // Try FX_IDC:{FROM}{TO} — TradingView interbank data covers most major pairs
    const symbol = `FX_IDC:${from}${to}`

    const rate = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { client.end() } catch { /* ignore */ }
        reject(new Error(`Timeout fetching FX rate ${symbol}`))
      }, 12000)

      const quote = new client.Session.Quote({ fields: "all" })
      const market = new quote.Market(symbol)
      let resolved = false

      market.onData((data: { lp?: number }) => {
        if (!data.lp || resolved) return
        resolved = true
        clearTimeout(timeout)
        try { market.close() } catch { /* ignore */ }
        try { quote.delete() } catch { /* ignore */ }
        try { client.end() } catch { /* ignore */ }
        resolve(data.lp)
      })

      market.onError((...args: unknown[]) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        try { client.end() } catch { /* ignore */ }
        reject(new Error("FX market error: " + args.join(", ")))
      })
    })

    return NextResponse.json(
      { rate, from, to },
      {
        headers: {
          // Cache for 5 minutes — FX rates don't need to be real-time for P&L display
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
        },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    // Return rate=1 as fallback so the UI degrades gracefully
    return NextResponse.json({ rate: 1, from, to, error: message })
  }
}
