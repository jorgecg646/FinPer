"use client"

import { useState, useMemo } from "react"
import type { Summary } from "@/app/actions"

// ─────────────────────────────────────────────────────────────────────────────
// Rule503020Calculator — Diagnóstico de la Regla 50/30/20 & Salud Financiera
// ─────────────────────────────────────────────────────────────────────────────

export function Rule503020Calculator({ summary }: { summary: Summary }) {
  const monthlyIncome = summary.income > 0 ? summary.income / 12 : 2000
  const monthlyExpense = summary.expenses > 0 ? summary.expenses / 12 : 1400

  // Split estimation (default 50% needs, 30% wants, 20% savings)
  const defaultNeeds = monthlyExpense * 0.6
  const defaultWants = monthlyExpense * 0.4
  const defaultSavings = Math.max(0, monthlyIncome - monthlyExpense)

  const [customIncome, setCustomIncome] = useState<number>(Math.round(monthlyIncome))
  const [needs, setNeeds] = useState<number>(Math.round(defaultNeeds))
  const [wants, setWants] = useState<number>(Math.round(defaultWants))
  const [savings, setSavings] = useState<number>(Math.round(defaultSavings))

  // 50/30/20 targets
  const targetNeeds = customIncome * 0.5
  const targetWants = customIncome * 0.3
  const targetSavings = customIncome * 0.2

  // Actual percentages
  const pctNeeds = customIncome > 0 ? (needs / customIncome) * 100 : 0
  const pctWants = customIncome > 0 ? (wants / customIncome) * 100 : 0
  const pctSavings = customIncome > 0 ? (savings / customIncome) * 100 : 0

  // Total allocated
  const totalAllocated = needs + wants + savings

  // Score 0 to 100
  const score = useMemo(() => {
    let pts = 100
    if (pctNeeds > 50) pts -= (pctNeeds - 50) * 1.5
    if (pctWants > 30) pts -= (pctWants - 30) * 1.5
    if (pctSavings < 20) pts -= (20 - pctSavings) * 2
    return Math.max(10, Math.min(100, Math.round(pts)))
  }, [pctNeeds, pctWants, pctSavings])

  return (
    <div className="flex flex-col gap-6 rounded-3xl bg-card p-5 sm:p-7 border border-border/50 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary font-black text-lg">
              ⚖️
            </span>
            <h3 className="text-base sm:text-lg font-black text-foreground">
              Diagnóstico de Salud Financiera · Regla 50 / 30 / 20
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Analiza cómo se distribuyen tus ingresos entre Necesidades Básicas, Ocio/Caprichos y Ahorro
          </p>
        </div>

        {/* Score Badge */}
        <div className="self-start sm:self-auto flex items-center gap-3 p-2 rounded-2xl bg-secondary/50 border border-border/40">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Puntuación</span>
            <p className="text-base font-black text-foreground">{score} / 100</p>
          </div>
          <div className={`h-3 w-3 rounded-full ${score >= 80 ? "bg-positive" : score >= 60 ? "bg-amber-500" : "bg-destructive"}`} />
        </div>
      </div>

      {/* Income Input */}
      <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <label htmlFor="input-503020-income" className="text-xs font-black text-foreground">Tus Ingresos Netos Mensuales:</label>
          <p className="text-[11px] text-muted-foreground">Base sobre la que se calculan las proporciones ideales</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="input-503020-income"
            type="number"
            value={customIncome}
            onChange={(e) => setCustomIncome(Math.max(0, Number(e.target.value)))}
            className="w-32 rounded-xl bg-background px-3 py-2 text-sm font-black text-foreground border border-border/50 focus:border-primary focus:outline-none text-right"
          />
          <span className="text-xs font-black text-foreground">€ / mes</span>
        </div>
      </div>

      {/* 3 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 50% Needs */}
        <div className="p-4 rounded-2xl bg-card border border-border/50 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                <span>🏠 50% Necesidades</span>
              </span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${pctNeeds <= 50 ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"}`}>
                {pctNeeds.toFixed(0)}%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Alquiler, hipoteca, súper, luz, agua, transporte básico</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="needs-input" className="text-muted-foreground">Tu gasto:</label>
              <div className="flex items-center gap-1">
                <input
                  id="needs-input"
                  type="number"
                  value={needs}
                  onChange={(e) => setNeeds(Math.max(0, Number(e.target.value)))}
                  aria-label="Gasto en necesidades"
                  className="w-24 rounded-lg bg-background px-2 py-1 text-xs font-bold text-foreground border border-border text-right"
                />
                <span className="text-xs font-bold text-foreground">€</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Límite ideal (50%):</span>
              <strong className="text-foreground">{Math.round(targetNeeds)} €</strong>
            </div>
          </div>
        </div>

        {/* 30% Wants */}
        <div className="p-4 rounded-2xl bg-card border border-border/50 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                <span>🎉 30% Deseos & Ocio</span>
              </span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${pctWants <= 30 ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"}`}>
                {pctWants.toFixed(0)}%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Restaurantes, compras, viajes, suscripciones y hobbies</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="wants-input" className="text-muted-foreground">Tu gasto:</label>
              <div className="flex items-center gap-1">
                <input
                  id="wants-input"
                  type="number"
                  value={wants}
                  onChange={(e) => setWants(Math.max(0, Number(e.target.value)))}
                  aria-label="Gasto en ocio y deseos"
                  className="w-24 rounded-lg bg-background px-2 py-1 text-xs font-bold text-foreground border border-border text-right"
                />
                <span className="text-xs font-bold text-foreground">€</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Límite ideal (30%):</span>
              <strong className="text-foreground">{Math.round(targetWants)} €</strong>
            </div>
          </div>
        </div>

        {/* 20% Savings */}
        <div className="p-4 rounded-2xl bg-card border border-border/50 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                <span>🌱 20% Ahorro e Inversión</span>
              </span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${pctSavings >= 20 ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"}`}>
                {pctSavings.toFixed(0)}%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Fondo de emergencia, aportaciones a fondos indexados, metas</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="savings-input" className="text-muted-foreground">Tu ahorro:</label>
              <div className="flex items-center gap-1">
                <input
                  id="savings-input"
                  type="number"
                  value={savings}
                  onChange={(e) => setSavings(Math.max(0, Number(e.target.value)))}
                  aria-label="Ahorro e inversión mensual"
                  className="w-24 rounded-lg bg-background px-2 py-1 text-xs font-bold text-foreground border border-border text-right"
                />
                <span className="text-xs font-bold text-foreground">€</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Objetivo ideal (20%):</span>
              <strong className="text-foreground">{Math.round(targetSavings)} €</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Distribution Progress Bar */}
      <div>
        <div className="h-4 w-full rounded-full bg-secondary/80 overflow-hidden flex shadow-inner">
          <div style={{ width: `${Math.min(pctNeeds, 100)}%` }} className="bg-amber-500 h-full transition-all" title={`Necesidades: ${pctNeeds.toFixed(1)}%`} />
          <div style={{ width: `${Math.min(pctWants, 100 - pctNeeds)}%` }} className="bg-indigo-500 h-full transition-all" title={`Deseos: ${pctWants.toFixed(1)}%`} />
          <div style={{ width: `${Math.min(pctSavings, 100 - pctNeeds - pctWants)}%` }} className="bg-positive h-full transition-all" title={`Ahorro: ${pctSavings.toFixed(1)}%`} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground flex-wrap gap-2">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Necesidades ({pctNeeds.toFixed(1)}%)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Ocio & Deseos ({pctWants.toFixed(1)}%)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-positive" /> Ahorro ({pctSavings.toFixed(1)}%)</span>
        </div>
      </div>
    </div>
  )
}
