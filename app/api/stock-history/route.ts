import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

interface MonthPoint {
  month: string
  date: string
  close: number
  pct: number
}

// In-memory cache for historical monthly data (5 min TTL)
const historyCache = new Map<string, { timestamp: number; data: MonthPoint[] }>()
const HISTORY_CACHE_TTL_MS = 5 * 60 * 1000

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols")
  if (!symbolsParam) {
    return NextResponse.json({ error: "symbols parameter is required" }, { status: 400 })
  }

  const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
  const now = Date.now()
  const results: Record<string, MonthPoint[]> = {}
  const symbolsToFetch: string[] = []

  for (const sym of symbols) {
    const cached = historyCache.get(sym)
    if (cached && now - cached.timestamp < HISTORY_CACHE_TTL_MS) {
      results[sym] = cached.data
    } else {
      symbolsToFetch.push(sym)
    }
  }

  if (symbolsToFetch.length === 0) {
    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TradingView = require("@mathieuc/tradingview")
    const client = new TradingView.Client()

    for (const symbol of symbolsToFetch) {
      const points = await new Promise<MonthPoint[]>((resolve) => {
        const chart = new client.Session.Chart()
        chart.setMarket(symbol, { timeframe: "1M", range: 12 })

        let done = false
        const timeout = setTimeout(() => {
          if (done) return
          done = true
          try { chart.delete() } catch { /* ignore */ }
          resolve([])
        }, 5000)

        chart.onUpdate(() => {
          if (done || !chart.periods || chart.periods.length === 0) return
          done = true
          clearTimeout(timeout)

          // Filter for current year periods (chronological)
          const currentYear = new Date().getFullYear()
          const periods = chart.periods
            .slice()
            .reverse()
            .filter((p: { time: number }) => new Date(p.time * 1000).getFullYear() === currentYear)

          // Fallback to last 7 months if current year has fewer points
          const targetPeriods =
            periods.length >= 3 ? periods : chart.periods.slice().reverse().slice(-7)

          if (targetPeriods.length === 0) {
            try { chart.delete() } catch { /* ignore */ }
            resolve([])
            return
          }

          const startOpen = targetPeriods[0].open || targetPeriods[0].close || 1

          const pointsList: MonthPoint[] = targetPeriods.map(
            (p: { time: number; close: number }) => {
              const d = new Date(p.time * 1000)
              const month = d.toLocaleString("es-ES", { month: "short" })
              const monthCap = month.charAt(0).toUpperCase() + month.slice(1, 3)
              const date = d.toISOString().slice(0, 7)
              const pct = parseFloat((((p.close - startOpen) / startOpen) * 100).toFixed(2))
              return { month: monthCap, date, close: p.close, pct }
            }
          )

          try { chart.delete() } catch { /* ignore */ }
          resolve(pointsList)
        })
      })

      results[symbol] = points
      if (points.length > 0) {
        historyCache.set(symbol, { timestamp: now, data: points })
      }
    }

    try { client.end() } catch { /* ignore */ }

    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
