import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export interface NewsItem {
  id: string
  title: string
  source: string
  category:
    | "🥇 GOLD"
    | "🛢️ COMMODITIES"
    | "🇺🇸 WALL STREET"
    | "🇪🇺 EUROPE / ECB"
    | "🌏 ASIA / GLOBAL"
    | "📊 MACRO / CPI"
    | "⚡ TECH / AI"
    | "🪙 CRYPTO"
    | "💼 BUSINESS / EARNINGS"
    | "🧠 TOP INVESTORS"
    | "📈 MARKETS"
  timeAgo: string
  url: string
  pubTime: number
}

function cleanNewsTitle(title: string): string {
  return title
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s*\([a-zA-Z0-9_-]{8,15}\)\s*$/g, "")
    .replace(/ - (CNBC|[^-]+)$/i, "")
    .replace(/ \| CNBC$/i, "")
    .replace(/^(De cara a hoy|Claves):\s*/i, "")
    .trim()
}

function formatRelativeTime(pubTime: number, now: number): { timeAgo: string; hoursDiff: number } {
  const diffMs = now - pubTime
  const hoursDiff = diffMs / (1000 * 60 * 60)
  const minsDiff = Math.max(1, Math.floor(Math.abs(diffMs) / (1000 * 60)))
  const formattedTime = new Date(pubTime).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  })
  
  const timeAgo = minsDiff < 60 ? `hace ${minsDiff} min (${formattedTime})` : `hace ${Math.floor(minsDiff / 60)}h (${formattedTime})`
  return { timeAgo, hoursDiff }
}

const STRICT_MAX_HOURS = 12 // STRICT 12-HOUR CUTOFF ACROSS ALL CATEGORIES

const CATEGORY_FEEDS: { category: NewsItem["category"]; url: string; source: string }[] = [
  // 1. news.finance() -> Wall Street & Markets
  { category: "🇺🇸 WALL STREET",        url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664", source: "CNBC Finance" },
  // 2. news.economy() & central_banks() -> Economy & Fed/Rates
  { category: "📊 MACRO / CPI",          url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258", source: "CNBC Economy" },
  // 3. news.technology() & cnbc_disruptors() -> Tech / AI
  { category: "⚡ TECH / AI",             url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910", source: "CNBC Tech" },
  // 4. news.business() -> Corporate / Earnings
  { category: "💼 BUSINESS / EARNINGS",  url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135", source: "CNBC Business" },
  // 5. news.energy() -> Energy & Commodities
  { category: "🛢️ COMMODITIES",          url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19836768", source: "CNBC Energy" },
  // 6. news.europe_politics() -> Europe, ECB, Ibex, DAX
  { category: "🇪🇺 EUROPE / ECB",         url: `https://news.google.com/rss/search?q=${encodeURIComponent("Ibex 35 OR BCE Lagarde OR Dax Alemania OR Eurozona inflacion when:12h")}&hl=es&gl=ES&ceid=ES:es`, source: "Europe Markets" },
  // 7. news.asia_politics() -> Asia, Tokyo, China
  { category: "🌏 ASIA / GLOBAL",        url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19832390", source: "CNBC Asia" },
  // 8. Dedicated GOLD Feed (Precious Metals)
  { category: "🥇 GOLD",                 url: `https://news.google.com/rss/search?q=${encodeURIComponent("Oro XAUUSD precio OR 'Gold price' OR 'cotización oro' when:12h")}&hl=es&gl=ES&ceid=ES:es`, source: "Gold Markets" },
  // 9. Dedicated CRYPTO Feed
  { category: "🪙 CRYPTO",               url: `https://news.google.com/rss/search?q=${encodeURIComponent("Bitcoin precio OR Ethereum ETF spot criptoactivos when:12h")}&hl=es&gl=ES&ceid=ES:es`, source: "Crypto Markets" },
  // 10. Dedicated TOP INVESTORS Feed (Buffett, Burry, Dalio, Wood, Ackman, Zitron, Druckenmiller - Strictly Last 12h)
  {
    category: "🧠 TOP INVESTORS",
    url: "https://news.google.com/rss/search?q=Buffett+OR+Burry+OR+Dalio+OR+Zitron+OR+Ackman+OR+%22Cathie+Wood%22+OR+Druckenmiller+when:1d&hl=en-US&gl=US&ceid=US:en",
    source: "Top Investors US",
  },
  {
    category: "🧠 TOP INVESTORS",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent("Buffett OR Burry OR Dalio OR Zitron OR Ackman OR 'Cathie Wood' when:1d")}&hl=es&gl=ES&ceid=ES:es`,
    source: "Grandes Inversores",
  },
]

let cachedNews: { timestamp: number; news: NewsItem[] } | null = null
const NEWS_CACHE_TTL = 90 * 1000 // 90 seconds cache

function parseItemsFromXml(xml: string, defaultCategory: NewsItem["category"], source: string, now: number): NewsItem[] {
  const blocks = xml.split(/<item[\s>]/i).slice(1)
  const items: NewsItem[] = []

  for (const block of blocks.slice(0, 10)) {
    const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ""
    const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()
    const pubDateStr = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || ""

    // Discard any item with invalid or missing pubDate
    if (!pubDateStr) continue

    const parsed = new Date(pubDateStr.trim()).getTime()
    if (isNaN(parsed)) continue

    const { timeAgo, hoursDiff } = formatRelativeTime(parsed, now)

    // MANDATORY STRICT 12-HOUR CUTOFF (Discard anything > 12.0h or future invalid dates)
    if (hoursDiff > STRICT_MAX_HOURS || hoursDiff < -2) {
      continue
    }

    if (/\([a-zA-Z0-9]{8,15}\)/i.test(rawTitle) || /secuestrado|alunicero/i.test(rawTitle)) continue

    let title = cleanNewsTitle(rawTitle)
    if (source === "Ed Zitron" && !title.toLowerCase().includes("ed zitron")) {
      title = `Ed Zitron: ${title}`
    }
    if (title.length < 14 || !link.startsWith("http")) continue

    let category = defaultCategory
    const lower = ` ${title.toLowerCase()} `

    // Detect Top Investors mentions with highest priority
    if (/buffett|michael burry|burry|ray dalio|dalio|ed zitron|zitron|bill ackman|ackman|cathie wood|druckenmiller|munger|howard marks/i.test(title)) {
      category = "🧠 TOP INVESTORS"
    } else if (lower.includes("oro") || lower.includes("gold") || lower.includes("xauusd")) {
      category = "🥇 GOLD"
    } else if (lower.includes("bitcoin") || lower.includes("cripto") || lower.includes("crypto") || lower.includes("ethereum")) {
      category = "🪙 CRYPTO"
    } else if (/iceland|greenland|europa|europe|bce|ecb|lagarde|ibex|\beu\b|ukraine|russia|germany|france|italy/i.test(title)) {
      category = "🇪🇺 EUROPE / ECB"
    } else if (/treasury|yield|wall street|warsh|powell|fed\b/i.test(title)) {
      category = "🇺🇸 WALL STREET"
    }

    items.push({
      id: `mkt-${items.length}-${parsed}`,
      title,
      source,
      category,
      timeAgo,
      url: link,
      pubTime: parsed,
    })
  }

  return items
}

export async function GET() {
  const now = Date.now()

  if (cachedNews && now - cachedNews.timestamp < NEWS_CACHE_TTL && cachedNews.news.length > 0) {
    return NextResponse.json(
      { news: cachedNews.news },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    )
  }

  try {
    const feedPromises = CATEGORY_FEEDS.map((f) =>
      fetch(f.url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        cache: "no-store",
        signal: AbortSignal.timeout(4500),
      })
        .then((res) => (res.ok ? res.text() : null))
        .then((xml) => (xml ? parseItemsFromXml(xml, f.category, f.source, now) : []))
        .catch(() => [])
    )

    const nested = await Promise.all(feedPromises)
    const all = nested.flat()

    // Deduplicate & sort newest first
    const unique = all
      .filter((item, idx, arr) => idx === arr.findIndex((t) => t.title.toLowerCase() === item.title.toLowerCase()))
      .sort((a, b) => b.pubTime - a.pubTime)

    if (unique.length > 0) cachedNews = { timestamp: now, news: unique }

    return NextResponse.json(
      { news: unique },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    )
  } catch {
    return NextResponse.json(
      { news: cachedNews?.news ?? [] },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    )
  }
}
