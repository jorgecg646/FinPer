import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export interface NewsItem {
  id: string
  title: string
  source: string
  category: "📊 MACRO / IPC" | "🇺🇸 USA" | "🌏 ASIA" | "🥇 ORO" | "FED/BCE" | "🪙 CRIPTO" | "🇪🇺 EUROPA" | "EMPRESAS" | "MERCADOS" | "🛢️ COMMODITIES"
  timeAgo: string
  url: string
  pubTime: number
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

function isSpamOrLowQualityTitle(title: string): boolean {
  const lower = title.toLowerCase()

  // Filter out raw data dumps, watch/ad promotions, clickbait & SEO spam templates
  if (
    lower.includes("|precio:") ||
    lower.includes("variación %:") ||
    lower.includes("variacion %:") ||
    lower.includes("precio de acciones, noticias, cotización") ||
    lower.includes("cotización e historial") ||
    lower.includes("a cuánto cotiza este") ||
    lower.includes("a cuanto cotiza este") ||
    lower.includes("moonswatch") ||
    lower.includes("apolo 11") ||
    lower.includes("gemstone") ||
    lower.includes("lanza la aplicación") ||
    lower.includes("lanza la aplicacion") ||
    lower.includes("merecen atención") ||
    lower.includes("merecen un análisis") ||
    lower.includes("análisis de mercados 13 de agosto") ||
    lower.includes("claves y agenda económica del día")
  ) {
    return true
  }

  // Reject raw ticker dumps with multiple pipes e.g. "XAUUSD|Oro|Precio..."
  if ((title.match(/\|/g) || []).length >= 2) {
    return true
  }

  return false
}

function isFinancialTitle(title: string): boolean {
  const lower = title.toLowerCase()

  // Non-financial topics to reject immediately
  const rejectWords = [
    "muere", "fallece", "monje", "iglesia", "religión", "religioso", "océano", "oceano",
    "lengua de metal", "submarino", "volcán", "volcan", "terremoto", "fútbol", "futbol",
    "partido", "liga", "champions", "programa de graduados", "beca", "oferta de empleo",
    "curiosidades", "ciencia", "descubren", "descubrimiento", "fantasía", "película"
  ]

  for (const word of rejectWords) {
    if (lower.includes(word)) return false
  }

  // Must contain at least one economic/financial indicator
  const financialKeywords = [
    "bolsa", "acciones", "mercado", "cotización", "cotizacion", "precio", "dólar", "dolar",
    "euro", "yen", "yuan", "ipc", "cpi", "inflación", "inflacion", "pib", "fed", "bce",
    "tipos", "interés", "interes", "oro", "gold", "petróleo", "petroleo", "crudo", "wall street",
    "nasdaq", "s&p", "ibex", "dax", "nikkei", "hang seng", "inversión", "inversion", "inversores",
    "banca", "banco", "empresa", "resultados", "beneficio", "ingresos", "arancel", "deuda",
    "bonos", "cripto", "bitcoin", "ethereum", "tecnológicas", "tecnologicas", "ia", "semiconductores"
  ]

  return financialKeywords.some((kw) => lower.includes(kw))
}

export async function GET() {
  try {
    const now = Date.now()

    // Strictly financial live RSS queries for Europa, Asia, USA, Gold, Commodities, Crypto (last 12 hours)
    const europeQuery = encodeURIComponent("Bolsa Europa OR Ibex 35 OR BCE Eurozona OR Dax Alemania when:12h")
    const asiaQuery = encodeURIComponent("Bolsa Nikkei OR Bolsa China OR economia Japon OR mercado Yen OR acciones Asia when:12h")
    const usaQuery = encodeURIComponent("Wall Street OR Nasdaq OR SP500 OR Fed inflacion when:12h")
    const goldQuery = encodeURIComponent("precio Oro OR cotizacion Oro Gold XAUUSD when:12h")
    const commoditiesQuery = encodeURIComponent("cotizacion Plata OR Petroleo Brent OR Gas Natural OR precio Cobre OR Litio when:12h")
    const cryptoQuery = encodeURIComponent("cotizacion Bitcoin OR cotizacion Cripto OR Ethereum when:12h")

    const [resEurope, resAsia, resUsa, resGold, resCommodities, resCrypto] = await Promise.all([
      fetch(`https://news.google.com/rss/search?q=${europeQuery}&hl=es&gl=ES&ceid=ES:es`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://news.google.com/rss/search?q=${asiaQuery}&hl=es&gl=ES&ceid=ES:es`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://news.google.com/rss/search?q=${usaQuery}&hl=es&gl=ES&ceid=ES:es`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://news.google.com/rss/search?q=${goldQuery}&hl=es&gl=ES&ceid=ES:es`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://news.google.com/rss/search?q=${commoditiesQuery}&hl=es&gl=ES&ceid=ES:es`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://news.google.com/rss/search?q=${cryptoQuery}&hl=es&gl=ES&ceid=ES:es`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        cache: "no-store",
      }).catch(() => null),
    ])

    const fetchedItems: NewsItem[] = []

    function parseXmlFeed(xmlText: string, defaultCategory: NewsItem["category"] = "MERCADOS") {
      const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>/g
      let match: RegExpExecArray | null

      let count = 0
      while ((match = itemRegex.exec(xmlText)) !== null && count < 12) {
        const rawTitle = match[1]
        const link = match[2].trim()
        const pubDateStr = match[3] ? match[3].trim() : ""

        let timeAgo = "últimas 12h"
        let pubTime = now
        if (pubDateStr) {
          const parsedTime = new Date(pubDateStr).getTime()
          if (!isNaN(parsedTime)) {
            pubTime = parsedTime
            const diffMs = now - pubTime
            const hoursDiff = diffMs / (1000 * 60 * 60)

            if (hoursDiff > 12 || hoursDiff < -2) {
              continue // Discard anything older than 12 hours
            }

            const pubDateObj = new Date(pubTime)
            const formattedTime = pubDateObj.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Madrid",
            })

            const minsDiff = Math.max(1, Math.floor(Math.abs(diffMs) / (1000 * 60)))
            if (minsDiff < 60) {
              timeAgo = `hace ${minsDiff} min (${formattedTime})`
            } else {
              const hrs = Math.floor(minsDiff / 60)
              timeAgo = `hace ${hrs}h (${formattedTime})`
            }
          }
        }

        const title = cleanNewsTitle(rawTitle)
        if (title.length < 15 || isSpamOrLowQualityTitle(title) || !isFinancialTitle(title)) continue

        let category: NewsItem["category"] = defaultCategory
        const lower = title.toLowerCase()

        if (lower.includes("oro") || lower.includes("gold") || lower.includes("xau")) {
          category = "🥇 ORO"
        } else if (defaultCategory === "🛢️ COMMODITIES") {
          category = "🛢️ COMMODITIES"
        } else if (defaultCategory === "🌏 ASIA") {
          category = "🌏 ASIA"
        } else if (defaultCategory === "🇪🇺 EUROPA") {
          category = "🇪🇺 EUROPA"
        } else if (
          lower.includes("plata") ||
          lower.includes("silver") ||
          lower.includes("petróleo") ||
          lower.includes("petroleo") ||
          lower.includes("crudo") ||
          lower.includes("brent") ||
          lower.includes("wti") ||
          lower.includes("gas natural") ||
          lower.includes("cobre") ||
          lower.includes("litio") ||
          lower.includes("uranio")
        ) {
          category = "🛢️ COMMODITIES"
        } else if (
          lower.includes("asia") ||
          lower.includes("nikkei") ||
          lower.includes("tokio") ||
          lower.includes("china") ||
          lower.includes("chino") ||
          lower.includes("pekín") ||
          lower.includes("pekin") ||
          lower.includes("hang seng") ||
          lower.includes("japón") ||
          lower.includes("japon") ||
          lower.includes("yen") ||
          lower.includes("taiwan")
        ) {
          category = "🌏 ASIA"
        } else if (
          lower.includes("europa") ||
          lower.includes("eurozona") ||
          lower.includes("españa") ||
          lower.includes("espana") ||
          lower.includes("ibex") ||
          lower.includes("dax") ||
          lower.includes("alemania") ||
          lower.includes("francia") ||
          lower.includes("bce") ||
          lower.includes("reino unido")
        ) {
          category = "🇪🇺 EUROPA"
        } else if (
          lower.includes("usa") ||
          lower.includes("eeuu") ||
          lower.includes("wall street") ||
          lower.includes("s&p") ||
          lower.includes("nasdaq") ||
          lower.includes("fed") ||
          lower.includes("dólar")
        ) {
          category = "🇺🇸 USA"
        } else if (
          lower.includes("ipc") ||
          lower.includes("cpi") ||
          lower.includes("inflación") ||
          lower.includes("inflacion") ||
          lower.includes("empleo") ||
          lower.includes("nfp") ||
          lower.includes("pib")
        ) {
          category = "📊 MACRO / IPC"
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
          pubTime,
        })
        count++
      }
    }

    if (resGold && resGold.ok) {
      const xmlGold = await resGold.text()
      parseXmlFeed(xmlGold, "🥇 ORO")
    }

    if (resAsia && resAsia.ok) {
      const xmlAsia = await resAsia.text()
      parseXmlFeed(xmlAsia, "🌏 ASIA")
    }

    if (resEurope && resEurope.ok) {
      const xmlEurope = await resEurope.text()
      parseXmlFeed(xmlEurope, "🇪🇺 EUROPA")
    }

    if (resUsa && resUsa.ok) {
      const xmlUsa = await resUsa.text()
      parseXmlFeed(xmlUsa, "🇺🇸 USA")
    }

    if (resCommodities && resCommodities.ok) {
      const xmlCommodities = await resCommodities.text()
      parseXmlFeed(xmlCommodities, "🛢️ COMMODITIES")
    }

    if (resCrypto && resCrypto.ok) {
      const xmlCrypto = await resCrypto.text()
      parseXmlFeed(xmlCrypto, "🪙 CRIPTO")
    }

    // Deduplicate items by title
    const uniqueNews = fetchedItems.filter(
      (item, index, self) => index === self.findIndex((t) => t.title === item.title)
    )

    // Group items by category and interleave so ASIA, EUROPA, USA appear right away
    const byCategory: Record<string, NewsItem[]> = {}
    for (const item of uniqueNews) {
      const cat = item.category
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push(item)
    }

    for (const cat in byCategory) {
      byCategory[cat].sort((a, b) => b.pubTime - a.pubTime)
    }

    const interleaved: NewsItem[] = []
    const categories = Object.keys(byCategory)
    const maxLen = categories.length > 0 ? Math.max(...categories.map((c) => byCategory[c].length)) : 0

    for (let i = 0; i < maxLen; i++) {
      for (const cat of categories) {
        if (byCategory[cat][i]) {
          interleaved.push(byCategory[cat][i])
        }
      }
    }

    return NextResponse.json({ news: interleaved })
  } catch {
    return NextResponse.json({ news: [] })
  }
}

