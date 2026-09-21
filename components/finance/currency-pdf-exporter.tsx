"use client"

import { useState, useEffect } from "react"
import { DollarSign } from "lucide-react"
import { CURRENCY_SYMBOLS, getClientCurrency, setStoredCurrency } from "@/lib/format"

export type Currency = "EUR" | "USD" | "GBP"

export function CurrencySelector() {
  const [currency, setCurrency] = useState<Currency>("EUR")

  useEffect(() => {
    try {
      const stored = getClientCurrency() as Currency
      if (stored && CURRENCY_SYMBOLS[stored]) setCurrency(stored)
    } catch {
      // ignore
    }
  }, [])

  function handleCurrencyChange(c: Currency) {
    setCurrency(c)
    setStoredCurrency(c)
    window.location.reload()
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 shadow-xs">
      <label htmlFor="currency-selector-input" className="sr-only">
        Seleccionar moneda
      </label>
      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <select
        id="currency-selector-input"
        name="currency-selector-input"
        value={currency}
        onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
        aria-label="Seleccionar moneda"
        title="Seleccionar moneda"
        className="appearance-none bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer pr-1"
      >
        <option value="EUR" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100 font-semibold">EUR (€)</option>
        <option value="USD" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100 font-semibold">USD ($)</option>
        <option value="GBP" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100 font-semibold">GBP (£)</option>
      </select>
    </div>
  )
}
