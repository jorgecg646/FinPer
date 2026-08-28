"use client"

import { useState, useMemo } from "react"
import type { Tx } from "@/app/actions"
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Flame,
  Coffee,
  ShoppingBag,
  Car,
  Utensils,
  Smartphone,
  Plane,
  Home,
  CheckCircle2,
  Sliders,
  DollarSign,
  ArrowRight,
  Info,
} from "lucide-react"

export type MicroPreset = {
  id: string
  name: string
  icon: string
  amount: number
  frequency: "daily_work" | "daily_all" | "weekend" | "twice_week" | "weekly" | "monthly"
  freqLabel: string
  annualOccurrences: number
  description: string
  emoji: string
}

const PRESETS: MicroPreset[] = [
  {
    id: "coffee",
    name: "Café fuera de casa",
    icon: "Coffee",
    emoji: "☕",
    amount: 1.6,
    frequency: "daily_work",
    freqLabel: "Días laborables (5/sem)",
    annualOccurrences: 250,
    description: "Café de media mañana o en el bar del trabajo",
  },
  {
    id: "breakfast",
    name: "Desayuno / Tostada / Snack",
    icon: "Utensils",
    emoji: "🥪",
    amount: 3.5,
    frequency: "daily_work",
    freqLabel: "Días laborables (5/sem)",
    annualOccurrences: 250,
    description: "Desayuno o pincho en cafetería",
  },
  {
    id: "vending",
    name: "Máquina Vending / Refrescos",
    icon: "ShoppingBag",
    emoji: "🥤",
    amount: 1.8,
    frequency: "daily_work",
    freqLabel: "Días laborables (5/sem)",
    annualOccurrences: 250,
    description: "Bebidas energéticas, refrescos o snacks rápidos",
  },
  {
    id: "tobacco",
    name: "Tabaco / Vape",
    icon: "Flame",
    emoji: "🚬",
    amount: 5.5,
    frequency: "daily_all",
    freqLabel: "Todos los días (7/sem)",
    annualOccurrences: 365,
    description: "Cajetilla o recargas diarias",
  },
  {
    id: "delivery",
    name: "Delivery / Comida rápida",
    icon: "Utensils",
    emoji: "🛵",
    amount: 18.0,
    frequency: "weekly",
    freqLabel: "1 vez por semana",
    annualOccurrences: 52,
    description: "Cenas a domicilio por pereza de cocinar",
  },
  {
    id: "taxi",
    name: "Taxi / VTC de conveniencia",
    icon: "Car",
    emoji: "🚕",
    amount: 12.0,
    frequency: "weekly",
    freqLabel: "1 vez por semana",
    annualOccurrences: 52,
    description: "Trayectos evitables en transporte público o a pie",
  },
  {
    id: "online_caprice",
    name: "Caprichos online pequeños",
    icon: "ShoppingBag",
    emoji: "📦",
    amount: 25.0,
    frequency: "monthly",
    freqLabel: "1 vez al mes",
    annualOccurrences: 12,
    description: "Pequeñas compras impulsivas en marketplaces",
  },
]

const FREQUENCY_OPTIONS = [
  { value: "daily_all", label: "Todos los días (7 días/sem)", occurrences: 365, factorName: "diario" },
  { value: "daily_work", label: "Días laborables (5 días/sem)", occurrences: 250, factorName: "laborable" },
  { value: "weekend", label: "Fines de semana (2 días/sem)", occurrences: 104, factorName: "fin de semana" },
  { value: "twice_week", label: "2 veces por semana", occurrences: 104, factorName: "2/sem" },
  { value: "weekly", label: "1 vez por semana", occurrences: 52, factorName: "semanal" },
  { value: "biweekly", label: "Cada 2 semanas", occurrences: 26, factorName: "quincenal" },
  { value: "monthly", label: "1 vez al mes", occurrences: 12, factorName: "mensual" },
]

function calculateCompound(monthlyAmount: number, annualReturnPct: number, years: number) {
  const months = years * 12
  const monthlyRate = annualReturnPct / 100 / 12
  let totalInvested = 0
  let compoundBalance = 0

  for (let m = 0; m < months; m++) {
    totalInvested += monthlyAmount
    if (monthlyRate > 0) {
      compoundBalance = (compoundBalance + monthlyAmount) * (1 + monthlyRate)
    } else {
      compoundBalance += monthlyAmount
    }
  }

  const interestEarned = Math.max(0, compoundBalance - totalInvested)
  return {
    years,
    totalInvested: Math.round(totalInvested),
    compoundBalance: Math.round(compoundBalance),
    interestEarned: Math.round(interestEarned),
    multiplier: totalInvested > 0 ? (compoundBalance / totalInvested).toFixed(1) : "1.0",
  }
}

export function MicroExpensesLongTermCalculator({ transactions = [] }: { transactions?: Tx[] }) {
  // Default to 'detected' tab so user's actual expenses appear first!
  const [activeTab, setActiveTab] = useState<"detected" | "simulator" | "presets">("detected")

  // Custom Simulator States
  const [expenseName, setExpenseName] = useState("Café y snack matutino")
  const [amount, setAmount] = useState<number>(2.5)
  const [frequencyKey, setFrequencyKey] = useState<string>("daily_work")
  const [returnPct, setReturnPct] = useState<number>(7.0) // 7% historical index average
  const [reductionPct, setReductionPct] = useState<number>(50) // 50% cutback simulation
  const [hoveredYear, setHoveredYear] = useState<number | null>(10)

  // Frequency math
  const selectedFreq = FREQUENCY_OPTIONS.find((f) => f.value === frequencyKey) ?? FREQUENCY_OPTIONS[1]
  const annualSpent = amount * selectedFreq.occurrences
  const monthlySpent = annualSpent / 12
  const dailySpent = annualSpent / 365

  // Calculations for milestones
  const projection = useMemo(() => {
    const years = [1, 3, 5, 10, 15, 20, 25, 30]
    return years.map((y) => calculateCompound(monthlySpent, returnPct, y))
  }, [monthlySpent, returnPct])

  // Reduced scenario math
  const reducedAnnualSpent = annualSpent * (1 - reductionPct / 100)
  const reducedMonthlySpent = monthlySpent * (1 - reductionPct / 100)
  const monthlySaved = monthlySpent - reducedMonthlySpent
  const annualSaved = annualSpent - reducedAnnualSpent
  const tenYearsCompoundSaved = useMemo(() => {
    return calculateCompound(monthlySaved, returnPct, 10)
  }, [monthlySaved, returnPct])

  // Auto-detect real transactions <= 10€ from transactions prop
  const detectedMicro = useMemo(() => {
    const microTxs = transactions.filter((t) => t.type === "expense" && t.amount <= 10 && t.amount > 0)
    const totalAllExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    const totalMicro = microTxs.reduce((s, t) => s + t.amount, 0)
    const count = microTxs.length
    const avgTicket = count > 0 ? totalMicro / count : 0
    const pctOfTotal = totalAllExpense > 0 ? (totalMicro / totalAllExpense) * 100 : 0

    // Group by category
    const catMap = new Map<string, { total: number; count: number }>()
    for (const t of microTxs) {
      const cur = catMap.get(t.category) || { total: 0, count: 0 }
      catMap.set(t.category, { total: cur.total + t.amount, count: cur.count + 1 })
    }
    const categories = [...catMap.entries()]
      .map(([cat, data]) => ({
        category: cat,
        total: data.total,
        count: data.count,
        avg: data.total / data.count,
      }))
      .sort((a, b) => b.total - a.total)

    // Estimate monthly from detected transactions (assuming transactions cover the selected year or recorded months)
    const estimatedMonthly = totalMicro > 0 ? totalMicro / 12 : 0
    const compound10Years = calculateCompound(estimatedMonthly, returnPct, 10)
    const compound20Years = calculateCompound(estimatedMonthly, returnPct, 20)

    return {
      count,
      totalMicro,
      avgTicket,
      pctOfTotal,
      categories,
      estimatedMonthly,
      compound10Years,
      compound20Years,
    }
  }, [transactions, returnPct])

  // Chart SVG Points
  const maxBalance = Math.max(...projection.map((p) => p.compoundBalance), 100)
  const svgWidth = 600
  const svgHeight = 220
  const padLeft = 60
  const padRight = 30
  const padTop = 20
  const padBottom = 35
  const chartW = svgWidth - padLeft - padRight
  const chartH = svgHeight - padTop - padBottom
  const baseline = padTop + chartH

  const pointsCompound = projection.map((p, idx) => {
    const x = padLeft + (idx / (projection.length - 1)) * chartW
    const y = baseline - (p.compoundBalance / maxBalance) * chartH
    return { x, y, ...p }
  })

  const pointsSpent = projection.map((p, idx) => {
    const x = padLeft + (idx / (projection.length - 1)) * chartW
    const y = baseline - (p.totalInvested / maxBalance) * chartH
    return { x, y, ...p }
  })

  const pathCompound = pointsCompound.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "")
  const pathSpent = pointsSpent.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "")

  const areaCompound = `${pathCompound} L ${pointsCompound[pointsCompound.length - 1].x} ${baseline} L ${pointsCompound[0].x} ${baseline} Z`
  const areaSpent = `${pathSpent} L ${pointsSpent[pointsSpent.length - 1].x} ${baseline} L ${pointsSpent[0].x} ${baseline} Z`

  function applyPreset(p: MicroPreset) {
    setExpenseName(p.name)
    setAmount(p.amount)
    setFrequencyKey(p.frequency)
    setActiveTab("simulator")
  }

  function simulateCategory(cat: { category: string; avg: number; count: number }) {
    setExpenseName(`Micro-gastos en ${cat.category}`)
    setAmount(Number(cat.avg.toFixed(2)))
    // Guess frequency based on count
    if (cat.count >= 200) setFrequencyKey("daily_work")
    else if (cat.count >= 90) setFrequencyKey("twice_week")
    else if (cat.count >= 40) setFrequencyKey("weekly")
    else setFrequencyKey("monthly")
    setActiveTab("simulator")
  }

  const activeMilestone = projection.find((p) => p.years === hoveredYear) || projection[3] // Default 10 years

  return (
    <section className="rounded-3xl bg-gradient-to-br from-card via-background to-amber-950/10 p-5 sm:p-7 shadow-xl border border-amber-500/20 backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30 text-xl font-bold">
            🐜
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                Calculadora de Impacto del Gasto Hormiga a Largo Plazo
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Interés Compuesto
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Descubre el verdadero coste de oportunidad acumulado de tus pequeños consumos cotidianos
            </p>
          </div>
        </div>

        {/* Tab Switcher — Detected Real Expenses first! */}
        <div className="flex items-center rounded-2xl bg-secondary/60 p-1 border border-border/40 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("detected")}
            className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "detected"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🔍 Mis Gastos Reales ({detectedMicro.count})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("simulator")}
            className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "simulator"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🔬 Simulador Libre
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("presets")}
            className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "presets"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ⚡ Presets Rápidos
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 1 (PRIMARY): GASTOS HORMIGA DETECTADOS REALES
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "detected" && (
        <div className="mt-6 flex flex-col gap-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-secondary/40 border border-border/40">
            <div>
              <h3 className="text-sm font-extrabold text-foreground">
                Tus compras de importe reducido (≤ 10 €) en la base de datos
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Detectados automáticamente analizando tus movimientos reales del año seleccionado
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {detectedMicro.count} micro-compras
              </span>
            </div>
          </div>

          {/* Flashcards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-card border border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground font-semibold">Total Gastado Hormiga</p>
              <p className="text-base font-black text-destructive mt-0.5">
                {detectedMicro.totalMicro.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-card border border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground font-semibold">% de tu Gasto Total</p>
              <p className="text-base font-black text-foreground mt-0.5">
                {detectedMicro.pctOfTotal.toFixed(1)}%
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-card border border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground font-semibold">Ticket Medio Hormiga</p>
              <p className="text-base font-black text-foreground mt-0.5">
                {detectedMicro.avgTicket.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
              <p className="text-[10px] text-emerald-400 font-semibold">Impacto a 10 Años (7%)</p>
              <p className="text-base font-black text-emerald-400 mt-0.5">
                {detectedMicro.compound10Years.compoundBalance.toLocaleString("es-ES")} €
              </p>
            </div>
          </div>

          {/* Breakdown by Category with Click-to-Simulate */}
          <div className="rounded-2xl bg-card/60 p-4 border border-border/40">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-foreground">
                Desglose por Categoría & Simulación Directa
              </h4>
              <span className="text-[10px] text-muted-foreground">
                Haz clic en cualquier categoría para simularla en la curva
              </span>
            </div>
            {detectedMicro.categories.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No tienes gastos registrados inferiores a 10 €. ¡Excelente control de gastos hormiga!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {detectedMicro.categories.map((c) => {
                  const pct = detectedMicro.totalMicro > 0 ? (c.total / detectedMicro.totalMicro) * 100 : 0
                  return (
                    <div
                      key={c.category}
                      onClick={() => simulateCategory(c)}
                      className="cursor-pointer group p-3 rounded-xl bg-background/70 hover:bg-secondary/40 border border-border/40 hover:border-amber-500/50 transition-all flex flex-col justify-between gap-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="font-extrabold text-foreground group-hover:text-amber-400 transition-colors">
                            {c.category}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {c.count} compras · media {c.avg.toFixed(2)} €
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-destructive">{c.total.toFixed(2)} €</p>
                          <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</p>
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-border/20 flex items-center justify-between text-[10px] text-amber-400 font-bold">
                        <span>Simular en la curva</span>
                        <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 2: SIMULADOR INTERACTIVO
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "simulator" && (
        <div className="mt-6 flex flex-col gap-6 animate-in fade-in duration-200">
          {/* Top Config Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-secondary/30 p-4 sm:p-5 rounded-2xl border border-border/40">
            {/* Input 1: Concepto y Cantidad */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-extrabold text-foreground flex items-center justify-between">
                <span>Concepto / Gasto:</span>
                <span className="text-[10px] text-muted-foreground font-normal">Personalizable</span>
              </label>
              <input
                type="text"
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                placeholder="Ej. Café, merienda, taxi..."
                className="w-full rounded-xl bg-background px-3 py-2 text-xs font-bold text-foreground border border-border/50 focus:border-amber-500 focus:outline-none"
              />
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-muted-foreground font-semibold">Coste unitario:</span>
                <span className="text-sm font-black text-amber-400">
                  {amount.toFixed(2)} €
                </span>
              </div>
              <input
                type="range"
                min="0.50"
                max="30"
                step="0.10"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="accent-amber-500 cursor-pointer h-1.5 bg-secondary rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0,50 €</span>
                <span>10 €</span>
                <span>20 €</span>
                <span>30 €</span>
              </div>
            </div>

            {/* Input 2: Frecuencia */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-extrabold text-foreground">
                Frecuencia del Gasto:
              </label>
              <select
                value={frequencyKey}
                onChange={(e) => setFrequencyKey(e.target.value)}
                aria-label="Frecuencia del gasto"
                className="w-full rounded-xl bg-background px-3 py-2 text-xs font-bold text-foreground border border-border/50 focus:border-amber-500 focus:outline-none cursor-pointer"
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="p-2 rounded-xl bg-background/50 border border-border/30 text-[11px] text-muted-foreground">
                Ocurre <strong className="text-foreground font-black">{selectedFreq.occurrences} veces al año</strong> (aprox. {Math.round(selectedFreq.occurrences / 12)} veces/mes).
              </div>
            </div>

            {/* Input 3: Rentabilidad Inversión Alternativa */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-foreground">
                  Rentabilidad Anual Estimada:
                </label>
                <span className="text-xs font-black text-emerald-400">
                  {returnPct.toFixed(1)}% anual
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="0.5"
                value={returnPct}
                onChange={(e) => setReturnPct(Number(e.target.value))}
                className="accent-emerald-500 cursor-pointer h-1.5 bg-secondary rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0% (Hucha)</span>
                <span>4% (Depósito)</span>
                <span>7% (Bolsa Global)</span>
                <span>10% (S&P 500)</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Si en vez de gastar ese dinero lo invirtieses mensualmente en un fondo indexado diversificado.
              </p>
            </div>
          </div>

          {/* Quick Metrics Flashcards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/40 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Coste Diario</span>
              <span className="text-lg font-black text-foreground mt-1">{dailySpent.toFixed(2)} €</span>
              <span className="text-[10px] text-muted-foreground">Por día natural</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Coste Mensual</span>
              <span className="text-lg font-black text-amber-400 mt-1">{monthlySpent.toFixed(2)} €</span>
              <span className="text-[10px] text-muted-foreground">Se te escapa cada mes</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/30 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-destructive">Coste Anual</span>
              <span className="text-lg font-black text-destructive mt-1">{annualSpent.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €</span>
              <span className="text-[10px] text-muted-foreground">En 1 solo año</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">En 10 Años (Invertido)</span>
              <span className="text-lg font-black text-emerald-400 mt-1">
                {projection[3].compoundBalance.toLocaleString("es-ES")} €
              </span>
              <span className="text-[10px] text-emerald-400/80 font-bold">
                +{(projection[3].compoundBalance - projection[3].totalInvested).toLocaleString("es-ES")} € intereses
              </span>
            </div>
          </div>

          {/* Interactive Chart & Milestones Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* SVG Visual Curve Chart (7 cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-card/60 p-4 sm:p-5 rounded-2xl border border-border/40 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-foreground flex items-center gap-2">
                    <span>Curva de Impacto Acumulado</span>
                  </h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Dinero perdido en consumo vs Capital si se invierte al {returnPct}%
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <span className="flex items-center gap-1 text-destructive">
                    <span className="h-2 w-2 rounded-full bg-destructive" /> Gasto puro
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Con Interés
                  </span>
                </div>
              </div>

              {/* Chart SVG */}
              <div className="relative w-full overflow-hidden">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto select-none"
                  role="img"
                  aria-label="Gráfico de proyección de ahorro e interés compuesto"
                  aria-labelledby="micro-expenses-chart-title"
                >
                  <title id="micro-expenses-chart-title">Proyección de ahorro e interés compuesto</title>
                  <defs>
                    <linearGradient id="gradCompound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="gradSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = baseline - ratio * chartH
                    const val = Math.round(ratio * maxBalance)
                    return (
                      <g key={ratio}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={svgWidth - padRight}
                          y2={y}
                          stroke="currentColor"
                          className="text-border/40"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={padLeft - 8}
                          y={y + 3}
                          textAnchor="end"
                          className="text-[9px] fill-muted-foreground font-mono"
                        >
                          {val >= 1000 ? `${(val / 1000).toFixed(0)}k€` : `${val}€`}
                        </text>
                      </g>
                    )
                  })}

                  {/* Areas */}
                  <path d={areaCompound} fill="url(#gradCompound)" />
                  <path d={areaSpent} fill="url(#gradSpent)" />

                  {/* Lines */}
                  <path d={pathCompound} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                  <path d={pathSpent} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />

                  {/* Data Points */}
                  {pointsCompound.map((pt, i) => {
                    const isHover = hoveredYear === pt.years
                    return (
                      <g
                        key={pt.years}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredYear(pt.years)}
                      >
                        {/* Vertical Guide */}
                        {isHover && (
                          <line
                            x1={pt.x}
                            y1={padTop}
                            x2={pt.x}
                            y2={baseline}
                            stroke="#10b981"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                            opacity="0.8"
                          />
                        )}
                        {/* Spent Dot */}
                        <circle
                          cx={pointsSpent[i].x}
                          cy={pointsSpent[i].y}
                          r={isHover ? 4 : 2.5}
                          fill="#ef4444"
                        />
                        {/* Compound Dot */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHover ? 6 : 3.5}
                          fill="#10b981"
                          stroke="#ffffff"
                          strokeWidth={isHover ? 2 : 1}
                        />
                        {/* X Axis Labels */}
                        <text
                          x={pt.x}
                          y={baseline + 16}
                          textAnchor="middle"
                          className={`text-[9px] font-bold ${
                            isHover ? "fill-emerald-400 font-extrabold" : "fill-muted-foreground"
                          }`}
                        >
                          {pt.years}a
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* Active Point Card Callout */}
              <div className="mt-3 p-3 rounded-xl bg-background/80 border border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-black text-[11px]">
                    Hito: {activeMilestone.years} {activeMilestone.years === 1 ? "año" : "años"}
                  </span>
                  <span className="text-muted-foreground">
                    Gastado: <strong className="text-destructive font-black">{activeMilestone.totalInvested.toLocaleString("es-ES")} €</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    Si lo inviertes: <strong className="text-emerald-400 font-black">{activeMilestone.compoundBalance.toLocaleString("es-ES")} €</strong>
                  </span>
                  <span className="text-[10px] text-emerald-400/90 font-extrabold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    (x{activeMilestone.multiplier})
                  </span>
                </div>
              </div>
            </div>

            {/* Milestones & Real-Life Equivalences (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-3 bg-card/60 p-4 sm:p-5 rounded-2xl border border-border/40 shadow-xs">
              <h3 className="text-xs sm:text-sm font-extrabold text-foreground flex items-center gap-2">
                <span>¿Qué podrías comprar con ese dinero?</span>
              </h3>

              <div className="flex flex-col gap-2.5">
                {/* 1 Year */}
                <div className="p-2.5 rounded-xl bg-background/70 border border-border/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">✈️</span>
                    <div>
                      <p className="text-xs font-black text-foreground">En 1 año ({projection[0].totalInvested.toLocaleString("es-ES")} €)</p>
                      <p className="text-[10px] text-muted-foreground">Unas vacaciones completas o escapada europea</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-400 shrink-0">1 año</span>
                </div>

                {/* 5 Years */}
                <div className="p-2.5 rounded-xl bg-background/70 border border-border/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">💻</span>
                    <div>
                      <p className="text-xs font-black text-foreground">En 5 años ({projection[2].compoundBalance.toLocaleString("es-ES")} €)</p>
                      <p className="text-[10px] text-muted-foreground">MacBook Pro M-Series + smartphone de gama alta</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-400 shrink-0">5 años</span>
                </div>

                {/* 10 Years */}
                <div className="p-2.5 rounded-xl bg-background/70 border border-border/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🚗</span>
                    <div>
                      <p className="text-xs font-black text-foreground">En 10 años ({projection[3].compoundBalance.toLocaleString("es-ES")} €)</p>
                      <p className="text-[10px] text-muted-foreground">Un coche utilitario nuevo al contado</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 shrink-0">10 años</span>
                </div>

                {/* 20 Years */}
                <div className="p-2.5 rounded-xl bg-background/70 border border-border/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🏡</span>
                    <div>
                      <p className="text-xs font-black text-foreground">En 20 años ({projection[5].compoundBalance.toLocaleString("es-ES")} €)</p>
                      <p className="text-[10px] text-muted-foreground">La entrada completa + gastos para comprar una vivienda</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 shrink-0">20 años</span>
                </div>
              </div>

              {/* Reduction Simulator Mini Box */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/30">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-extrabold text-foreground flex items-center gap-1.5">
                    <span>💡 Plan de Recorte: Reducir al</span>
                    <select
                      value={reductionPct}
                      onChange={(e) => setReductionPct(Number(e.target.value))}
                      aria-label="Porcentaje de reducción de gasto"
                      className="bg-background px-1.5 py-0.5 rounded text-xs font-black text-emerald-400 border border-emerald-500/40 cursor-pointer"
                    >
                      <option value="30">30%</option>
                      <option value="50">50% (-mitad)</option>
                      <option value="70">70%</option>
                      <option value="100">100% (eliminar)</option>
                    </select>
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Ahorras <strong className="text-emerald-400 font-bold">+{monthlySaved.toFixed(0)} €/mes</strong> ({annualSaved.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €/año).
                  En 10 años invertido tendrías <strong className="text-foreground font-black">+{tenYearsCompoundSaved.compoundBalance.toLocaleString("es-ES")} €</strong> en tu cuenta.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 3: PRESETS RÁPIDOS
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "presets" && (
        <div className="mt-6 flex flex-col gap-4 animate-in fade-in duration-200">
          <p className="text-xs text-muted-foreground">
            Haz clic en cualquier hábito cotidiano para cargar automáticamente sus cifras en el simulador de interés compuesto:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PRESETS.map((p) => {
              const annual = p.amount * p.annualOccurrences
              const monthly = annual / 12
              const tenY = calculateCompound(monthly, 7.0, 10)

              return (
                <div
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className="cursor-pointer p-4 rounded-2xl bg-card hover:bg-secondary/40 border border-border/50 hover:border-amber-500/50 transition-all shadow-xs hover:shadow-md flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 group-hover:scale-110 transition-transform">
                        {p.emoji}
                      </span>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-foreground group-hover:text-amber-400 transition-colors">
                          {p.name}
                        </h4>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {p.amount.toFixed(2)} € · {p.freqLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {p.description}
                  </p>

                  <div className="pt-2.5 border-t border-border/30 flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold">Al año:</p>
                      <p className="font-black text-destructive">{annual.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-emerald-400 font-semibold">En 10 años al 7%:</p>
                      <p className="font-black text-emerald-400">{tenY.compoundBalance.toLocaleString("es-ES")} €</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full mt-1 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 font-extrabold text-[11px] hover:bg-amber-500 hover:text-black transition-colors flex items-center justify-center gap-1"
                  >
                    <span>Simular este gasto</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
