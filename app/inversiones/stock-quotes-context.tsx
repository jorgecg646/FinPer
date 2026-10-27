"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import { fetchQuotes } from "./stock-widgets"
import type { StockQuote } from "./stock-widgets"
import { useVisibilityPolling } from "@/lib/hooks"

const QUOTES_CACHE_KEY = "finper_unified_quotes_v1"
const POLLING_INTERVAL_MS = 5_000 // 5s matching GET /api/market-indices frequency

interface StockQuotesContextType {
  quotes: Record<string, StockQuote>
  statuses: Record<string, "idle" | "loading" | "ok" | "error">
  registerSymbols: (sourceKey: string, symbols: string[]) => void
  unregisterSymbols: (sourceKey: string) => void
  refreshAll: () => Promise<void>
  refreshQuote: (symbol: string) => Promise<void>
  lastUpdated: Date | null
  isLoading: boolean
}

const StockQuotesContext = createContext<StockQuotesContextType | null>(null)

export function StockQuotesProvider({
  children,
  initialSymbols = [],
}: {
  children: ReactNode
  initialSymbols?: string[]
}) {
  // Registry of symbols per source (e.g. "portfolio", "watchlist")
  const registryRef = useRef<Map<string, string[]>>(
    new Map(initialSymbols.length > 0 ? [["initial", initialSymbols]] : [])
  )

  // Quotes initialized as empty object on SSR and initial client render to avoid hydration mismatch
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({})

  // Hydrate cached quotes from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(QUOTES_CACHE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && typeof parsed === "object") {
          setQuotes((prev) => ({ ...parsed, ...prev }))
        }
      }
    } catch {}
  }, [])

  const [statuses, setStatuses] = useState<Record<string, "idle" | "loading" | "ok" | "error">>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const isFetchingRef = useRef(false)

  // Returns all deduplicated, sorted uppercase symbols
  const getAllSymbols = useCallback(() => {
    const set = new Set<string>()
    registryRef.current.forEach((syms) => {
      syms.forEach((s) => {
        const clean = s.trim().toUpperCase()
        if (clean) set.add(clean)
      })
    })
    return Array.from(set).sort()
  }, [])

  const [symbolsKey, setSymbolsKey] = useState(() => getAllSymbols().join(","))

  // Fetch all registered symbols together in ONE single batch call
  const fetchAll = useCallback(
    async (customSymbols?: string[]) => {
      const syms = customSymbols ?? getAllSymbols()
      if (syms.length === 0) return
      if (isFetchingRef.current) return
      isFetchingRef.current = true
      setIsLoading(true)

      setStatuses((prev) => {
        const next = { ...prev }
        syms.forEach((s) => {
          if (!next[s]) next[s] = "loading"
        })
        return next
      })

      try {
        const fetched = await fetchQuotes(syms)
        setQuotes((prev) => {
          const next = { ...prev, ...fetched }
          try {
            localStorage.setItem(QUOTES_CACHE_KEY, JSON.stringify(next))
          } catch {}
          return next
        })

        setStatuses((prev) => {
          const next = { ...prev }
          syms.forEach((s) => {
            next[s] = fetched[s] ? "ok" : "error"
          })
          return next
        })
        setLastUpdated(new Date())
      } catch {
        setStatuses((prev) => {
          const next = { ...prev }
          syms.forEach((s) => {
            if (next[s] === "loading") next[s] = "error"
          })
          return next
        })
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    },
    [getAllSymbols]
  )

  // Register symbols for a specific source (e.g. portfolio, watchlist)
  const registerSymbols = useCallback(
    (sourceKey: string, symbols: string[]) => {
      const current = registryRef.current.get(sourceKey)
      const nextKey = symbols.map((s) => s.trim().toUpperCase()).sort().join(",")
      const curKey = current ? current.map((s) => s.trim().toUpperCase()).sort().join(",") : ""
      if (nextKey === curKey) return

      registryRef.current.set(sourceKey, symbols)
      const newCombined = getAllSymbols().join(",")
      setSymbolsKey((prev) => (prev !== newCombined ? newCombined : prev))
    },
    [getAllSymbols]
  )

  const unregisterSymbols = useCallback(
    (sourceKey: string) => {
      if (registryRef.current.has(sourceKey)) {
        registryRef.current.delete(sourceKey)
        setSymbolsKey(getAllSymbols().join(","))
      }
    },
    [getAllSymbols]
  )

  // Refresh single quote
  const refreshQuote = useCallback(async (symbol: string) => {
    const clean = symbol.trim().toUpperCase()
    if (!clean) return
    try {
      const fetched = await fetchQuotes([clean])
      if (fetched[clean]) {
        setQuotes((prev) => {
          const next = { ...prev, ...fetched }
          try {
            localStorage.setItem(QUOTES_CACHE_KEY, JSON.stringify(next))
          } catch {}
          return next
        })
        setStatuses((prev) => ({ ...prev, [clean]: "ok" }))
      }
    } catch {
      setStatuses((prev) => ({ ...prev, [clean]: "error" }))
    }
  }, [])

  // Trigger batch request whenever the list of symbols changes
  useEffect(() => {
    if (!symbolsKey) return
    const syms = symbolsKey.split(",").filter(Boolean)
    if (syms.length > 0) {
      fetchAll(syms)
    }
  }, [symbolsKey, fetchAll])

  // Synchronized visibility polling every 20s
  useVisibilityPolling(fetchAll, POLLING_INTERVAL_MS, Boolean(symbolsKey))

  const value = {
    quotes,
    statuses,
    registerSymbols,
    unregisterSymbols,
    refreshAll: fetchAll,
    refreshQuote,
    lastUpdated,
    isLoading,
  }

  return (
    <StockQuotesContext.Provider value={value}>
      {children}
    </StockQuotesContext.Provider>
  )
}

export function useStockQuotes() {
  const ctx = useContext(StockQuotesContext)
  if (!ctx) {
    throw new Error("useStockQuotes must be used within a StockQuotesProvider")
  }
  return ctx
}
