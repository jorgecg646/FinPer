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
    .replace(/\s*\([a-zA-Z0-9_-]{8,15}\)\s*$/g, "")
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

  // Must contain at least one economic/financial indicator or market voice
  const financialKeywords = [
    "bolsa", "acciones", "mercado", "cotización", "cotizacion", "precio", "dólar", "dolar",
    "euro", "yen", "yuan", "ipc", "cpi", "inflación", "inflacion", "pib", "fed", "bce",
    "tipos", "interés", "interes", "oro", "gold", "petróleo", "petroleo", "crudo", "wall street",
    "nasdaq", "s&p", "ibex", "dax", "nikkei", "hang seng", "inversión", "inversion", "inversores",
    "banca", "banco", "empresa", "resultados", "beneficio", "ingresos", "arancel", "deuda",
    "bonos", "cripto", "bitcoin", "ethereum", "tecnológicas", "tecnologicas", "ia", "semiconductores",
    "dalio", "dimon", "zitron", "buffett", "burry", "cathie wood", "jpmorgan", "bridgewater"
  ]

  return financialKeywords.some((kw) => lower.includes(kw))
}

export async function GET() {
  try {
    const now = Date.now()

    // Strictly financial live RSS queries for Europa, Asia, USA, Gold, Commodities, Crypto, Market Voices
    const europeQuery = encodeURIComponent("Bolsa Europa OR Ibex 35 OR BCE Eurozona OR Dax Alemania when:12h")
    const asiaQuery = encodeURIComponent("Bolsa Nikkei OR Bolsa China OR economia Japon OR mercado Yen OR acciones Asia when:12h")
    const usaQuery = encodeURIComponent("Wall Street OR Nasdaq OR SP500 OR Fed inflacion when:12h")
    const goldQuery = encodeURIComponent("precio Oro OR cotizacion Oro Gold XAUUSD when:12h")
    const commoditiesQuery = encodeURIComponent("cotizacion Plata OR Petroleo Brent OR Gas Natural OR precio Cobre OR Litio when:12h")
    const cryptoQuery = encodeURIComponent("cotizacion Bitcoin OR cotizacion Cripto OR Ethereum when:12h")
    const voicesEsQuery = encodeURIComponent('"Ray Dalio" OR "Jamie Dimon" OR "Warren Buffett" OR "Michael Burry" OR "Ed Zitron" OR "Cathie Wood" when:24h')
    const voicesEnQuery = encodeURIComponent('"Ray Dalio" OR "Jamie Dimon" OR "Warren Buffett" OR "Michael Burry" OR "Cathie Wood" when:24h')
    const zitronQuery = encodeURIComponent('"Ed Zitron" OR "Where\'s Your Ed At"')

    const [resEurope, resAsia, resUsa, resGold, resCommodities, resCrypto, resVoicesEs, resVoicesEn, resZitron] = await Promise.all([
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
      fetch(`https://news.google.com/rss/search?q=${voicesEsQuery}&hl=es&gl=ES&ceid=ES:es`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://news.google.com/rss/search?q=${voicesEnQuery}&hl=en-US&gl=US&ceid=US:en`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://news.google.com/rss/search?q=${zitronQuery}&hl=en-US&gl=US&ceid=US:en`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        cache: "no-store",
      }).catch(() => null),
    ])

    const fetchedItems: NewsItem[] = []

    function parseXmlFeed(xmlText: string, defaultCategory: NewsItem["category"] = "MERCADOS", maxHours = 36) {
      const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>/g
      let match: RegExpExecArray | null

      let count = 0
      while ((match = itemRegex.exec(xmlText)) !== null && count < 12) {
        const rawTitle = match[1]
        const link = match[2].trim()
        const pubDateStr = match[3] ? match[3].trim() : ""

        let timeAgo = "reciente"
        let pubTime = now
        if (pubDateStr) {
          const parsedTime = new Date(pubDateStr).getTime()
          if (!isNaN(parsedTime)) {
            pubTime = parsedTime
            const diffMs = now - pubTime
            const hoursDiff = diffMs / (1000 * 60 * 60)

            if (hoursDiff > maxHours || hoursDiff < -2) {
              continue // Discard anything older than maxHours
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
          lower.includes("dólar") ||
          lower.includes("dalio") ||
          lower.includes("dimon") ||
          lower.includes("zitron") ||
          lower.includes("buffett") ||
          lower.includes("burry") ||
          lower.includes("cathie wood") ||
          lower.includes("jpmorgan") ||
          lower.includes("bridgewater")
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

    if (resVoicesEs && resVoicesEs.ok) {
      const xmlVoicesEs = await resVoicesEs.text()
      parseXmlFeed(xmlVoicesEs, "🇺🇸 USA")
    }

    if (resVoicesEn && resVoicesEn.ok) {
      const xmlVoicesEn = await resVoicesEn.text()
      parseXmlFeed(xmlVoicesEn, "🇺🇸 USA")
    }

    if (resZitron && resZitron.ok) {
      const xmlZitron = await resZitron.text()
      parseXmlFeed(xmlZitron, "🇺🇸 USA", 48)
    }

    // Deduplicate items by title
    const uniqueNews = fetchedItems.filter(
      (item, index, self) => index === self.findIndex((t) => t.title === item.title)
    )

    // Sort items strictly chronologically (newest first)
    uniqueNews.sort((a, b) => b.pubTime - a.pubTime)

    return NextResponse.json({ news: uniqueNews })
  } catch {
    return NextResponse.json({ news: [] })
  }
}

