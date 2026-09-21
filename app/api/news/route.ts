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
  // 0. Google News Finance (España & Global)
  {
    category: "🇪🇺 EUROPE / ECB",
    url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnpHZ0pGVXlnQVAB?hl=es&gl=ES&ceid=ES:es",
    source: "Google News Finance",
  },
  {
    category: "🇺🇸 WALL STREET",
    url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnpHZ0pGVXlnQVAB?hl=en-US&gl=US&ceid=US:en",
    source: "Google News Finance US",
  },
  {
    category: "🇪🇺 EUROPE / ECB",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent("finanzas OR bolsa OR 'mercados financieros' OR 'wall street' OR ibex35 when:12h")}&hl=es&gl=ES&ceid=ES:es`,
    source: "Google News Finance",
  },
  // 1. news.finance() -> Wall Street
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

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : ""
}

function parseItemsFromXml(xml: string, defaultCategory: NewsItem["category"], source: string, now: number): NewsItem[] {
  const blocks = xml.split(/<item[\s>]/i).slice(1)
  const items: NewsItem[] = []

  for (const block of blocks.slice(0, 10)) {
    const rawTitle = extractTag(block, "title")
    const link = extractTag(block, "link")
    const pubDateStr = extractTag(block, "pubDate")

    // Discard any item with invalid or missing pubDate
    if (!pubDateStr) continue

    const parsed = new Date(pubDateStr).getTime()
    if (isNaN(parsed)) continue

    const { timeAgo, hoursDiff } = formatRelativeTime(parsed, now)

    // MANDATORY STRICT 12-HOUR CUTOFF (Discard anything > 12.0h or future invalid dates)
    if (hoursDiff > STRICT_MAX_HOURS || hoursDiff < -2) {
      continue
    }

    if (
      /\([a-zA-Z0-9]{8,15}\)/i.test(rawTitle) ||
      /secuestrado|alunicero|bonoloto|euromillones|lotería|primitiva|cuponazo|horóscopo|fútbol|partido/i.test(rawTitle)
    ) {
      continue
    }

    let title = cleanNewsTitle(rawTitle)
    if (source === "Ed Zitron" && !title.toLowerCase().includes("ed zitron")) {
      title = `Ed Zitron: ${title}`
    }
    if (title.length < 14 || !link.startsWith("http")) continue

    const rawSource = extractTag(block, "source")
    const finalSource = rawSource ? (source.includes("Google") ? `${rawSource} · Google News` : rawSource) : source

    let category = defaultCategory
    const lower = ` ${title.toLowerCase()} `

    // Detect specific thematic market sectors
    if (/buffett|michael burry|burry|ray dalio|dalio|ed zitron|zitron|bill ackman|ackman|cathie wood|druckenmiller|munger|howard marks/i.test(title)) {
      category = "🧠 TOP INVESTORS"
    } else if (lower.includes("oro") || lower.includes("gold") || lower.includes("xauusd")) {
      category = "🥇 GOLD"
    } else if (lower.includes("bitcoin") || lower.includes("cripto") || lower.includes("crypto") || lower.includes("ethereum")) {
      category = "🪙 CRYPTO"
    } else if (lower.includes("petróleo") || lower.includes("crude") || lower.includes("oil") || lower.includes("brent") || lower.includes("wti") || lower.includes("gas natural")) {
      category = "🛢️ COMMODITIES"
    } else if (/ia\b|ai\b|nvidia|chatgpt|openai|microsoft|google|apple|amazon|meta\b|tech|semiconductor|chip/i.test(title)) {
      category = "⚡ TECH / AI"
    } else if (/inflación|ipc|cpi|tipos de interés|interés|pib|gdp|recesión|deuda|arancel|tariffs|fed\b|bce\b|central bank/i.test(title)) {
      category = "📊 MACRO / CPI"
    } else if (/beneficio|resultados|ingresos|earnings|dividendo|fusi[oó]n|adquisici[oó]n|opa\b|deóleo|dcoop|empresa|compañía|salario|empleo/i.test(title)) {
      category = "💼 BUSINESS / EARNINGS"
    } else if (/china|asia|tokyo|japan|japón|nikkei|korea|taiwan/i.test(title)) {
      category = "🌏 ASIA / GLOBAL"
    } else if (/treasury|yield|wall street|warsh|powell|dow|s&p|nasdaq|eeuu|estados unidos|\bus\b/i.test(title)) {
      category = "🇺🇸 WALL STREET"
    } else if (/iceland|greenland|europa|europe|bce|ecb|lagarde|ibex|dax|madrid|españa|santander|bbva|\beu\b|ukraine|russia|germany|france|italy/i.test(title)) {
      category = "🇪🇺 EUROPE / ECB"
    }

    items.push({
      id: `mkt-${items.length}-${parsed}`,
      title,
      source: finalSource,
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
