"use client"

import { useState, useEffect } from "react"
import { getClientCurrency, getCurrencySymbol, CURRENCY_SYMBOLS, DEFAULT_CURRENCY } from "@/lib/format"

export function useCurrency(initialSymbol?: string) {
  const [currency, setCurrency] = useState<string>(() => {
    if (initialSymbol) {
      const entry = Object.entries(CURRENCY_SYMBOLS).find(([, sym]) => sym === initialSymbol)
      if (entry) return entry[0]
    }
    return DEFAULT_CURRENCY
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCurrency(getClientCurrency())

    function update() {
      setCurrency(getClientCurrency())
    }
    window.addEventListener("finflow-currency-changed", update)
    window.addEventListener("storage", update)
    return () => {
      window.removeEventListener("finflow-currency-changed", update)
      window.removeEventListener("storage", update)
    }
  }, [])

  const symbol = mounted
    ? getCurrencySymbol(currency)
    : (initialSymbol || getCurrencySymbol(currency))

  return { currency, symbol }
}
