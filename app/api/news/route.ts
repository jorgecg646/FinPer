import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export interface NewsItem {
  id: string
  title: string
  source: string
  category: "📊 MACRO / IPC" | "🇺🇸 USA" | "🌏 ASIA" | "🥇 ORO" | "FED/BCE" | "🪙 CRIPTO" | "🇪🇺 EUROPA" | "EMPRESAS" | "MERCADOS"
  timeAgo: string
  url: string
}

function cleanNewsTitle(title: string): string {
  return title
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/ - [^-]+$/, "") // remove trailing source name
    .replace(/^De cara a hoy:\s*/i, "")
    .replace(/^a hoy:\s*/i, "")
    .replace(/^Claves:\s*/i, "")
    .replace(/^Agenda:\s*/i, "")
    .trim()
}

export async function GET() {
  try {
    const now = Date.now()

    // 100% Dynamic live RSS queries for Macro, USA, Asia, Gold, Fed/BCE, Crypto
    const macroQuery = encodeURIComponent("IPC USA OR IPC EEUU OR inflacion OR Reserva Federal when:1d")
    const marketQuery = encodeURIComponent("bolsa USA OR Wall Street OR Nikkei Asia OR cotizacion Oro Gold when:1d")
    const cryptoQuery = encodeURIComponent("Bitcoin OR Cripto OR Mercado Bursatil when:1d")

    const [resMacro, resMarket, resCrypto] = await Promise.all([
      fetch(`https://news.google.com/rss/search?q=${macroQuery}&hl=es&gl=ES&ceid=ES:es`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 120 },
      }).catch(() => null),
      fetch(`https://news.google.com/rss/search?q=${marketQuery}&hl=es&gl=ES&ceid=ES:es`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 120 },
      }).catch(() => null),
      fetch(`https://news.google.com/rss/search?q=${cryptoQuery}&hl=es&gl=ES&ceid=ES:es`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 120 },
      }).catch(() => null),
    ])

    const fetchedItems: NewsItem[] = []

    function parseXmlFeed(xmlText: string) {
      const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>/g
      let match: RegExpExecArray | null

      let count = 0
      while ((match = itemRegex.exec(xmlText)) !== null && count < 8) {
        const rawTitle = match[1]
        const link = match[2].trim()
        const pubDateStr = match[3] ? match[3].trim() : ""

        let timeAgo = "últimas 24h"
        if (pubDateStr) {
          const pubTime = new Date(pubDateStr).getTime()
          if (!isNaN(pubTime)) {
            const hoursDiff = (now - pubTime) / (1000 * 60 * 60)
            if (hoursDiff > 24) {
              continue // Discard anything older than 24 hours
            }

            const minsDiff = Math.max(1, Math.floor((now - pubTime) / (1000 * 60)))
            if (minsDiff < 60) {
              timeAgo = `hace ${minsDiff} min`
            } else {
              const hrs = Math.floor(minsDiff / 60)
              timeAgo = `hace ${hrs}h`
            }
          }
        }

        const title = cleanNewsTitle(rawTitle)
        if (title.length < 15) continue

        let category: NewsItem["category"] = "MERCADOS"
        const lower = title.toLowerCase()

        if (
          lower.includes("ipc") ||
          lower.includes("cpi") ||
          lower.includes("inflación") ||
          lower.includes("inflacion") ||
          lower.includes("empleo") ||
          lower.includes("nfp") ||
          lower.includes("pib")
        ) {
          category = "📊 MACRO / IPC"
        } else if (lower.includes("oro") || lower.includes("gold") || lower.includes("plata") || lower.includes("xau")) {
          category = "🥇 ORO"
        } else if (
          lower.includes("asia") ||
          lower.includes("nikkei") ||
          lower.includes("tokio") ||
          lower.includes("china") ||
          lower.includes("hang seng") ||
          lower.includes("japón")
        ) {
          category = "🌏 ASIA"
        } else if (
          lower.includes("usa") ||
          lower.includes("eeuu") ||
          lower.includes("wall street") ||
          lower.includes("s&p") ||
          lower.includes("nasdaq") ||
          lower.includes("dow jones")
        ) {
          category = "🇺🇸 USA"
        } else if (lower.includes("fed") || lower.includes("bce") || lower.includes("tipo")) {
          category = "FED/BCE"
        } else if (lower.includes("bitcoin") || lower.includes("cripto") || lower.includes("ethereum")) {
          category = "🪙 CRIPTO"
        }

        fetchedItems.push({
          id: `live-news-${fetchedItems.length}-${now}`,
          title,
          source: "En Directo",
          category,
          timeAgo,
          url: link,
        })
        count++
      }
    }

    if (resMacro && resMacro.ok) {
      const xmlMacro = await resMacro.text()
      parseXmlFeed(xmlMacro)
    }

    if (resMarket && resMarket.ok) {
      const xmlMarket = await resMarket.text()
      parseXmlFeed(xmlMarket)
    }

    if (resCrypto && resCrypto.ok) {
      const xmlCrypto = await resCrypto.text()
      parseXmlFeed(xmlCrypto)
    }

    // Deduplicate items by title
    const uniqueNews = fetchedItems.filter(
      (item, index, self) => index === self.findIndex((t) => t.title === item.title)
    )

    return NextResponse.json({ news: uniqueNews })
  } catch {
    return NextResponse.json({ news: [] })
  }
}
