import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export interface LiveMacroEvent {
  id: string
  title: string
  variant: string   // e.g. "Interanual (YoY)", "Trimestral (QoQ)", "Mensual (MoM)"
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
  USD: { label: "EE.UU.", flag: "🇺🇸" },
  EUR: { label: "Eurozona", flag: "🇪🇺" },
  GBP: { label: "Reino Unido", flag: "🇬🇧" },
  JPY: { label: "Japón", flag: "🇯🇵" },
  AUD: { label: "Australia", flag: "🇦🇺" },
  CAD: { label: "Canadá", flag: "🇨🇦" },
  CHF: { label: "Suiza", flag: "🇨🇭" },
  NZD: { label: "Nueva Zelanda", flag: "🇳🇿" },
  CNY: { label: "China", flag: "🇨🇳" },
}

function translateEventTitle(title: string): string {
  if (/CPI/i.test(title)) {
    if (/Core/i.test(title)) return "IPC Subyacente (Inflación Sin Alimentos ni Energía)"
    return "IPC - Índice de Precios al Consumo (Inflación General)"
  }
  if (/PPI/i.test(title)) return "IPP - Índice de Precios de Producción (Inflación Mayorista)"
  if (/Rate|FOMC|Policy Statement|Fed Funds/i.test(title)) return "Decisión de Tipos de Interés y Política Monetaria"
  if (/Non-Farm|Employment|Unemployment/i.test(title)) return "Informe de Empleo (NFP / Desempleo)"
  if (/GDP/i.test(title)) return "PIB - Producto Interior Bruto"
  if (/Retail Sales/i.test(title)) return "Ventas al Por Menor (Consumo)"
  if (/PMI/i.test(title)) return "PMI - Índice de Gestores de Compras"
  if (/Trade Balance/i.test(title)) return "Balanza Comercial"
  if (/Consumer Sentiment|Confidence/i.test(title)) return "Confianza del Consumidor"
  if (/Existing Home|Building|Housing/i.test(title)) return "Mercado Inmobiliario"
  if (/BOE|Bank of England/i.test(title)) return "Decisión del Banco de Inglaterra (BOE)"
  if (/BOJ|Bank of Japan/i.test(title)) return "Decisión del Banco de Japón (BOJ)"
  return title
}

/** Extract variant label from raw ForexFactory title */
function extractVariant(title: string): string {
  if (/y\/y|yoy/i.test(title)) return "Interanual (YoY)"
  if (/q\/q|qoq/i.test(title)) return "Trimestral (QoQ)"
  if (/m\/m|mom/i.test(title)) return "Mensual (MoM)"
  if (/prel/i.test(title)) return "Preliminar"
  return ""
}

/** Sort rank: YoY=0 (best), QoQ=1, neutral=2, MoM=3 (worst) */
function variantRank(title: string): number {
  if (/y\/y|yoy/i.test(title)) return 0
  if (/q\/q|qoq/i.test(title)) return 1
  if (/m\/m|mom/i.test(title)) return 3
  return 2
}

export async function GET() {
  try {
    const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      next: { revalidate: 3600 },
    })

    if (!res.ok) throw new Error(`Calendar API status ${res.status}`)

    const data = await res.json()
    if (!Array.isArray(data)) throw new Error("Invalid calendar payload")

    const now = new Date()
    const todayDay = now.getDate()

    const KEY_EVENTS = [
      /CPI/i, /PPI/i,
      /Non-Farm|NFP/i, /Unemployment/i,
      /Fed Funds|FOMC|Federal Reserve/i,
      /ECB|Interest Rate Decision|Rate Statement|Rate Decision|Monetary Policy/i,
      /GDP/i,
      /Retail Sales/i,
      /BOE|Bank of England/i,
      /BOJ|Bank of Japan/i,
    ]

    const MAIN_COUNTRIES = ["USD", "EUR", "CNY", "JPY", "GBP"]

    const formattedEvents: LiveMacroEvent[] = data
      .filter((evt: { impact?: string; title?: string; country?: string }) => {
        const country = evt.country ?? ""
        if (!MAIN_COUNTRIES.includes(country)) return false
        const minImpact = country === "USD" ? ["High"] : ["High", "Medium"]
        if (!minImpact.includes(evt.impact ?? "")) return false
        return KEY_EVENTS.some((re) => re.test(evt.title ?? ""))
      })
      // Pre-sort: by timestamp first, then prefer YoY > QoQ > neutral > MoM
      .sort((a: { title?: string; date?: string }, b: { title?: string; date?: string }) => {
        const dateDiff = new Date(a.date ?? "").getTime() - new Date(b.date ?? "").getTime()
        if (dateDiff !== 0) return dateDiff
        return variantRank(a.title ?? "") - variantRank(b.title ?? "")
      })
      .map((evt: { title: string; country: string; date: string; impact: string; forecast?: string; previous?: string }, idx: number) => {
        const evtDate = new Date(evt.date)
        const countryInfo = COUNTRY_MAP[evt.country] || { label: evt.country || "Global", flag: "🌐" }

        let dateStr = evtDate.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "short",
        })
        if (evtDate.getDate() === todayDay) dateStr = "HOY"
        else if (evtDate.getDate() === todayDay + 1) dateStr = "MAÑANA"

        const timeStr = evtDate.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }) + " CET"

        const impactVal: "HIGH" | "MEDIUM" = evt.impact === "High" ? "HIGH" : "MEDIUM"

        return {
          id: `macro-live-${idx}-${evtDate.getTime()}`,
          title: `${countryInfo.label}: ${translateEventTitle(evt.title)}`,
          variant: extractVariant(evt.title),
          country: countryInfo.label,
          flag: countryInfo.flag,
          dateStr,
          timeStr,
          timestamp: evtDate.getTime(),
          impact: impactVal,
          forecast: evt.forecast ? `${evt.forecast}` : "Pendiente",
          previous: evt.previous ? `${evt.previous}` : "N/D",
        }
      })
      .sort((a, b) => a.timestamp - b.timestamp)
      // Deduplicate: keep only first per translated title + day (best variant is already first)
      .filter((evt, idx, arr) => {
        const key = `${evt.title}|${evt.dateStr}`
        return arr.findIndex((e) => `${e.title}|${e.dateStr}` === key) === idx
      })
      .slice(0, 9)

    return NextResponse.json({ events: formattedEvents })
  } catch {
    const now = new Date()
    const fallback: LiveMacroEvent[] = [
      {
        id: "fb-1",
        title: "EE.UU.: IPC - Índice de Precios al Consumo (Inflación General)",
        variant: "Interanual (YoY)",
        country: "EE.UU.",
        flag: "🇺🇸",
        dateStr: "HOY",
        timeStr: "14:30 CET",
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
        timeStr: "20:00 CET",
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
        timeStr: "14:15 CET",
        timestamp: now.getTime() + 172800000,
        impact: "HIGH",
        forecast: "3.50%",
        previous: "3.75%",
      },
    ]
    return NextResponse.json({ events: fallback })
  }
}
