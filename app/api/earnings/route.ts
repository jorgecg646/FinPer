import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export interface EarningsItem {
  symbol: string
  name: string
  nextEarningsDate: string   // formatted Spanish date
  daysUntil: number
  epsEstimate: string        // EPS forecast next quarter
  urgency: "TODAY" | "WEEK" | "MONTH" | "LATER"
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols")?.trim()
  if (!symbolsParam) {
    return NextResponse.json({ earnings: [] })
  }

  // Symbols arrive as plain tickers e.g. "NVDA,MSFT,ITX"
  // The scanner needs exchange-qualified tickers e.g. "NASDAQ:NVDA"
  // We'll try resolving via the symbol-search or pass as-is (scanner auto-resolves many)
  const rawSymbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)

  try {
    const res = await fetch("https://scanner.tradingview.com/global/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbols: { tickers: rawSymbols },
        columns: [
          "earnings_release_next_date",
          "earnings_per_share_forecast_next_fq",
          "name",
          "description",
        ],
      }),
      next: { revalidate: 3600 }, // 1h cache — earnings dates don't change hourly
    })

    if (!res.ok) throw new Error(`Scanner status ${res.status}`)

    const data = await res.json()
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const earnings: EarningsItem[] = []

    for (const row of data.data ?? []) {
      const [nextDateTs, epsEst, ticker, description] = row.d as [number | null, number | null, string, string]
      const symbol = (row.s as string).split(":").pop() ?? row.s

      if (!nextDateTs) continue // no earnings date available

      const earningsDate = new Date(nextDateTs * 1000)
      earningsDate.setHours(0, 0, 0, 0)
      const daysUntil = Math.ceil((earningsDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      if (daysUntil < 0) continue // already past, skip

      const dateStr = earningsDate.toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })

      let urgency: EarningsItem["urgency"] = "LATER"
      if (daysUntil === 0) urgency = "TODAY"
      else if (daysUntil <= 7) urgency = "WEEK"
      else if (daysUntil <= 31) urgency = "MONTH"

      earnings.push({
        symbol,
        name: description || ticker || symbol,
        nextEarningsDate: dateStr,
        daysUntil,
        epsEstimate: epsEst != null ? `${epsEst.toFixed(2)} $/acc.` : "N/D",
        urgency,
      })
    }

    // Sort by soonest first
    earnings.sort((a, b) => a.daysUntil - b.daysUntil)

    return NextResponse.json({ earnings })
  } catch {
    return NextResponse.json({ earnings: [] })
  }
}
