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

export function fmtCurrency(
  val: number,
  symbol: string,
  minDigits = 2,
  maxDigits = 2
): string {
  const isNeg = val < 0
  const absFormatted = Math.abs(val).toLocaleString("es-ES", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  })
  return `${isNeg ? "-" : ""}${symbol}${absFormatted}`
}

export function formatCompactCurrency(val: number, dispSym: string): string {
  const tiers = [
    { threshold: 1_000_000, divisor: 1_000_000, suffix: "M", decimals: 2 },
    { threshold: 10_000, divisor: 1_000, suffix: "k", decimals: 0 },
    { threshold: 1_000, divisor: 1_000, suffix: "k", decimals: 1 },
  ]
  for (const t of tiers) {
    if (val >= t.threshold) {
      const formatted = (val / t.divisor).toLocaleString("es-ES", {
        maximumFractionDigits: t.decimals,
      })
      return `${formatted} ${t.suffix} ${dispSym}`
    }
  }
  return `${val.toFixed(0)} ${dispSym}`
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
