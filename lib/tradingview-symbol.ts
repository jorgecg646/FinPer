const CRYPTO_LOGO_SYMBOLS = new Set([
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK",
  "NEAR", "SUI", "PEPE", "SHIB", "TRX", "LTC", "BCH", "UNI", "MATIC", "POL",
  "APT", "RENDER", "ICP", "FET", "FIL", "ATOM", "XLM", "MONERO", "XMR", "KAS", "TON",
])

const CRYPTO_QUOTE_SUFFIXES = ["USDT", "USD", "EUR", "BTC", "ETH"]
const COMMODITY_SYMBOLS = [
  "USOIL", "UKOIL", "BRENT", "WTI", "CRUDE", "CL1!", "BB1!", "BZ1!", "WTICOUSD", "BCOUSD",
]

export function resolveTradingViewLogoId(
  symbol: string,
  logoid?: string | null,
  baseCurrencyLogoid?: string | null
): string {
  if (typeof logoid === "string" && logoid.trim()) return logoid.trim()
  if (typeof baseCurrencyLogoid === "string" && baseCurrencyLogoid.trim()) return baseCurrencyLogoid.trim()
  if (symbol.length > 128) return ""

  const sym = symbol.toUpperCase()
  if (COMMODITY_SYMBOLS.some((commodity) => sym.includes(commodity))) {
    return "crude-oil"
  }

  const colonIndex = sym.lastIndexOf(":")
  const ticker = colonIndex === -1 ? sym : sym.slice(colonIndex + 1)
  let base = ticker
  if (!CRYPTO_LOGO_SYMBOLS.has(ticker)) {
    for (const suffix of CRYPTO_QUOTE_SUFFIXES) {
      if (ticker.endsWith(suffix)) {
        base = ticker.slice(0, -suffix.length)
        break
      }
    }
  }

  return CRYPTO_LOGO_SYMBOLS.has(base) ? `crypto/XTVC${base}` : ""
}
