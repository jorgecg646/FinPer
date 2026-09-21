"use client"

import { useState, useMemo } from "react"
import { CURRENCY_SYMBOLS, fmtCurrency, fmtSignedCurrency } from "@/lib/format"

export const TAX_BRACKETS = [
  { limit: 6000, rate: 0.19, label: "Hasta 6.000 €" },
  { limit: 44000, rate: 0.21, label: "6.000 € a 50.000 €" },
  { limit: 150000, rate: 0.23, label: "50.000 € a 200.000 €" },
  { limit: 100000, rate: 0.27, label: "200.000 € a 300.000 €" },
  { limit: Infinity, rate: 0.28, label: "Más de 300.000 €" },
]

export function calculateSpanishTax(gain: number) {
  if (gain <= 0) return { tax: 0, effectiveRate: 0, breakdown: [] }
  let remaining = gain, totalTax = 0
  const breakdown: { bracket: string; rate: number; taxable: number; tax: number }[] = []

  for (const b of TAX_BRACKETS) {
    if (remaining <= 0) break
    const taxable = Math.min(remaining, b.limit)
    const tax = taxable * b.rate
    totalTax += tax
    remaining -= taxable
    breakdown.push({ bracket: b.label, rate: b.rate * 100, taxable, tax })
  }
  return { tax: totalTax, effectiveRate: (totalTax / gain) * 100, breakdown }
}

const CRYPTO_KEYS = ["BTC", "ETH", "SOL", "COINBASE:", "BINANCE:", "KRAKEN:", "USDT", "SOLANA", "BITCOIN", "ETHEREUM", "CRYPTO"]
const ETF_KEYS = ["ETF", "UCITS", "ISHARES", "VANECK", "VANGUARD", "AMUNDI", "SPDR", "FONDO", "SXRV", "G2X", "IS0D"]
const US_KEYS = ["NASDAQ:", "NYSE:", "AMEX:", "AAPL", "MSFT", "UNH", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "APPLE", "MICROSOFT", "UNITEDHEALTH", "GOOGLE", "AMAZON", "NVIDIA", "TESLA"]

export function getAssetFiscalDetails(symbol: string, label: string): {
  type: "stock" | "etf" | "crypto"
  categoryLabel: string
  badgeStyle: string
  casillas: string
  isUS: boolean
  isForeign: boolean
  marketName: string
  w8benStatus: string
} {
  const s = symbol.toUpperCase()
  const l = label.toUpperCase()
  const match = (keys: string[]) => keys.some((k) => s.includes(k) || l.includes(k))

  if (match(CRYPTO_KEYS)) {
    return {
      type: "crypto",
      categoryLabel: "Criptomoneda",
      badgeStyle: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      casillas: "Casillas 1800 a 1804",
      isUS: false,
      isForeign: false,
      marketName: "Cripto / Blockchain",
      w8benStatus: "No aplica (Activo digital)",
    }
  }

  if (match(ETF_KEYS)) {
    const isEuro = s.includes("XETR:") || s.includes("TRADEGATE:")
    return {
      type: "etf",
      categoryLabel: "ETF / Fondo (IIC)",
      badgeStyle: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      casillas: "Casillas 0326 a 0338",
      isUS: false,
      isForeign: isEuro,
      marketName: isEuro ? "Alemania / Irlanda (UCITS)" : "ETF Internacional",
      w8benStatus: "Régimen UE (IIC)",
    }
  }

  const isUS = match(US_KEYS)
  return {
    type: "stock",
    categoryLabel: "Acción Cotizada",
    badgeStyle: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    casillas: "Casillas 0308 a 0310",
    isUS,
    isForeign: isUS || s.includes("XETR:") || s.includes("LSE:"),
    marketName: isUS ? "EE.UU. (Wall Street)" : "España / Europa",
    w8benStatus: isUS ? "Convenio W-8BEN (EE.UU.)" : "Régimen Nacional",
  }
}

const QUICK_SALE_PRESETS = [
  { label: "Vender 100%", pct: 100 },
  { label: "Vender 50%", pct: 50 },
  { label: "Desactivar", pct: 0, cls: "text-muted-foreground hover:text-foreground" },
]

export function SpanishTaxExportCalculator({
  items,
  displayCurrency,
}: {
  items: { symbol: string; label: string; currentDisp: number; investedDisp: number; plDisp: number; plPct: number }[]
  displayCurrency: string
}) {
  const dispSym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency
  const fmt = (v: number, maxD = 2, minD = 2) => fmtCurrency(v, dispSym, minD, maxD)
  const fmtSigned = (v: number, maxD = 2, minD = 2) => fmtSignedCurrency(v, dispSym, minD, maxD)

  const [customSales, setCustomSales] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((it) => [it.symbol, 100]))
  )
  const [hasW8BEN, setHasW8BEN] = useState<boolean>(true)
  const [isPdfGenerating, setIsPdfGenerating] = useState(false)

  const downloadPdf = async () => {
    const reportEl = document.querySelector('.printable-fiscal-report') as HTMLElement | null
    if (!reportEl) return
    setIsPdfGenerating(true)
    try {
      const { toPng } = await import('html-to-image')
      const { default: jsPDF } = await import('jspdf')

      const isDark = document.documentElement.classList.contains('dark')
      const dataUrl = await toPng(reportEl, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        style: { borderRadius: '0' },
      })

      const img = new Image()
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl })

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [img.width / 2, img.height / 2] })
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width / 2, img.height / 2)

      const year = new Date().getFullYear()
      pdf.save(`Informe_Fiscal_IRPF_${year}.pdf`)
    } catch (err) {
      console.error('Error generando PDF:', err)
      window.print()
    } finally {
      setIsPdfGenerating(false)
    }
  }

  const setAllSales = (pct: number) =>
    setCustomSales(Object.fromEntries(items.map((it) => [it.symbol, pct])))

  const { processedItems, totalInvested, totalCurrent, totalGain, taxCalculation, effectiveTaxRate, netProfit } =
    useMemo(() => {
      let inv = 0, cur = 0
      const list = items.map((it) => {
        const pct = customSales[it.symbol] ?? 0
        const ratio = pct / 100
        const sCur = it.currentDisp * ratio
        const sInv = it.investedDisp * ratio
        const sPL = sCur - sInv
        const fiscal = getAssetFiscalDetails(it.symbol, it.label)
        if (pct > 0) {
          inv += sInv
          cur += sCur
        }
        return { ...it, pct, sCur, sInv, sPL, fiscal }
      })
      const gain = cur - inv
      const tax = calculateSpanishTax(gain)
      const effRate = gain > 0 ? (tax.tax / gain) * 100 : 0
      return {
        processedItems: list.map((it) => {
          const sTax = it.sPL > 0 ? it.sPL * (effRate / 100) : 0
          return { ...it, sTax, sNetPL: it.sPL - sTax }
        }),
        totalInvested: inv,
        totalCurrent: cur,
        totalGain: gain,
        taxCalculation: tax,
        effectiveTaxRate: effRate,
        netProfit: gain - tax.tax,
      }
    }, [items, customSales])

  const activeSaleItems = useMemo(
    () => processedItems.filter((it) => it.pct > 0),
    [processedItems]
  )

  const currentDateStr = useMemo(
    () => new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }),
    []
  )
  const currentYear = useMemo(() => new Date().getFullYear(), [])

  const summaryCards = [
    {
      title: "Valor Transmisión (Ventas)",
      val: fmt(totalCurrent),
      sub: `Coste Adquisición: ${fmt(totalInvested)}`,
      cardCls: "bg-card border-border/40",
      valCls: "text-foreground",
      subCls: "text-muted-foreground",
    },
    {
      title: "Ganancia / Pérdida Bruta",
      val: fmtSigned(totalGain),
      sub: "Base Imponible del Ahorro",
      cardCls: "bg-card border-border/40",
      valCls: totalGain >= 0 ? "text-positive print-positive" : "text-destructive print-destructive",
      subCls: "text-muted-foreground",
    },
    {
      title: "Estimación IRPF (Cuota)",
      val: fmt(taxCalculation.tax),
      sub: `Tipo Efectivo Medio: ${effectiveTaxRate.toFixed(2)}% (Tramos 19% y 21%)`,
      cardCls: "bg-amber-500/5 border-amber-500/20 text-amber-500",
      valCls: "text-amber-500",
      subCls: "text-amber-500/90 font-bold",
    },
    {
      title: "Beneficio Neto Limpio",
      val: fmt(netProfit),
      sub: "Limpio tras impuestos del ahorro",
      cardCls: "bg-emerald-500/5 border-emerald-500/20 text-emerald-400",
      valCls: "text-emerald-400",
      subCls: "text-emerald-400/90 font-bold",
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* ── Controles Web Interactivos (NO SE IMPRIMEN EN EL PDF) ── */}
      <div className="no-print flex flex-col gap-4 bg-background/60 rounded-2xl p-4 border border-border/40 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>🇪🇸</span>
              <span>Calculadora Fiscal IRPF & Guía de Renta (España)</span>
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cálculo progresivo por cantidad de ganancia patrimonial (escala 19% a 28%) y régimen de acciones extranjeras con formulario W-8BEN.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={isPdfGenerating}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 flex items-center gap-2 cursor-pointer shadow-xs self-start sm:self-auto transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Genera el informe fiscal en PDF y lo descarga automáticamente"
          >
            {isPdfGenerating ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Generando PDF...</span>
              </>
            ) : (
              <span>📄 Descargar Informe PDF</span>
            )}
          </button>
        </div>

        {/* Panel de Convenio W-8BEN para Acciones de EE.UU. */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25">
          <div className="flex items-start sm:items-center gap-2.5">
            <span className="text-xl shrink-0">🇺🇸</span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-xs">Formulario W-8BEN (Convenio Doble Imposición España - EE.UU.)</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${hasW8BEN ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-destructive/20 text-destructive border-destructive/40"}`}>
                  {hasW8BEN ? "✓ Activo / Firmado" : "✗ Sin W-8BEN"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {hasW8BEN
                  ? "Con W-8BEN: 0% de retención en EE.UU. por venta de acciones (art. 13 Convenio). La plusvalía tributa 100% en España según tu ganancia total. En dividendos, retención reducida al 15% (deducible en casilla 0588)."
                  : "Sin W-8BEN: El IRS de EE.UU. aplica retención en origen del 30% en dividendos y contingencia fiscal en ventas."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHasW8BEN(!hasW8BEN)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 border ${
              hasW8BEN
                ? "bg-card border-border/50 text-foreground hover:bg-secondary"
                : "bg-primary text-primary-foreground border-primary hover:opacity-90"
            }`}
          >
            {hasW8BEN ? "Alternar a Sin W-8BEN" : "Activar W-8BEN"}
          </button>
        </div>

        {/* Selector de ventas individuales */}
        <div className="flex flex-col gap-3 bg-secondary/30 p-3.5 rounded-xl border border-border/30 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/20 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground text-xs">⚙️ Selección de Venta Individual:</span>
              <span className="text-[10px] text-muted-foreground font-medium">
                (El tipo de IRPF se calcula progresivamente por la suma de ganancias)
              </span>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              {QUICK_SALE_PRESETS.map((b) => (
                <button
                  key={b.pct}
                  type="button"
                  onClick={() => setAllSales(b.pct)}
                  className={`px-2.5 py-1 rounded-lg bg-card border border-border/40 hover:bg-secondary text-[11px] font-bold cursor-pointer transition-colors ${b.cls ?? "text-foreground"}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {processedItems.map((it) => {
              const isSelling = it.pct > 0

              return (
                <div
                  key={it.symbol}
                  className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                    isSelling ? "bg-card border-primary/40 shadow-2xs" : "bg-secondary/20 border-border/20 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelling}
                        onChange={(e) => setCustomSales((prev) => ({ ...prev, [it.symbol]: e.target.checked ? 100 : 0 }))}
                        className="rounded accent-primary h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="font-bold text-foreground truncate text-xs">{it.label}</span>
                    </div>
                    <span className="text-xs font-black tabular-nums text-primary shrink-0">{it.pct}% venta</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={it.pct}
                    onChange={(e) => setCustomSales((prev) => ({ ...prev, [it.symbol]: parseInt(e.target.value, 10) }))}
                    className="flex-1 accent-primary h-1.5 bg-secondary rounded-lg cursor-pointer"
                  />

                  <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                    <span>Venta: <strong className="text-foreground">{fmt(it.sCur, 0, 0)}</strong></span>
                    <span className="font-mono text-[9px] text-muted-foreground/80">{it.fiscal.casillas}</span>
                    <span className={`font-black tabular-nums ${it.sPL >= 0 ? "text-positive" : "text-destructive"}`}>
                      {fmtSigned(it.sPL, 0, 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/25 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      {it.fiscal.isUS ? (
                        <span className={`px-1.5 py-0.5 rounded font-bold border text-[9px] ${hasW8BEN ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>
                          🇺🇸 {hasW8BEN ? "W-8BEN: 0% ret. USA venta" : "Sin W-8BEN: 30% USA"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-medium">{it.fiscal.marketName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] tabular-nums font-semibold">
                      {it.sPL > 0 ? (
                        <>
                          <span className="text-amber-500 font-bold" title={`Tipo medio del ${effectiveTaxRate.toFixed(2)}% ponderando tramos de IRPF`}>
                            IRPF medio ({effectiveTaxRate.toFixed(2)}%): -{fmt(it.sTax, 0, 0)}
                          </span>
                          <span className="text-muted-foreground text-[9px]">
                            (Neto: <strong className="text-emerald-400">{fmtSigned(it.sNetPL, 0, 0)}</strong>)
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">0 € IRPF (Minusvalía)</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── INFORME FISCAL ESENCIAL (VISTA EN PANTALLA Y EXCLUSIVA PARA EL PDF IMPRESO) ── */}
      <div className="printable-fiscal-report flex flex-col gap-5 bg-background/60 rounded-2xl p-5 border border-border/50 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-border/40 pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h3 className="font-extrabold text-foreground text-base tracking-tight">
                Informe Fiscal IRPF & Guía de Renta (Modelo 100 - España)
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Liquidación de plusvalías y minusvalías patrimoniales bajo criterio FIFO, tipo IRPF según escala del ahorro y régimen de acciones extranjeras con formulario W-8BEN.
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-col sm:items-end gap-1.5 shrink-0">
            <span className="text-xs font-bold text-foreground bg-secondary/80 px-3 py-1 rounded-md border border-border/50">
              Ejercicio Fiscal {currentYear}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Fecha de emisión: {currentDateStr}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print-avoid-break">
          {summaryCards.map((c, i) => (
            <div key={i} className={`print-card rounded-xl p-3.5 border flex flex-col justify-center ${c.cardCls}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider">{c.title}</span>
              <span className={`text-lg font-black tabular-nums mt-0.5 ${c.valCls}`}>{c.val}</span>
              <span className={`text-[10px] font-medium mt-0.5 ${c.subCls}`}>{c.sub}</span>
            </div>
          ))}
        </div>

        {taxCalculation.breakdown.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/30 text-[11px] print-avoid-break">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <span>📊</span>
              <span>Tramos Oficiales AEAT (Sin decimales):</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {taxCalculation.breakdown.map((b, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-md bg-card border border-border/40 text-foreground font-medium text-[10.5px]">
                  Tramo al <strong>{b.rate}%</strong>: {fmt(b.taxable)} → Cuota: <strong>{fmt(b.tax)}</strong>
                </span>
              ))}
            </div>
            <span className="sm:ml-auto text-muted-foreground text-[10px]">
              Tipo efectivo medio ponderado: <strong className="text-amber-500 font-bold">{effectiveTaxRate.toFixed(2)}%</strong>
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h5 className="font-bold text-foreground text-xs uppercase tracking-wider">
              Desglose de Operaciones y Transmisiones ({activeSaleItems.length} activas)
            </h5>
            <span className="text-[10px] text-muted-foreground">
              {hasW8BEN ? "✓ Formulario W-8BEN activo para valores EE.UU." : "⚠️ Sin formulario W-8BEN"} · Criterio FIFO
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/40 bg-card/30 p-1 shadow-2xs">
            <table className="w-full text-left border-collapse text-xs min-w-[760px]">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-bold bg-secondary/40">
                  <th className="py-2.5 px-3">Activo / Emisor</th>
                  <th className="py-2.5 px-2">Mercado / Tipo</th>
                  <th className="py-2.5 px-2 text-center">% Venta</th>
                  <th className="py-2.5 px-2">Casilla AEAT</th>
                  <th className="py-2.5 px-2 text-right">Valor Venta ({dispSym})</th>
                  <th className="py-2.5 px-2 text-right">Coste Adq. ({dispSym})</th>
                  <th className="py-2.5 px-2 text-right">Ganancia / Pérdida ({dispSym})</th>
                  <th className="py-2.5 px-2 text-center">Tipo Efectivo (Medio)</th>
                  <th className="py-2.5 px-2 text-right">Cuota IRPF ({dispSym})</th>
                  <th className="py-2.5 px-2.5 text-center">Régimen W-8BEN (USA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 font-medium">
                {activeSaleItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-muted-foreground italic">
                      No hay operaciones seleccionadas para venta. Ajusta los selectores para incluir activos en la simulación fiscal.
                    </td>
                  </tr>
                ) : (
                  activeSaleItems.map((it) => (
                    <tr key={it.symbol} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-2 px-3">
                        <div className="font-bold text-foreground leading-tight flex items-center gap-1.5">
                          {it.label}
                          {it.fiscal.isUS && (
                            <span className="text-[10px]" title="Acción cotizada en mercado estadounidense (NASDAQ/NYSE)">🇺🇸</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-normal">{it.symbol}</div>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${it.fiscal.badgeStyle}`}>
                          {it.fiscal.categoryLabel}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center font-bold tabular-nums text-foreground">
                        {it.pct}%
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap font-mono text-[11px] font-semibold text-foreground/90">
                        {it.fiscal.casillas}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-foreground font-semibold">
                        {fmt(it.sCur)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {fmt(it.sInv)}
                      </td>
                      <td className={`py-2 px-2 text-right tabular-nums font-bold ${it.sPL >= 0 ? "text-positive print-positive" : "text-destructive print-destructive"}`}>
                        {fmtSigned(it.sPL)}
                      </td>
                      <td className="py-2 px-2 text-center font-bold tabular-nums text-foreground">
                        {it.sPL > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px]">
                            {effectiveTaxRate.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">0%</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold text-amber-500">
                        {it.sPL > 0 ? `-${fmt(it.sTax)}` : fmt(0)}
                      </td>
                      <td className="py-2 px-2.5 text-center whitespace-nowrap text-[10px]">
                        {it.fiscal.isUS ? (
                          hasW8BEN ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold" title="Exención total de retención en EE.UU. por venta de acciones (art. 13 convenio). Tributa solo en España.">
                              0% ret. USA (Exento art. 13)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 font-bold" title="Sin W-8BEN se aplica retención del 30% por el IRS">
                              30% ret. USA (Sin W-8BEN)
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground font-medium">{it.fiscal.w8benStatus}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {activeSaleItems.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border/60 bg-secondary/50 font-bold print-total-row">
                    <td colSpan={4} className="py-2.5 px-3 text-foreground uppercase tracking-wider text-[11px]">
                      Total Consolidado de la Simulación
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-foreground">
                      {fmt(totalCurrent)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">
                      {fmt(totalInvested)}
                    </td>
                    <td className={`py-2.5 px-2 text-right tabular-nums font-black ${totalGain >= 0 ? "text-positive print-positive" : "text-destructive print-destructive"}`}>
                      {fmtSigned(totalGain)}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-amber-500 text-[10px]">
                      {effectiveTaxRate.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-bold text-amber-500">
                      -{fmt(taxCalculation.tax)}
                    </td>
                    <td className="py-2.5 px-2.5 text-center text-muted-foreground text-[10px]">
                      {hasW8BEN ? "Convenio España - EE.UU." : "Régimen General"}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Guía Oficial de Casillas de la Agencia Tributaria (Modelo 100) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 border-t border-border/30 pt-4 print-avoid-break">
          <div className="print-info-box p-3.5 rounded-xl bg-secondary/25 border border-border/40 flex flex-col gap-2 text-xs">
            <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
              <span>📌</span>
              <span>1. Casillas Oficiales de Declaración (Modelo 100):</span>
            </span>
            <div className="flex flex-col gap-1.5 text-muted-foreground leading-relaxed text-[11px]">
              <p>
                • <strong className="text-foreground">Acciones Cotizadas (España y Extranjeras):</strong> <strong>Casillas 0308, 0309 y 0310</strong> (Transmisión de acciones negociadas: valor de transmisión, valor de adquisición con gastos deducibles y resultado neto).
              </p>
              <p>
                • <strong className="text-foreground">ETFs y Fondos de Inversión (IIC):</strong> <strong>Casillas 0326 a 0338</strong> (Transmisiones de participaciones en fondos y ETFs cotizados).
              </p>
              <p>
                • <strong className="text-foreground">Criptomonedas:</strong> <strong>Casillas 1800 a 1804</strong> (Ganancias y pérdidas patrimoniales por transmisión de monedas virtuales).
              </p>
              <p>
                • <strong className="text-foreground">Dividendos y Gastos de Custodia:</strong> <strong>Casilla 0029</strong> (Ingresos íntegros por dividendos percibidos, retenciones y deducción de gastos de custodia/administración del bróker).
              </p>
              <p>
                • <strong className="text-foreground">Doble Imposición Internacional (Acciones Extranjeras):</strong> <strong>Casilla 0588</strong> (Deducción de impuestos retenidos en origen en el extranjero, como el 15% de EE.UU. en dividendos con W-8BEN, hasta el límite fijado en el convenio).
              </p>
              <p>
                • <strong className="text-foreground">Retenciones Soportadas en España:</strong> <strong>Casilla 0596</strong> (Retenciones a cuenta deducibles de la cuota líquida).
              </p>
            </div>
          </div>

          <div className="print-info-box p-3.5 rounded-xl bg-secondary/25 border border-border/40 flex flex-col gap-2 text-xs">
            <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
              <span>⚖️</span>
              <span>2. Escala por Cantidad de Ganancia & Formulario W-8BEN:</span>
            </span>
            <div className="flex flex-col gap-1.5 text-muted-foreground leading-relaxed text-[11px]">
              <p>
                • <strong className="text-foreground">Cálculo del Tipo de IRPF por Cantidad de Ganancia:</strong> La plusvalía tributa progresivamente en la Base del Ahorro: <strong>19%</strong> hasta 6.000 €, <strong>21%</strong> de 6.000 € a 50.000 €, <strong>23%</strong> de 50.000 € a 200.000 €, <strong>27%</strong> de 200.000 € a 300.000 € y <strong>28%</strong> más de 300.000 €. Por eso, el tipo impositivo efectivo de cada acción lo determina el beneficio total acumulado.
              </p>
              <p>
                • <strong className="text-foreground">Formulario W-8BEN (Acciones de EE.UU.):</strong> Certifica tu residencia fiscal en España ante el IRS estadounidense para acogerse al Convenio de Doble Imposición:
                <br />
                - <em>Venta de Acciones (Plusvalías)</em>: <strong>0% de retención en EE.UU.</strong> (exención total bajo el art. 13 del convenio). Tributa 100% en España en el IRPF.
                <br />
                - <em>Dividendos</em>: Retención reducida en EE.UU. del 30% al <strong>15%</strong> (deducible en España en la <strong>Casilla 0588</strong>).
              </p>
              <p>
                • <strong className="text-foreground">Compensación y Regla de 2 Meses:</strong> Las minusvalías compensan plusvalías y hasta el 25% de dividendos (casillas 0392 a 0404, arrastre 4 años). No recomprar títulos homogéneos en los 2 meses anteriores o posteriores a la venta con pérdidas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
