import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export interface LiveMacroEvent {
  id: string
  title: string
  variant: string // e.g. "Interanual (YoY)", "Trimestral (QoQ)", "Mensual (MoM)"
  country: string
  flag: string
  dateStr: string
  timeStr: string
  timestamp: number
  impact: "HIGH" | "MEDIUM"
  forecast: string
  previous: string
}

const COUNTRY_MAP: Record<string, { label: string; flag: string }> = {
  US: { label: "EE.UU.", flag: "🇺🇸" },
  EU: { label: "Eurozona", flag: "🇪🇺" },
  GB: { label: "Reino Unido", flag: "🇬🇧" },
  JP: { label: "Japón", flag: "🇯🇵" },
  CN: { label: "China", flag: "🇨🇳" },
}

function translateEventTitle(title: string): string {
  const clean = title.replace(/\s+(YoY|MoM|QoQ|s\.a|Prelim|Prel)$/i, "").trim()

  if (/Core Inflation/i.test(clean)) return "IPC Subyacente (Inflación Sin Alimentos ni Energía)"
  if (/Inflation Rate/i.test(clean)) return "IPC - Índice de Precios al Consumo (Inflación General)"
  if (/PPI|Producer Prices/i.test(clean)) return "IPP - Índice de Precios de Producción (Inflación Mayorista)"
  if (/GDP/i.test(clean)) return "PIB - Producto Interior Bruto"
  if (/Retail Sales/i.test(clean)) return "Ventas al Por Menor (Consumo)"
  if (/Interest Rate/i.test(clean)) return "Decisión de Tipos de Interés y Política Monetaria"
  if (/Non Farm|Unemployment/i.test(clean)) return "Informe de Empleo (NFP / Desempleo)"
  if (/PMI/i.test(clean)) return "PMI - Índice de Gestores de Compras"
  if (/Trade Balance/i.test(clean)) return "Balanza Comercial"
  if (/Consumer Sentiment|Confidence/i.test(clean)) return "Confianza del Consumidor"

  return clean
}

function extractVariant(title: string): string {
  if (/YoY/i.test(title)) return "Interanual (YoY)"
  if (/QoQ/i.test(title)) return "Trimestral (QoQ)"
  if (/MoM/i.test(title)) return "Mensual (MoM)"
  if (/Prelim|Prel/i.test(title)) return "Preliminar"
  return ""
}

function variantRank(title: string): number {
  if (/YoY/i.test(title)) return 0
  if (/QoQ/i.test(title)) return 1
  if (/MoM/i.test(title)) return 3
  return 2
}

export async function GET() {
  try {
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - 1)
    const to = new Date(now)
    to.setDate(to.getDate() + 7)

    // Query TradingView Official Economic Calendar Endpoint
    const res = await fetch("https://economic-calendar.tradingview.com/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Origin: "https://www.tradingview.com",
        Referer: "https://www.tradingview.com/economic-calendar/",
      },
      body: JSON.stringify({
        from: from.toISOString().split("T")[0] + "T00:00:00Z",
        to: to.toISOString().split("T")[0] + "T23:59:59Z",
        countries: ["US", "EU", "CN", "JP", "GB"],
      }),
      cache: "no-store",
    })

    if (!res.ok) throw new Error(`TradingView calendar API status ${res.status}`)

    const payload = await res.json()
    const rawEvents: Array<{
      id: string
      title: string
      country: string
      importance: number
      date: string
      forecast: number | null
      previous: number | null
      unit?: string
    }> = payload.result || []

    const targetCountries = ["US", "EU", "CN", "JP", "GB"]

    // Filter by target countries and importance (1 = High, 0 = Medium)
    const filteredRaw = rawEvents.filter((e) => {
      if (!targetCountries.includes(e.country)) return false
      const minImp = e.country === "US" ? 1 : 0
      return e.importance >= minImp
    })

    // Sort by date first, then prefer YoY > QoQ > neutral > MoM
    filteredRaw.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (dateDiff !== 0) return dateDiff
      return variantRank(a.title) - variantRank(b.title)
    })

    function getSpanishDateStr(evtDate: Date, now: Date): string {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Madrid",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      })

      const [evtM, evtD, evtY] = formatter.format(evtDate).split("/").map(Number)
      const [nowM, nowD, nowY] = formatter.format(now).split("/").map(Number)

      const dEvt = Date.UTC(evtY, evtM - 1, evtD)
      const dNow = Date.UTC(nowY, nowM - 1, nowD)
      const diffDays = Math.round((dEvt - dNow) / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return "HOY"
      if (diffDays === 1) return "MAÑANA"
      if (diffDays === -1) return "AYER"

      const rawStr = evtDate.toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Europe/Madrid",
      })
      return rawStr.charAt(0).toUpperCase() + rawStr.slice(1)
    }

    function getTimeZoneSuffix(d: Date): string {
      const month = d.getMonth()
      return month >= 3 && month <= 9 ? "CEST" : "CET"
    }

    const formattedEvents: LiveMacroEvent[] = filteredRaw.map((e, idx) => {
      const c = COUNTRY_MAP[e.country] || { label: e.country, flag: "🌐" }
      const evtDate = new Date(e.date)
      const dateStr = getSpanishDateStr(evtDate, now)
      const tzSuffix = getTimeZoneSuffix(evtDate)

      const timeStr =
        evtDate.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Madrid",
        }) + ` ${tzSuffix}`

      const unit = e.unit || "%"
      const forecast = e.forecast != null ? `${e.forecast}${unit}` : "Pendiente"
      const previous = e.previous != null ? `${e.previous}${unit}` : "N/D"

      return {
        id: `tv-${e.id || idx}-${evtDate.getTime()}`,
        title: `${c.label}: ${translateEventTitle(e.title)}`,
        variant: extractVariant(e.title),
        country: c.label,
        flag: c.flag,
        dateStr,
        timeStr,
        timestamp: evtDate.getTime(),
        impact: e.importance === 1 ? "HIGH" : "MEDIUM",
        forecast,
        previous,
      }
    })

    // Deduplicate: keep only first per translated title + day
    const deduplicated = formattedEvents
      .filter((evt, idx, arr) => {
        const key = `${evt.title}|${evt.dateStr}`
        return arr.findIndex((item) => `${item.title}|${item.dateStr}` === key) === idx
      })
      .slice(0, 9)

    return NextResponse.json({ events: deduplicated })
  } catch {
    const now = new Date()
    const tz = now.getMonth() >= 3 && now.getMonth() <= 9 ? "CEST" : "CET"
    const fallback: LiveMacroEvent[] = [
      {
        id: "fb-1",
        title: "EE.UU.: IPC - Índice de Precios al Consumo (Inflación General)",
        variant: "Interanual (YoY)",
        country: "EE.UU.",
        flag: "🇺🇸",
        dateStr: "HOY",
        timeStr: `14:30 ${tz}`,
        timestamp: now.getTime(),
        impact: "HIGH",
        forecast: "3.4%",
        previous: "3.5%",
      },
      {
        id: "fb-2",
        title: "EE.UU.: Decisión de Tipos de Interés y Política Monetaria",
        variant: "",
        country: "EE.UU.",
        flag: "🇺🇸",
        dateStr: "Próximos días",
        timeStr: `20:00 ${tz}`,
        timestamp: now.getTime() + 86400000,
        impact: "HIGH",
        forecast: "5.25%",
        previous: "5.50%",
      },
      {
        id: "fb-3",
        title: "Eurozona: Decisión de Tipos de Interés y Política Monetaria",
        variant: "",
        country: "Eurozona",
        flag: "🇪🇺",
        dateStr: "Esta semana",
        timeStr: `14:15 ${tz}`,
        timestamp: now.getTime() + 172800000,
        impact: "HIGH",
        forecast: "3.50%",
        previous: "3.75%",
      },
    ]
    return NextResponse.json({ events: fallback })
  }
}
