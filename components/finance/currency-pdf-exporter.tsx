"use client"

import { useState, useEffect } from "react"
import { DollarSign, Download, Loader2 } from "lucide-react"
import type { Summary, Tx } from "@/app/actions"

export type Currency = "EUR" | "USD" | "GBP"

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
}

const CURRENCY_KEY = "finflow-currency"

export function CurrencySelector() {
  const [currency, setCurrency] = useState<Currency>("EUR")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CURRENCY_KEY) as Currency
      if (stored && CURRENCY_SYMBOLS[stored]) setCurrency(stored)
    } catch {
      // ignore
    }
  }, [])

  function handleCurrencyChange(c: Currency) {
    setCurrency(c)
    localStorage.setItem(CURRENCY_KEY, c)
    window.location.reload()
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 shadow-xs">
      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={currency}
        onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
        className="appearance-none bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer pr-1"
      >
        <option value="EUR" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100 font-semibold">EUR (€)</option>
        <option value="USD" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100 font-semibold">USD ($)</option>
        <option value="GBP" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100 font-semibold">GBP (£)</option>
      </select>
    </div>
  )
}

export function PdfExporter({ summary, transactions }: { summary: Summary; transactions: Tx[] }) {
  const [generating, setGenerating] = useState(false)

  async function generatePdf() {
    setGenerating(true)
    try {
      const { jsPDF } = await import("jspdf")
      const html2canvas = (await import("html2canvas")).default

      const doc = new jsPDF("p", "pt", "a4")
      const reportElement = document.getElementById("main-dashboard-report") || document.body

      const canvas = await html2canvas(reportElement, {
        scale: 1.5,
        useCORS: true,
        logging: false,
      })

      const imgData = canvas.toDataURL("image/png")
      const imgWidth = 595.28
      const pageHeight = 841.89
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        doc.addPage()
        doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      doc.save(`FinFlow-Informe-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      console.error("Error al generar el PDF:", e)
      alert("No se pudo generar el informe PDF.")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <button
      type="button"
      onClick={generatePdf}
      disabled={generating}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-secondary transition-colors shadow-xs disabled:opacity-50"
      title="Descargar Informe Financiero PDF"
    >
      {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Download className="h-3.5 w-3.5 text-primary" />}
      <span>{generating ? "Generando PDF..." : "Exportar PDF"}</span>
    </button>
  )
}
