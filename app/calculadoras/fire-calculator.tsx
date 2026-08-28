"use client"

import { useState, useMemo } from "react"
import type { Summary, Tx } from "@/app/actions"
import { filterLivingExpenses } from "@/lib/finance"
import {
  Flame,
  TrendingUp,
  Sparkles,
  Palmtree,
  Compass,
  Coffee,
} from "lucide-react"

export function FireCalculator({
  summary,
  transactions,
}: {
  summary: Summary
  transactions: Tx[]
}) {
  // Auto-calculate real historical numbers as defaults
  const realAnnualExpenses = useMemo(() => {
    if (summary.expenses > 0) return summary.expenses
    const nonInv = filterLivingExpenses(transactions)
    const total = nonInv.reduce((sum, t) => sum + t.amount, 0)
    return total > 0 ? total : 24000
  }, [summary.expenses, transactions])

  const realAnnualIncome = useMemo(() => {
    return summary.income > 0 ? summary.income : 36000
  }, [summary.income])

  const realAnnualSavings = Math.max(0, realAnnualIncome - realAnnualExpenses)
  const defaultMonthlySavings = Math.round(realAnnualSavings / 12) || 800

  // Interactive User State
  const [currentAge, setCurrentAge] = useState<number>(30)
  const [currentNetWorth, setCurrentNetWorth] = useState<number>(25000)
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(
    Math.round(realAnnualExpenses / 12) || 1800
  )
  const [monthlyContribution, setMonthlyContribution] = useState<number>(defaultMonthlySavings)
  const [expectedReturnPct, setExpectedReturnPct] = useState<number>(7.5) // 7.5% nominal return
  const [inflationPct, setInflationPct] = useState<number>(2.5) // 2.5% inflation
  const [swrPct, setSwrPct] = useState<number>(4.0) // Safe Withdrawal Rate (4% Rule)

  // Real annual net return adjusted for inflation
  const realReturnRate = useMemo(() => {
    const r = (1 + expectedReturnPct / 100) / (1 + inflationPct / 100) - 1
    return Math.max(0.001, r)
  }, [expectedReturnPct, inflationPct])

  // Annual retirement expenses desired
  const annualRetirementExpenses = monthlyExpenses * 12

  // F.I.R.E. Number = Annual Expenses / Safe Withdrawal Rate
  const fireNumber = useMemo(() => {
    return Math.round(annualRetirementExpenses / (swrPct / 100))
  }, [annualRetirementExpenses, swrPct])

  // Variants of F.I.R.E.
  const leanFireNumber = Math.round(fireNumber * 0.75) // 75% essential expenses
  const fatFireNumber = Math.round(fireNumber * 1.5) // 150% luxury lifestyle

  // Coast F.I.R.E. Number (capital needed today to grow to standard FIRE at age 65 without adding any more money)
  const yearsTo65 = Math.max(1, 65 - currentAge)
  const coastFireNumber = Math.round(fireNumber / Math.pow(1 + realReturnRate, yearsTo65))

  // Projection Year-by-Year Simulation
  const projection = useMemo(() => {
    const data: {
      yearIndex: number
      age: number
      totalCapital: number
      totalContributions: number
      totalCompoundGrowth: number
      isFireReached: boolean
    }[] = []

    let capital = currentNetWorth
    let totalContributed = currentNetWorth
    const annualContrib = monthlyContribution * 12

    let fireYearIdx: number | null = null

    for (let yr = 0; yr <= 45; yr++) {
      const age = currentAge + yr
      const isReached = capital >= fireNumber

      if (isReached && fireYearIdx === null) {
        fireYearIdx = yr
      }

      data.push({
        yearIndex: yr,
        age,
        totalCapital: Math.round(capital),
        totalContributions: Math.round(totalContributed),
        totalCompoundGrowth: Math.round(Math.max(0, capital - totalContributed)),
        isFireReached: isReached,
      })

      // Next year growth + contributions
      capital = (capital + annualContrib) * (1 + realReturnRate)
      totalContributed += annualContrib

      if (yr >= 40 && capital > fireNumber * 2) break
    }

    return {
      points: data,
      yearsToFire: fireYearIdx !== null ? fireYearIdx : null,
      fireAge: fireYearIdx !== null ? currentAge + fireYearIdx : null,
    }
  }, [currentAge, currentNetWorth, monthlyContribution, realReturnRate, fireNumber])

  const currentProgressPct = Math.min(100, Math.max(0, (currentNetWorth / fireNumber) * 100))

  return (
    <section className="rounded-3xl border border-border/50 bg-card p-4 sm:p-6 shadow-sm flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-500 shrink-0">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
              <span>Calculadora de Libertad Financiera (F.I.R.E.)</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                Regla del 4%
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Descubre a qué edad te jubilarás y el patrimonio necesario para vivir 100% de tus rentas
            </p>
          </div>
        </div>
      </div>

      {/* Main Results Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500/15 via-amber-500/10 to-primary/10 border border-orange-500/30 p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div className="flex flex-col gap-2 z-10">
          <span className="text-xs font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" />
            Tu Número F.I.R.E. Objetivo
          </span>
          <h3 className="text-3xl sm:text-5xl font-black text-foreground tabular-nums tracking-tight">
            ${fireNumber.toLocaleString("es-ES")}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium max-w-md">
            Con este patrimonio podrás retirar <strong className="text-foreground">${monthlyExpenses.toLocaleString("es-ES")} / mes</strong> ($
            {annualRetirementExpenses.toLocaleString("es-ES")}/año) con la regla del {swrPct}% sin que tu dinero se agote nunca.
          </p>

          {/* Progress bar */}
          <div className="mt-3 flex flex-col gap-1.5 max-w-md">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-muted-foreground">Progreso actual</span>
              <span className="text-orange-600 dark:text-orange-400 font-black">
                {currentProgressPct.toFixed(1)}% (${currentNetWorth.toLocaleString("es-ES")})
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-secondary/80 overflow-hidden border border-border/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                style={{ width: `${currentProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Retirement Age Badge Card */}
        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-card/80 backdrop-blur-md border border-orange-500/30 text-center min-w-[200px] shrink-0 shadow-sm z-10">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">
            Edad de Jubilación F.I.R.E.
          </span>
          {projection.fireAge !== null ? (
            <>
              <span className="text-4xl sm:text-5xl font-black text-orange-600 dark:text-orange-400 tabular-nums my-1">
                {projection.fireAge} <span className="text-base font-bold text-muted-foreground">años</span>
              </span>
              <span className="text-xs font-bold text-foreground bg-orange-500/20 px-3 py-1 rounded-full border border-orange-500/30">
                ¡En {projection.yearsToFire} años (Año {new Date().getFullYear() + projection.yearsToFire!})!
              </span>
            </>
          ) : (
            <span className="text-base font-bold text-muted-foreground my-2">
              Ajusta tu aportación o rentabilidad
            </span>
          )}
        </div>
      </div>

      {/* Interactive Controls & Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Current Age */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted-foreground uppercase">Edad Actual</label>
            <span className="text-sm font-black text-foreground tabular-nums">{currentAge} años</span>
          </div>
          <input
            type="range"
            min="18"
            max="65"
            step="1"
            value={currentAge}
            onChange={(e) => setCurrentAge(Number(e.target.value))}
            className="w-full accent-orange-500 cursor-pointer"
          />
        </div>

        {/* Current Net Worth */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted-foreground uppercase">Patrimonio Actual</label>
            <span className="text-sm font-black text-foreground tabular-nums">
              ${currentNetWorth.toLocaleString("es-ES")}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="500000"
            step="5000"
            value={currentNetWorth}
            onChange={(e) => setCurrentNetWorth(Number(e.target.value))}
            className="w-full accent-orange-500 cursor-pointer"
          />
        </div>

        {/* Monthly Expenses in Retirement */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted-foreground uppercase">Gasto Mensual Deseado</label>
            <span className="text-sm font-black text-foreground tabular-nums">
              ${monthlyExpenses.toLocaleString("es-ES")}/mes
            </span>
          </div>
          <input
            type="range"
            min="500"
            max="8000"
            step="100"
            value={monthlyExpenses}
            onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
            className="w-full accent-orange-500 cursor-pointer"
          />
        </div>

        {/* Monthly Contribution */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted-foreground uppercase">Aportación Mensual</label>
            <span className="text-sm font-black text-foreground tabular-nums">
              ${monthlyContribution.toLocaleString("es-ES")}/mes
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="5000"
            step="50"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(Number(e.target.value))}
            className="w-full accent-orange-500 cursor-pointer"
          />
        </div>

        {/* Expected Annual Return */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Rentabilidad Anual</label>
              <span className="text-[10px] text-muted-foreground font-medium" title="S&P 500 media histórica: ~8-10%">
                (Media S&P 500: ~8-10%)
              </span>
            </div>
            <span className="text-sm font-black text-foreground tabular-nums">{expectedReturnPct}% / año</span>
          </div>
          <input
            type="range"
            min="1"
            max="35"
            step="0.5"
            value={expectedReturnPct}
            onChange={(e) => setExpectedReturnPct(Number(e.target.value))}
            className="w-full accent-orange-500 cursor-pointer"
          />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
            <span>Conservador (4-6%)</span>
            <span>Indexado (8-10%)</span>
            <span>Crecimiento (15%+)</span>
          </div>
        </div>

        {/* Safe Withdrawal Rate (SWR) */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Tasa Retirada (SWR)</label>
              <span
                className="cursor-pointer text-[10px] font-black px-1.5 py-0.5 rounded-full bg-primary/20 text-primary"
                title="SWR (Safe Withdrawal Rate): % anual de tu cartera que puedes gastar cada año sin que el dinero se agote nunca según el Estudio Trinity (Regla del 4%)."
              >
                ℹ️ ¿Qué es?
              </span>
            </div>
            <span className="text-sm font-black text-foreground tabular-nums">
              {swrPct}% {swrPct === 4 ? "(Regla del 4%)" : ""}
            </span>
          </div>
          <input
            type="range"
            min="2.5"
            max="7.0"
            step="0.25"
            value={swrPct}
            onChange={(e) => setSwrPct(Number(e.target.value))}
            className="w-full accent-orange-500 cursor-pointer"
          />
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <button
              type="button"
              onClick={() => setSwrPct(3.5)}
              className={`text-[9px] font-bold px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                swrPct === 3.5 ? "bg-orange-500 text-white border-orange-500" : "bg-card hover:bg-secondary border-border/40 text-muted-foreground"
              }`}
            >
              3.5% (Muy Seguro)
            </button>
            <button
              type="button"
              onClick={() => setSwrPct(4.0)}
              className={`text-[9px] font-bold px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                swrPct === 4.0 ? "bg-orange-500 text-white border-orange-500" : "bg-card hover:bg-secondary border-border/40 text-muted-foreground"
              }`}
            >
              4.0% (Estándar Trinity)
            </button>
            <button
              type="button"
              onClick={() => setSwrPct(5.0)}
              className={`text-[9px] font-bold px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                swrPct === 5.0 ? "bg-orange-500 text-white border-orange-500" : "bg-card hover:bg-secondary border-border/40 text-muted-foreground"
              }`}
            >
              5.0% (Flexible)
            </button>
          </div>
        </div>
      </div>

      {/* SWR Educational Callout */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-secondary/30 border border-border/40 flex items-start gap-3 text-xs">
        <span className="text-base sm:text-lg">💡</span>
        <div className="flex flex-col gap-1 text-muted-foreground">
          <p className="font-bold text-foreground">
            ¿Qué es la Tasa Segura de Retirada (SWR / Regla del 4%)?
          </p>
          <p className="leading-relaxed">
            Es el porcentaje máximo de tu dinero que puedes retirar cada año para vivir de tus rentas sin que tu patrimonio se agote nunca (basado en el famoso <em>Estudio Trinity</em>).
            Por ejemplo, con la regla del <strong>4%</strong>, tu meta F.I.R.E. es exactamente <strong>25 veces tu gasto anual</strong> (Gasto Anual / 0.04). Si eliges un <strong>3.5%</strong>, tu plan es más conservador y seguro para jubilaciones muy tempranas.
          </p>
        </div>
      </div>

      {/* 4 F.I.R.E. Types Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Lean FIRE */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coffee className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-black uppercase text-foreground">Lean F.I.R.E.</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Estilo de vida minimalista y gastos básicos ({monthlyExpenses * 0.75} €/mes).
          </p>
          <div className="border-t border-border/30 pt-2">
            <span className="text-xs text-muted-foreground block font-medium">Meta:</span>
            <span className="text-base font-black text-foreground tabular-nums">
              ${leanFireNumber.toLocaleString("es-ES")}
            </span>
          </div>
        </div>

        {/* Standard FIRE */}
        <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-black uppercase text-orange-600 dark:text-orange-400">
              Standard F.I.R.E.
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Mantener tu nivel de vida actual ({monthlyExpenses} €/mes).
          </p>
          <div className="border-t border-orange-500/20 pt-2">
            <span className="text-xs text-muted-foreground block font-medium">Meta:</span>
            <span className="text-base font-black text-foreground tabular-nums">
              ${fireNumber.toLocaleString("es-ES")}
            </span>
          </div>
        </div>

        {/* Fat FIRE */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2">
            <Palmtree className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-black uppercase text-foreground">Fat F.I.R.E.</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Estilo holgado con viajes y ocio extra ({monthlyExpenses * 1.5} €/mes).
          </p>
          <div className="border-t border-border/30 pt-2">
            <span className="text-xs text-muted-foreground block font-medium">Meta:</span>
            <span className="text-base font-black text-foreground tabular-nums">
              ${fatFireNumber.toLocaleString("es-ES")}
            </span>
          </div>
        </div>

        {/* Coast FIRE */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-sky-500" />
            <span className="text-xs font-black uppercase text-foreground">Coast F.I.R.E.</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Capital necesario hoy para jubilarte a los 65 sin aportar nada más.
          </p>
          <div className="border-t border-border/30 pt-2">
            <span className="text-xs text-muted-foreground block font-medium">Meta hoy:</span>
            <span className="text-base font-black text-foreground tabular-nums">
              ${coastFireNumber.toLocaleString("es-ES")}
            </span>
          </div>
        </div>
      </div>

      {/* SVG Compound Growth Timeline Chart */}
      <div className="p-4 sm:p-5 rounded-2xl bg-secondary/20 border border-border/40 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/30 pb-2">
          <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            Curva de Crecimiento del Patrimonio e Interés Compuesto
          </span>
          <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Aportaciones
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> Interés Compuesto
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Meta F.I.R.E.
            </span>
          </div>
        </div>

        {/* Dynamic Visual Bars Timeline */}
        <div className="overflow-x-auto no-scrollbar py-2">
          <div className="flex items-end gap-2 sm:gap-3 min-w-[650px] h-48 px-2 pt-6">
            {projection.points
              .filter((_, idx) => idx % 2 === 0 || idx === projection.yearsToFire)
              .slice(0, 20)
              .map((pt, idx) => {
                const maxCap = Math.max(fireNumber * 1.3, pt.totalCapital)
                const contribHeightPct = Math.min(100, (pt.totalContributions / maxCap) * 100)
                const totalHeightPct = Math.min(100, (pt.totalCapital / maxCap) * 100)
                const isFireYear = pt.yearIndex === projection.yearsToFire

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 bg-foreground text-background text-[9px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-20">
                      Edad {pt.age}: ${pt.totalCapital.toLocaleString("es-ES")}
                    </div>

                    {isFireYear && (
                      <div className="absolute -top-6 text-[10px] font-black text-orange-500 animate-bounce">
                        🎯 FIRE
                      </div>
                    )}

                    {/* Stacked bar */}
                    <div
                      className={`w-full max-w-[28px] rounded-t-lg relative overflow-hidden transition-all duration-300 ${
                        isFireYear
                          ? "ring-2 ring-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                          : ""
                      }`}
                      style={{ height: `${totalHeightPct}%` }}
                    >
                      {/* Growth part */}
                      <div className="absolute inset-0 bg-gradient-to-t from-amber-500 to-orange-500" />
                      {/* Contribution part at bottom */}
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-sky-600/80"
                        style={{ height: `${(contribHeightPct / totalHeightPct) * 100}%` }}
                      />
                    </div>

                    <span
                      className={`text-[9px] font-black mt-1.5 tabular-nums ${
                        isFireYear ? "text-orange-500 font-extrabold" : "text-muted-foreground"
                      }`}
                    >
                      {pt.age}a
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </section>
  )
}
