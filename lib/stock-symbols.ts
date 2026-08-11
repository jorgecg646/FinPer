// ─────────────────────────────────────────────────────────────────────────────
// Stock symbol storage — persisted in localStorage
// Maps a user-given label to a TradingView symbol (e.g. "Apple" → "NASDAQ:AAPL")
// ─────────────────────────────────────────────────────────────────────────────

export const SYMBOLS_STORAGE_KEY = "finflow_stock_symbols"

export interface StockSymbolEntry {
  /** User-facing label, e.g. "Apple" */
  label: string
  /** TradingView symbol, e.g. "NASDAQ:AAPL" */
  symbol: string
  /** Number of shares/units held */
  shares?: number
  /** Average purchase price per share */
  avgPrice?: number
}

export function loadSymbols(): StockSymbolEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SYMBOLS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveSymbols(entries: StockSymbolEntry[]): void {
  try {
    localStorage.setItem(SYMBOLS_STORAGE_KEY, JSON.stringify(entries))
    window.dispatchEvent(new Event("stock-symbols-updated"))
  } catch {
    // ignore
  }
}

export function addSymbol(entry: StockSymbolEntry): void {
  const existing = loadSymbols()
  const index = existing.findIndex(
    (e) => e.symbol.toUpperCase() === entry.symbol.toUpperCase()
  )
  if (index >= 0) {
    existing[index] = entry
  } else {
    existing.push(entry)
  }
  saveSymbols(existing)
}

export function updateSymbol(symbol: string, patch: Partial<StockSymbolEntry>): void {
  const existing = loadSymbols()
  const index = existing.findIndex(
    (e) => e.symbol.toUpperCase() === symbol.toUpperCase()
  )
  if (index >= 0) {
    existing[index] = { ...existing[index], ...patch }
    saveSymbols(existing)
  }
}

export function removeSymbol(symbol: string): void {
  const existing = loadSymbols()
  saveSymbols(existing.filter((e) => e.symbol.toUpperCase() !== symbol.toUpperCase()))
}

