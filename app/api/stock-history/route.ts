import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

interface MonthPoint {
  month: string
  date: string
  close: number
  pct: number
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols")
  if (!symbolsParam) {
    return NextResponse.json({ error: "symbols parameter is required" }, { status: 400 })
  }

  const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TradingView = require("@mathieuc/tradingview")
    const client = new TradingView.Client()

    const results: Record<string, MonthPoint[]> = {}

    for (const symbol of symbols) {
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
