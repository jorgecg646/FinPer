"use client"

import { useState, useEffect } from "react"
import { DollarSign, Download, Loader2 } from "lucide-react"
import type { Summary, Tx } from "@/app/actions"

import { CURRENCY_SYMBOLS } from "@/lib/format"

export type Currency = "EUR" | "USD" | "GBP"

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

      const doc = new jsPDF("p", "mm", "a4")
      const year = summary.selectedYear

      // Header
      doc.setFillColor(22, 54, 42) // #16362a brand-dark
      doc.rect(0, 0, 210, 32, "F")

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont("helvetica", "bold")
      doc.text("BudgetNext — Informe Financiero", 14, 18)

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text(`Año ${year} · Generado el ${new Date().toLocaleDateString("es-ES")}`, 14, 25)

      // Summary Card
      doc.setDrawColor(230, 230, 230)
      doc.setFillColor(245, 247, 245)
      doc.roundedRect(14, 38, 182, 28, 3, 3, "FD")

      doc.setTextColor(60, 60, 60)
      doc.setFontSize(9)
      doc.text("Balance Total", 20, 46)
      doc.text("Total Ingresos", 80, 46)
      doc.text("Total Gastos", 140, 46)

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(22, 54, 42)
      doc.text(`$${summary.balance.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, 20, 56)

      doc.setTextColor(47, 169, 113) // positive
      doc.text(`+$${summary.income.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, 80, 56)

      doc.setTextColor(229, 72, 77) // destructive
      doc.text(`-$${summary.expenses.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, 140, 56)

      // Table Header
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(20, 20, 20)
      doc.text("Detalle de Movimientos", 14, 76)

      let y = 84
      doc.setFillColor(235, 238, 235)
      doc.rect(14, y - 5, 182, 7, "F")

      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(80, 80, 80)
      doc.text("FECHA", 18, y)
      doc.text("CONCEPTO", 45, y)
      doc.text("CATEGORÍA", 115, y)
      doc.text("TIPO", 155, y)
      doc.text("IMPORTE", 192, y, { align: "right" })

      y += 6

      // Rows
      doc.setFont("helvetica", "normal")
      const list = transactions.slice(0, 70) // Limit to top 70 for clean multi-page fit

      for (let i = 0; i < list.length; i++) {
        const t = list[i]
        const isIncome = t.type === "income"

        if (y > 275) {
          doc.addPage()
          y = 20
          doc.setFillColor(235, 238, 235)
          doc.rect(14, y - 5, 182, 7, "F")

          doc.setFontSize(8)
          doc.setFont("helvetica", "bold")
          doc.setTextColor(80, 80, 80)
          doc.text("FECHA", 18, y)
          doc.text("CONCEPTO", 45, y)
          doc.text("CATEGORÍA", 115, y)
          doc.text("TIPO", 155, y)
          doc.text("IMPORTE", 192, y, { align: "right" })
          y += 6
          doc.setFont("helvetica", "normal")
        }

        if (i % 2 === 1) {
          doc.setFillColor(250, 250, 250)
          doc.rect(14, y - 4, 182, 6, "F")
        }

        doc.setFontSize(8)
        doc.setTextColor(50, 50, 50)
        const dateStr = new Date(t.occurredAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
        doc.text(dateStr, 18, y)

        const cleanName = t.name.length > 35 ? t.name.slice(0, 32) + "..." : t.name
        doc.text(cleanName, 45, y)
        doc.text(t.category, 115, y)

        doc.setFont("helvetica", "bold")
        if (isIncome) {
          doc.setTextColor(47, 169, 113)
          doc.text("Ingreso", 155, y)
          doc.text(`+$${t.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, 192, y, { align: "right" })
        } else {
          doc.setTextColor(229, 72, 77)
          doc.text("Gasto", 155, y)
          doc.text(`-$${t.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, 192, y, { align: "right" })
        }

        doc.setFont("helvetica", "normal")
        y += 6.5
      }

      // Footer
      const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p)
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(`BudgetNext Personal Finance · Página ${p} de ${totalPages}`, 105, 290, { align: "center" })
      }

      doc.save(`BudgetNext-${new Date().toISOString().slice(0, 10)}.pdf`)
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
