import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export interface FearGreedHistoryPoint {
  date: string
  value: number
}

export interface FearGreedData {
  value: number
  classification: string
  classificationEn: string
  previousClose: number
  previousCloseClassification: string
  previousCloseClassificationEn: string
  weekAgo: number
  weekAgoClassification: string
  weekAgoClassificationEn: string
  monthAgo: number
  monthAgoClassification: string
  monthAgoClassificationEn: string
  yearAgo: number
  yearAgoClassification: string
  yearAgoClassificationEn: string
  lastUpdated: string
  history?: FearGreedHistoryPoint[]
}

function classify(value: number): { es: string; en: string } {
  if (value <= 25) return { es: "Miedo Extremo", en: "Extreme Fear" }
  if (value <= 44) return { es: "Miedo", en: "Fear" }
  if (value <= 55) return { es: "Neutral", en: "Neutral" }
  if (value <= 75) return { es: "Codicia", en: "Greed" }
  return { es: "Codicia Extrema", en: "Extreme Greed" }
}

function formatRating(ratingStr: string, score: number): { es: string; en: string } {
  const r = (ratingStr || "").toLowerCase()
  if (r.includes("extreme") && r.includes("fear")) return { es: "Miedo Extremo", en: "Extreme Fear" }
  if (r.includes("extreme") && r.includes("greed")) return { es: "Codicia Extrema", en: "Extreme Greed" }
  if (r.includes("fear")) return { es: "Miedo", en: "Fear" }
  if (r.includes("greed")) return { es: "Codicia", en: "Greed" }
  if (r.includes("neutral")) return { es: "Neutral", en: "Neutral" }
  return classify(score)
}

let cache: { ts: number; data: FearGreedData } | null = null
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

const FALLBACK_DATA: FearGreedData = {
  value: 36,
  classification: "Miedo",
  classificationEn: "Fear",
  previousClose: 36,
  previousCloseClassification: "Miedo",
  previousCloseClassificationEn: "Fear",
  weekAgo: 45,
  weekAgoClassification: "Neutral",
  weekAgoClassificationEn: "Neutral",
  monthAgo: 58,
  monthAgoClassification: "Codicia",
  monthAgoClassificationEn: "Greed",
  yearAgo: 60,
  yearAgoClassification: "Codicia",
  yearAgoClassificationEn: "Greed",
  lastUpdated: new Date().toISOString(),
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    const cnnRes = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Referer: "https://edition.cnn.com/",
        Accept: "application/json",
      },
      cache: "no-store",
    })

    if (!cnnRes.ok) throw new Error(`CNN API status ${cnnRes.status}`)

    const cnnData = await cnnRes.json()
    const fg = cnnData.fear_and_greed

    if (!fg || typeof fg.score !== "number") throw new Error("Invalid CNN response format")

    const current = Math.round(fg.score)
    const prevClose = Math.round(fg.previous_close ?? fg.score)
    const weekAgo = Math.round(fg.previous_1_week ?? fg.score)
    const monthAgo = Math.round(fg.previous_1_month ?? fg.score)
    const yearAgo = Math.round(fg.previous_1_year ?? fg.score)

    const cCur = formatRating(fg.rating, current)
    const cPrev = classify(prevClose)
    const cWeek = classify(weekAgo)
    const cMonth = classify(monthAgo)
    const cYear = classify(yearAgo)

    let history: FearGreedHistoryPoint[] = []
    if (cnnData.fear_and_greed_historical?.data && Array.isArray(cnnData.fear_and_greed_historical.data)) {
      history = cnnData.fear_and_greed_historical.data
        .slice(-90)
        .map((p: { x: number; y: number }) => ({
          date: new Date(p.x).toISOString().split("T")[0],
          value: Math.round(p.y),
        }))
    }

    const data: FearGreedData = {
      value: current,
      classification: cCur.es,
      classificationEn: cCur.en,
      previousClose: prevClose,
      previousCloseClassification: cPrev.es,
      previousCloseClassificationEn: cPrev.en,
      weekAgo,
      weekAgoClassification: cWeek.es,
      weekAgoClassificationEn: cWeek.en,
      monthAgo,
      monthAgoClassification: cMonth.es,
      monthAgoClassificationEn: cMonth.en,
      yearAgo,
      yearAgoClassification: cYear.es,
      yearAgoClassificationEn: cYear.en,
      lastUpdated: fg.timestamp || new Date().toISOString(),
      history,
    }

    cache = { ts: now, data }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(cache ? cache.data : FALLBACK_DATA)
  }
}
