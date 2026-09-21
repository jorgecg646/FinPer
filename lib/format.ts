// ─── Shared Currency & Math Formatting Helpers ─────────────────────────────

export interface CurrencyInfo {
  code: string
  label: string
  symbol: string
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "USD", label: "Dólar EE.UU.", symbol: "$" },
  { code: "GBP", label: "Libra Esterlina", symbol: "£" },
  { code: "CHF", label: "Franco Suizo", symbol: "Fr" },
  { code: "JPY", label: "Yen Japonés", symbol: "¥" },
  { code: "CAD", label: "Dólar Canadiense", symbol: "CA$" },
  { code: "AUD", label: "Dólar Australiano", symbol: "A$" },
]

export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.symbol])
)

export const DISPLAY_CURRENCY_KEY = "finflow_display_currency"
export const LEGACY_CURRENCY_KEY = "finflow-currency"
export const DEFAULT_CURRENCY = "EUR"

export function isSuffixSymbol(symbol: string): boolean {
  return symbol === "€" || symbol === "EUR" || symbol === "Fr" || symbol === "CHF"
}

export function getCurrencySymbol(code?: string): string {
  if (!code) return "€"
  return CURRENCY_SYMBOLS[code.toUpperCase()] || code
}

export function getClientCurrency(): string {
  if (typeof window === "undefined") return DEFAULT_CURRENCY
  try {
    const cookieMatch = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${DISPLAY_CURRENCY_KEY}=`) || row.startsWith(`${LEGACY_CURRENCY_KEY}=`))
    if (cookieMatch) {
      const val = cookieMatch.split("=")[1]?.trim()
      if (val && CURRENCY_SYMBOLS[val]) return val
    }
    const fromStorage = localStorage.getItem(DISPLAY_CURRENCY_KEY) || localStorage.getItem(LEGACY_CURRENCY_KEY)
    if (fromStorage && CURRENCY_SYMBOLS[fromStorage]) return fromStorage
  } catch {}
  return DEFAULT_CURRENCY
}

export function getClientCurrencySymbol(): string {
  return getCurrencySymbol(getClientCurrency())
}

export function setStoredCurrency(code: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(DISPLAY_CURRENCY_KEY, code)
    localStorage.setItem(LEGACY_CURRENCY_KEY, code)
    document.cookie = `${DISPLAY_CURRENCY_KEY}=${code}; path=/; max-age=31536000; SameSite=Lax`
    document.cookie = `${LEGACY_CURRENCY_KEY}=${code}; path=/; max-age=31536000; SameSite=Lax`
    window.dispatchEvent(new CustomEvent("finflow-currency-changed", { detail: { currency: code } }))
  } catch {}
}

export function fmtCurrency(
  val: number,
  symbol = "€",
  minDigits = 2,
  maxDigits = 2
): string {
  const isNeg = val < 0
  const absFormatted = Math.abs(val).toLocaleString("es-ES", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  })
  if (isSuffixSymbol(symbol)) {
    return `${isNeg ? "-" : ""}${absFormatted} ${symbol}`
  }
  return `${isNeg ? "-" : ""}${symbol}${absFormatted}`
}

export function fmtSignedCurrency(
  val: number,
  symbol = "€",
  minDigits = 2,
  maxDigits = 2
): string {
  const isNeg = val < 0
  const absFormatted = Math.abs(val).toLocaleString("es-ES", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  })
  const prefix = val > 0 ? "+" : isNeg ? "-" : ""
  if (isSuffixSymbol(symbol)) {
    return `${prefix}${absFormatted} ${symbol}`
  }
  return `${prefix}${symbol}${absFormatted}`
}

export function fmtNumber(
  val: number,
  minDigits = 0,
  maxDigits = 2
): string {
  return val.toLocaleString("es-ES", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  })
}

export function fmtPercent(
  val: number,
  decimals = 2,
  signed = false
): string {
  const prefix = signed ? (val >= 0 ? "+" : "") : ""
  return `${prefix}${val.toFixed(decimals)}%`
}

export function formatCompactCurrency(val: number, dispSym: string): string {
  if (!isFinite(val) || val <= 0) {
    return isSuffixSymbol(dispSym) ? `0 ${dispSym}` : `${dispSym}0`
  }

  const tiers = [
    { threshold: 1_000_000_000_000, divisor: 1_000_000_000_000, suffix: "T", decimals: 2 },
    { threshold: 1_000_000_000, divisor: 1_000_000_000, suffix: "B", decimals: 2 },
    { threshold: 1_000_000, divisor: 1_000_000, suffix: "M", decimals: 2 },
    { threshold: 10_000, divisor: 1_000, suffix: "k", decimals: 0 },
    { threshold: 1_000, divisor: 1_000, suffix: "k", decimals: 1 },
  ]
  for (const t of tiers) {
    if (val >= t.threshold) {
      const formatted = (val / t.divisor).toLocaleString("es-ES", {
        minimumFractionDigits: 0,
        maximumFractionDigits: t.decimals,
      })
      return isSuffixSymbol(dispSym)
        ? `${formatted} ${t.suffix} ${dispSym}`
        : `${dispSym}${formatted} ${t.suffix}`
    }
  }
  const formatted = val.toLocaleString("es-ES", { maximumFractionDigits: 0 })
  return isSuffixSymbol(dispSym) ? `${formatted} ${dispSym}` : `${dispSym}${formatted}`
}

export function getTradingViewLogoUrl(logoid?: string | null): string | null {
  if (!logoid) return null
  const clean = logoid.trim()
  if (!clean) return null
  if (clean.startsWith("http://") || clean.startsWith("https://")) return clean
  if (clean.includes("/")) {
    return `https://s3-symbol-logo.tradingview.com/${clean}.svg`
  }
  return `https://s3-symbol-logo.tradingview.com/${clean}--big.svg`
}

// ─── Geometry Helpers (Memoized for 60 FPS charts) ──────────────────────────

const polarCache = new Map<string, { x: number; y: number }>()
export function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const key = `${cx}_${cy}_${r}_${deg}`
  const cached = polarCache.get(key)
  if (cached) return cached

  const rad = ((deg - 90) * Math.PI) / 180
  const x = Math.round((cx + r * Math.cos(rad)) * 1000) / 1000
  const y = Math.round((cy + r * Math.sin(rad)) * 1000) / 1000
  const res = { x, y }
  if (polarCache.size < 500) polarCache.set(key, res)
  return res
}

const arcPathCache = new Map<string, string>()
export function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const key = `${cx}_${cy}_${r}_${start}_${end}`
  const cached = arcPathCache.get(key)
  if (cached) return cached

  if (end - start >= 359.9) {
    const full = `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`
    if (arcPathCache.size < 500) arcPathCache.set(key, full)
    return full
  }
  const s = polarToCartesian(cx, cy, r, start)
  const e = polarToCartesian(cx, cy, r, end)
  const res = `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${e.x} ${e.y} Z`
  if (arcPathCache.size < 500) arcPathCache.set(key, res)
  return res
}

// ─── FX Helper ───────────────────────────────────────────────────────────────

export function getFxPair(
  nativeCurr: string,
  displayCurrency: string,
  fxRates: Record<string, number>,
  avgFxRate?: number | null
) {
  const currentFx =
    nativeCurr === displayCurrency
      ? 1
      : (fxRates[`${nativeCurr}${displayCurrency}`] ?? 1)
  const purchaseFx = avgFxRate && avgFxRate > 0 ? avgFxRate : currentFx
  return { currentFx, purchaseFx }
}

export const FALLBACK_EUR_RATES: Record<string, number> = {
  EUR: 1.0,
  USD: 1.085,
  GBP: 0.855,
  CHF: 0.96,
  JPY: 165.0,
  CAD: 1.48,
  AUD: 1.66,
}

export function getFallbackFxRate(from: string, to: string): number {
  if (!from || !to) return 1
  const uFrom = from.toUpperCase()
  const uTo = to.toUpperCase()
  if (uFrom === uTo) return 1
  const fromRate = FALLBACK_EUR_RATES[uFrom] || 1
  const toRate = FALLBACK_EUR_RATES[uTo] || 1
  return toRate / fromRate
}
