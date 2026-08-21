"use client"

import { useState, useMemo } from "react"
import type { Summary, Tx } from "@/app/actions"
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Flame,
  Car,
  Home,
  Briefcase,
  Scissors,
  Baby,
  RefreshCw,
  Sliders,
  DollarSign,
  ShieldCheck,
  Calendar,
  ArrowRight,
  CheckCircle2,
} from "lucide-react"

type ScenarioPreset = {
  id: string
  title: string
  emoji: string
  description: string
  incomeDeltaMonthly: number
  fixedExpenseDeltaMonthly: number
  variableExpenseDeltaPct: number
  oneTimeExpense: number
}

const PRESETS: ScenarioPreset[] = [
  {
    id: "salary_raise",
    title: "Subida de Sueldo (+15%)",
    emoji: "🚀",
    description: "Aumento salarial neto o nuevo ingreso recurrente",
    incomeDeltaMonthly: 300,
    fixedExpenseDeltaMonthly: 0,
    variableExpenseDeltaPct: 0,
    oneTimeExpense: 0,
  },
  {
    id: "car_purchase",
    title: "Compra de Coche con Cuota",
    emoji: "🚗",
    description: "Nueva cuota mensual de financiación + seguro",
    incomeDeltaMonthly: 0,
    fixedExpenseDeltaMonthly: 240,
    variableExpenseDeltaPct: 0,
    oneTimeExpense: 1500, // entrada o seguro inicial
  },
  {
    id: "rent_increase",
    title: "Subida de Alquiler / Hipoteca",
    emoji: "🏠",
    description: "Incremento en el coste mensual de la vivienda",
    incomeDeltaMonthly: 0,
    fixedExpenseDeltaMonthly: 150,
    variableExpenseDeltaPct: 0,
    oneTimeExpense: 0,
  },
  {
    id: "job_loss",
    title: "Pérdida Temporal de Empleo",
    emoji: "⚠️",
    description: "Paso a prestación por desempleo o cese de actividad",
    incomeDeltaMonthly: -800,
    fixedExpenseDeltaMonthly: 0,
    variableExpenseDeltaPct: -20, // ajuste obligado de gastos
    oneTimeExpense: 0,
  },
  {
    id: "frugal_mode",
    title: "Modo Ahorro Espartano",
    emoji: "✂️",
    description: "Recorte del 30% en ocio, restaurantes y caprichos",
    incomeDeltaMonthly: 0,
    fixedExpenseDeltaMonthly: -50,
    variableExpenseDeltaPct: -30,
    oneTimeExpense: 0,
  },
  {
    id: "baby",
    title: "Nuevo Miembro en la Familia",
    emoji: "👶",
    description: "Nuevos gastos en guardería, alimentación y cuidados",
    incomeDeltaMonthly: 0,
    fixedExpenseDeltaMonthly: 280,
    variableExpenseDeltaPct: 15,
    oneTimeExpense: 1200, // cuna, carrito, compras iniciales
  },
]

export function ScenarioSimulator({
  summary,
  transactions = [],
}: {
  summary: Summary
  transactions?: Tx[]
}) {
  // Base monthly averages calculated from actual data
  const baseMonthlyIncome = summary.income > 0 ? summary.income / 12 : 2000
  const baseMonthlyExpense = summary.expenses > 0 ? summary.expenses / 12 : 1400
  const currentBalance = summary.balance

  // Simulation custom knobs
  const [incomeDelta, setIncomeDelta] = useState<number>(0)
  const [fixedExpenseDelta, setFixedExpenseDelta] = useState<number>(0)
  const [variableExpensePct, setVariableExpensePct] = useState<number>(0)
  const [oneTimeExpense, setOneTimeExpense] = useState<number>(0)
  const [scenarioName, setScenarioName] = useState<string>("Mi Escenario Personalizado")
  const [activePresetId, setActivePresetId] = useState<string | null>(null)

  function applyPreset(p: ScenarioPreset) {
    setActivePresetId(p.id)
    setScenarioName(p.title)
    setIncomeDelta(p.incomeDeltaMonthly)
    setFixedExpenseDelta(p.fixedExpenseDeltaMonthly)
    setVariableExpensePct(p.variableExpenseDeltaPct)
    setOneTimeExpense(p.oneTimeExpense)
  }

  function resetToDefaults() {
    setActivePresetId(null)
    setScenarioName("Mi Escenario Personalizado")
    setIncomeDelta(0)
    setFixedExpenseDelta(0)
    setVariableExpensePct(0)
    setOneTimeExpense(0)
  }

  // Calculate simulated monthly and annual metrics
  const sim = useMemo(() => {
    // New monthly income
    const newMonthlyIncome = Math.max(0, baseMonthlyIncome + incomeDelta)

    // Base expense split (roughly 60% fixed, 40% variable if not specified)
    const baseFixed = baseMonthlyExpense * 0.6
    const baseVariable = baseMonthlyExpense * 0.4

    const newFixed = Math.max(0, baseFixed + fixedExpenseDelta)
    const newVariable = Math.max(0, baseVariable * (1 + variableExpensePct / 100))
    const newMonthlyExpense = newFixed + newVariable

    // Monthly net savings
    const baseMonthlyNet = baseMonthlyIncome - baseMonthlyExpense
    const newMonthlyNet = newMonthlyIncome - newMonthlyExpense

    // Savings rates
    const baseSavingsRate = baseMonthlyIncome > 0 ? (baseMonthlyNet / baseMonthlyIncome) * 100 : 0
    const newSavingsRate = newMonthlyIncome > 0 ? (newMonthlyNet / newMonthlyIncome) * 100 : 0

    // Annual projections (12 months + one time cost)
    const baseAnnualSavings = baseMonthlyNet * 12
    const newAnnualSavings = newMonthlyNet * 12 - oneTimeExpense

    // Net Difference
    const annualNetDifference = newAnnualSavings - baseAnnualSavings
    const monthlyNetDifference = newMonthlyNet - baseMonthlyNet

    // Runway / Freedom Months (Current balance / monthly expense)
    const baseRunwayMonths = baseMonthlyExpense > 0 ? currentBalance / baseMonthlyExpense : 0
    const simulatedBalanceAfterOneTime = Math.max(0, currentBalance - oneTimeExpense)
    const newRunwayMonths = newMonthlyExpense > 0 ? simulatedBalanceAfterOneTime / newMonthlyExpense : 0

    // Monthly progression over 12 months for chart
    const monthlyChart = []
    let accBase = currentBalance
    let accSim = simulatedBalanceAfterOneTime

    for (let m = 1; m <= 12; m++) {
      accBase += baseMonthlyNet
      accSim += newMonthlyNet
      monthlyChart.push({
        month: `Mes ${m}`,
        baseBalance: Math.round(accBase),
        simBalance: Math.round(accSim),
      })
    }

    return {
      baseMonthlyIncome,
      newMonthlyIncome,
      baseMonthlyExpense,
      newMonthlyExpense,
      baseMonthlyNet,
      newMonthlyNet,
      baseSavingsRate,
      newSavingsRate,
      baseAnnualSavings,
      newAnnualSavings,
      annualNetDifference,
      monthlyNetDifference,
      baseRunwayMonths,
      newRunwayMonths,
      monthlyChart,
    }
  }, [baseMonthlyIncome, baseMonthlyExpense, currentBalance, incomeDelta, fixedExpenseDelta, variableExpensePct, oneTimeExpense])

  const isPositiveImpact = sim.annualNetDifference >= 0

  return (
    <section className="rounded-3xl bg-gradient-to-br from-card via-background to-indigo-950/10 p-5 sm:p-7 shadow-xl border border-indigo-500/20 backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30 text-xl font-bold">
            🔮
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                Simulador de Escenarios Financieros ("¿Qué pasaría si...?")
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                Stress Test
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Evalúa el impacto en tu ahorro, liquidez y meses de libertad ante cualquier cambio en tu vida
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetToDefaults}
          className="cursor-pointer self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/60 hover:bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground border border-border/40 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Restablecer</span>
        </button>
      </div>

      {/* Quick Presets Carousel */}
      <div className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
          Plantillas Rápidas con 1 Clic:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {PRESETS.map((p) => {
            const isSelected = activePresetId === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={`cursor-pointer p-2.5 rounded-2xl border text-left flex flex-col justify-between gap-2 transition-all ${
                  isSelected
                    ? "bg-indigo-500/20 border-indigo-500 text-foreground ring-1 ring-indigo-500 shadow-sm"
                    : "bg-card hover:bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{p.emoji}</span>
                  {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />}
                </div>
                <div>
                  <p className="text-xs font-extrabold line-clamp-1">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Interactive Sliders & Inputs Box */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 sm:p-5 rounded-2xl bg-secondary/30 border border-border/40">
        {/* Slider 1: Ingresos */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span>Ingresos al Mes:</span>
            </label>
            <span className={`text-xs font-black ${incomeDelta >= 0 ? "text-emerald-400" : "text-destructive"}`}>
              {incomeDelta >= 0 ? "+" : ""}{incomeDelta} €/mes
            </span>
          </div>
          <input
            type="range"
            min="-1500"
            max="2000"
            step="50"
            value={incomeDelta}
            onChange={(e) => {
              setIncomeDelta(Number(e.target.value))
              setActivePresetId(null)
            }}
            className="accent-emerald-500 cursor-pointer h-1.5 bg-secondary rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>-1.500 €</span>
            <span>0 €</span>
            <span>+2.000 €</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Sueldo simulado: <strong className="text-foreground font-black">{Math.round(sim.newMonthlyIncome).toLocaleString("es-ES")} €/mes</strong>
          </p>
        </div>

        {/* Slider 2: Gastos Fijos (Alquiler, cuotas, suministros) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5 text-amber-400" />
              <span>Gastos Fijos / Mes:</span>
            </label>
            <span className={`text-xs font-black ${fixedExpenseDelta > 0 ? "text-destructive" : fixedExpenseDelta < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
              {fixedExpenseDelta >= 0 ? "+" : ""}{fixedExpenseDelta} €/mes
            </span>
          </div>
          <input
            type="range"
            min="-500"
            max="1000"
            step="25"
            value={fixedExpenseDelta}
            onChange={(e) => {
              setFixedExpenseDelta(Number(e.target.value))
              setActivePresetId(null)
            }}
            className="accent-amber-500 cursor-pointer h-1.5 bg-secondary rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>-500 €</span>
            <span>0 €</span>
            <span>+1.000 €</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Alquiler, hipoteca, letras de préstamos o cuotas fijas.
          </p>
        </div>

        {/* Slider 3: Gastos Variables / Estilo de Vida (% recorte o aumento) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
              <Scissors className="h-3.5 w-3.5 text-indigo-400" />
              <span>Ocio & Variables (%):</span>
            </label>
            <span className={`text-xs font-black ${variableExpensePct > 0 ? "text-destructive" : variableExpensePct < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
              {variableExpensePct >= 0 ? "+" : ""}{variableExpensePct}%
            </span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            step="5"
            value={variableExpensePct}
            onChange={(e) => {
              setVariableExpensePct(Number(e.target.value))
              setActivePresetId(null)
            }}
            className="accent-indigo-500 cursor-pointer h-1.5 bg-secondary rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>-50% (Recorte)</span>
            <span>0%</span>
            <span>+50% (Desmadre)</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Restaurantes, compras, viajes y ocio cotidiano.
          </p>
        </div>

        {/* Slider 4: Gasto Extraordinario Puntual */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-rose-400" />
              <span>Imprevisto / Puntual:</span>
            </label>
            <span className="text-xs font-black text-rose-400">
              {oneTimeExpense > 0 ? `-${oneTimeExpense} €` : "0 €"}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="5000"
            step="100"
            value={oneTimeExpense}
            onChange={(e) => {
              setOneTimeExpense(Number(e.target.value))
              setActivePresetId(null)
            }}
            className="accent-rose-500 cursor-pointer h-1.5 bg-secondary rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0 €</span>
            <span>2.500 €</span>
            <span>5.000 €</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Avería coche, fianza, reforma o compra grande única.
          </p>
        </div>
      </div>

      {/* Comparison Scoreboard Flashcards */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Ahorro Neto Mensual */}
        <div className="p-4 rounded-2xl bg-card border border-border/40 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Ahorro Neto Mensual
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-xl font-black ${sim.newMonthlyNet >= 0 ? "text-emerald-400" : "text-destructive"}`}>
              {sim.newMonthlyNet >= 0 ? "+" : ""}{Math.round(sim.newMonthlyNet).toLocaleString("es-ES")} €
            </span>
            <span className="text-xs text-muted-foreground">
              (era {sim.baseMonthlyNet >= 0 ? "+" : ""}{Math.round(sim.baseMonthlyNet).toLocaleString("es-ES")} €)
            </span>
          </div>
          <div className="mt-2 text-[11px] font-bold flex items-center gap-1">
            <span className={sim.monthlyNetDifference >= 0 ? "text-emerald-400" : "text-destructive"}>
              {sim.monthlyNetDifference >= 0 ? "▲ +" : "▼ "}{Math.round(sim.monthlyNetDifference).toLocaleString("es-ES")} €/mes
            </span>
            <span className="text-muted-foreground font-normal">de diferencia</span>
          </div>
        </div>

        {/* Card 2: Tasa de Ahorro */}
        <div className="p-4 rounded-2xl bg-card border border-border/40 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Tasa de Ahorro (% Ingresos)
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-xl font-black ${sim.newSavingsRate >= 20 ? "text-emerald-400" : sim.newSavingsRate >= 0 ? "text-amber-400" : "text-destructive"}`}>
              {sim.newSavingsRate.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">
              (era {sim.baseSavingsRate.toFixed(1)}%)
            </span>
          </div>
          <div className="mt-2 text-[11px] font-bold flex items-center gap-1">
            <span className={sim.newSavingsRate >= sim.baseSavingsRate ? "text-emerald-400" : "text-destructive"}>
              {sim.newSavingsRate >= sim.baseSavingsRate ? "▲ +" : "▼ "}{(sim.newSavingsRate - sim.baseSavingsRate).toFixed(1)}%
            </span>
            <span className="text-muted-foreground font-normal">sobre tus ingresos</span>
          </div>
        </div>

        {/* Card 3: Impacto Anual Neto a 12 meses */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
          isPositiveImpact ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30"
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Impacto Anual a 12 Meses
          </span>
          <div className="mt-2">
            <span className={`text-xl font-black ${isPositiveImpact ? "text-emerald-400" : "text-destructive"}`}>
              {sim.annualNetDifference >= 0 ? "+" : ""}{Math.round(sim.annualNetDifference).toLocaleString("es-ES")} €
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Ahorro anual total proyectado: <strong className="text-foreground font-black">{Math.round(sim.newAnnualSavings).toLocaleString("es-ES")} €</strong>
          </p>
        </div>

        {/* Card 4: Meses de Libertad / Pista de Aterrizaje */}
        <div className="p-4 rounded-2xl bg-card border border-border/40 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Meses de Libertad (Runway)
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-indigo-400">
              {sim.newRunwayMonths.toFixed(1)} meses
            </span>
            <span className="text-xs text-muted-foreground">
              (era {sim.baseRunwayMonths.toFixed(1)}m)
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Tiempo de supervivencia sin ingresos con tus nuevos gastos.
          </p>
        </div>
      </div>

      {/* Comparison Summary Banner */}
      <div className="mt-5 p-4 rounded-2xl bg-background/80 border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isPositiveImpact ? "🎉" : "⚠️"}</span>
          <div>
            <p className="font-extrabold text-foreground">
              {isPositiveImpact
                ? "¡Este escenario fortalece tu salud financiera!"
                : "Atención: Este escenario reduce tu capacidad de ahorro o liquidez."}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {isPositiveImpact
                ? `Logras generar ${Math.round(sim.monthlyNetDifference).toLocaleString("es-ES")} € extra al mes listos para tus metas o inversiones.`
                : `Tu margen mensual se reduce en ${Math.abs(Math.round(sim.monthlyNetDifference)).toLocaleString("es-ES")} €/mes. Asegúrate de tener colchón de emergencia.`}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
