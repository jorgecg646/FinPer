"use client"

import { useState, useMemo, useEffect } from "react"
import type { Summary, Tx } from "@/app/actions"
import {
  Sparkles,
  Trophy,
  Crown,
  Flame,
  TrendingUp,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  Share2,
  Copy,
  Check,
  Award,
  Zap,
  Coffee,
  Heart,
  ShieldCheck,
} from "lucide-react"

type WrappedArchetype = {
  title: string
  emoji: string
  tagline: string
  description: string
  colorGradient: string
  badgeBg: string
}

export function AnnualWrappedModal({
  summary,
  transactions = [],
  isOpen,
  onClose,
}: {
  summary: Summary
  transactions?: Tx[]
  isOpen: boolean
  onClose: () => void
}) {
  const [currentSlide, setCurrentSlide] = useState<number>(0)
  const [copied, setCopied] = useState<boolean>(false)

  const selectedYear = summary.selectedYear || new Date().getFullYear()

  // Filter transactions for this year
  const yearTxs = useMemo(() => {
    return transactions.filter((t) => {
      const d = new Date(t.occurredAt)
      return d.getFullYear() === selectedYear
    })
  }, [transactions, selectedYear])

  const expenseTxs = useMemo(() => yearTxs.filter((t) => t.type === "expense"), [yearTxs])
  const incomeTxs = useMemo(() => yearTxs.filter((t) => t.type === "income"), [yearTxs])

  // Total metrics
  const totalIncome = summary.income
  const totalExpense = summary.expenses
  const netSavings = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0

  // Category breakdown
  const categoryStats = useMemo(() => {
    const catMap = new Map<string, number>()
    for (const t of expenseTxs) {
      catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount)
    }
    return [...catMap.entries()]
      .map(([cat, amount]) => ({
        category: cat,
        amount,
        pct: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenseTxs, totalExpense])

  const topCategory = categoryStats[0] || { category: "General", amount: 0, pct: 0 }

  // Monthly stats (Golden Month vs Spender Month)
  const monthlyStats = useMemo(() => {
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    const mData = Array.from({ length: 12 }, (_, i) => ({
      monthIdx: i,
      monthName: monthNames[i],
      income: 0,
      expense: 0,
      net: 0,
      savingsRate: 0,
    }))

    for (const t of yearTxs) {
      const d = new Date(t.occurredAt)
      const m = d.getMonth()
      if (m >= 0 && m < 12) {
        if (t.type === "income") mData[m].income += t.amount
        else mData[m].expense += t.amount
      }
    }

    for (const m of mData) {
      m.net = m.income - m.expense
      m.savingsRate = m.income > 0 ? (m.net / m.income) * 100 : 0
    }

    // Filter active months (with activity)
    const activeMonths = mData.filter((m) => m.income > 0 || m.expense > 0)

    const goldenMonth = [...activeMonths].sort((a, b) => b.net - a.net)[0] || mData[0]
    const spenderMonth = [...activeMonths].sort((a, b) => b.expense - a.expense)[0] || mData[0]

    // Calculate longest positive savings streak
    let currentStreak = 0
    let longestStreak = 0
    for (const m of activeMonths) {
      if (m.net >= 0) {
        currentStreak++
        if (currentStreak > longestStreak) longestStreak = currentStreak
      } else {
        currentStreak = 0
      }
    }

    return {
      goldenMonth,
      spenderMonth,
      longestStreak,
      activeMonthsCount: activeMonths.length,
    }
  }, [yearTxs])

  // Micro-expenses stats (<= 10 €)
  const microStats = useMemo(() => {
    const micros = expenseTxs.filter((t) => t.amount <= 10 && t.amount > 0)
    const totalMicro = micros.reduce((s, t) => s + t.amount, 0)
    const count = micros.length
    // In 10 years at 7%
    const monthlyRate = 0.07 / 12
    let future10Years = 0
    const monthlyMicro = totalMicro / 12
    for (let m = 0; m < 120; m++) {
      future10Years = (future10Years + monthlyMicro) * (1 + monthlyRate)
    }

    return {
      count,
      totalMicro,
      future10Years: Math.round(future10Years),
    }
  }, [expenseTxs])

  // Biggest single purchase
  const biggestExpense = useMemo(() => {
    return [...expenseTxs].sort((a, b) => b.amount - a.amount)[0] || null
  }, [expenseTxs])

  // Archetype
  const archetype: WrappedArchetype = useMemo(() => {
    if (savingsRate >= 35) {
      return {
        title: "El Titán del Ahorro",
        emoji: "👑",
        tagline: "Disciplina de acero y visión a largo plazo",
        description: `Has ahorrado un impresionante ${savingsRate.toFixed(1)}% de tus ingresos. Tu capacidad de generar excedente financiero está en el 5% superior de la población.`,
        colorGradient: "from-amber-500 via-emerald-500 to-teal-500",
        badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      }
    }
    if (savingsRate >= 20) {
      return {
        title: "El Estratega Equilibrado",
        emoji: "🛡️",
        tagline: "Equilibrio perfecto entre vivir bien y construir futuro",
        description: `Cumples con solvencia la regla de oro del 20% de ahorro e inversión (${savingsRate.toFixed(1)}%). Construyes riqueza de forma consistente sin privarte de tus prioridades.`,
        colorGradient: "from-emerald-500 via-teal-500 to-cyan-500",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      }
    }
    if (savingsRate >= 5) {
      return {
        title: "El Sembrador Constante",
        emoji: "🌱",
        tagline: "Paso a paso, cada euro suma hacia tu libertad",
        description: `Cierras el año en positivo con ${netSavings.toLocaleString("es-ES", { maximumFractionDigits: 0 })} € de superávit. El hábito está vivo y listo para dar el salto al siguiente nivel.`,
        colorGradient: "from-blue-500 via-indigo-500 to-violet-500",
        badgeBg: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      }
    }
    return {
      title: "El Disfrutón del Presente",
      emoji: "🔥",
      tagline: "Un año de vivencias intensas y gastos extraordinarios",
      description: "Este año has priorizado el consumo, experiencias o proyectos clave. El próximo año es el lienzo perfecto para fijar metas de ahorro ambiciosas.",
      colorGradient: "from-rose-500 via-purple-500 to-indigo-500",
      badgeBg: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    }
  }, [savingsRate, netSavings])

  const totalSlides = 6

  function nextSlide() {
    if (currentSlide < totalSlides - 1) setCurrentSlide((s) => s + 1)
  }

  function prevSlide() {
    if (currentSlide > 0) setCurrentSlide((s) => s - 1)
  }

  function copySummaryText() {
    const text = `✨ Mi BudgetNext Wrapped ${selectedYear} ✨
🏆 Personalidad: ${archetype.emoji} ${archetype.title}
💰 Tasa de Ahorro: ${savingsRate.toFixed(1)}% (${netSavings.toLocaleString("es-ES")} €)
🥇 Categoría Reina: ${topCategory.category} (${topCategory.amount.toLocaleString("es-ES")} €)
🌟 Mes Dorado: ${monthlyStats.goldenMonth.monthName} (+${Math.round(monthlyStats.goldenMonth.net).toLocaleString("es-ES")} €)
⏱️ Racha de ahorro: ${monthlyStats.longestStreak} meses consecutivos en positivo
📊 Gestionado con BudgetNext App`

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return
      if (e.key === "ArrowRight" || e.key === "Space") nextSlide()
      if (e.key === "ArrowLeft") prevSlide()
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, currentSlide])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Modal Card */}
      <div className="relative w-full max-w-lg aspect-[9/16] sm:aspect-[4/5] max-h-[90vh] rounded-3xl overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl flex flex-col justify-between text-white select-none">
        {/* Top Progress Bars (Stories Style) */}
        <div className="absolute top-3 inset-x-4 z-20 flex gap-1.5">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <div
              key={idx}
              className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden cursor-pointer"
              onClick={() => setCurrentSlide(idx)}
            >
              <div
                className={`h-full bg-white transition-all duration-300 ${
                  idx < currentSlide ? "w-full" : idx === currentSlide ? "w-full" : "w-0"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-4 z-20 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white backdrop-blur-md transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ─────────────────────────────────────────────────────────────────────────────
            SLIDE 0: PORTADA & PERSONALIDAD FINANCIERA
            ───────────────────────────────────────────────────────────────────────────── */}
        {currentSlide === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-300">
            <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 mb-4">
              BudgetNext Wrapped · {selectedYear}
            </span>

            <div className="relative my-4">
              <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/30 via-emerald-500/30 to-indigo-500/30 blur-2xl rounded-full opacity-70" />
              <div className="relative h-28 w-28 rounded-3xl bg-zinc-900 border border-white/20 flex items-center justify-center text-5xl shadow-2xl">
                {archetype.emoji}
              </div>
            </div>

            <p className="text-xs font-bold text-white/60 uppercase tracking-wider mt-2">
              Tu Personalidad Financiera de {selectedYear}
            </p>
            <h3 className={`text-2xl sm:text-3xl font-black tracking-tight mt-1 bg-gradient-to-r ${archetype.colorGradient} bg-clip-text text-transparent`}>
              {archetype.title}
            </h3>

            <p className="text-sm font-extrabold text-white/90 mt-2 max-w-xs">
              "{archetype.tagline}"
            </p>

            <p className="text-xs text-white/70 mt-3 max-w-xs leading-relaxed">
              {archetype.description}
            </p>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────────
            SLIDE 1: LOS GRANDES NÚMEROS DEL AÑO
            ───────────────────────────────────────────────────────────────────────────── */}
        {currentSlide === 1 && (
          <div className="flex-1 flex flex-col justify-center p-6 sm:p-8 animate-in fade-in duration-300">
            <div className="text-center mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                La Foto General de {selectedYear}
              </span>
              <h3 className="text-xl sm:text-2xl font-black mt-2 text-white">
                Así se movió tu dinero
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Ingresado</span>
                <span className="text-xl font-black text-white mt-1">
                  +{totalIncome.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €
                </span>
                <span className="text-[10px] text-white/50 mt-0.5">{incomeTxs.length} entradas</span>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Total Gastado</span>
                <span className="text-xl font-black text-white mt-1">
                  -{totalExpense.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €
                </span>
                <span className="text-[10px] text-white/50 mt-0.5">{expenseTxs.length} compras</span>
              </div>
            </div>

            {/* Savings Rate Big Box */}
            <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-zinc-900 border border-emerald-500/30 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Tu Tasa de Ahorro Global
              </span>
              <div className="text-4xl sm:text-5xl font-black text-white my-1">
                {savingsRate.toFixed(1)}%
              </div>
              <p className="text-xs text-white/70">
                Has convertido en patrimonio neto <strong className="text-emerald-400 font-bold">{netSavings.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €</strong> este año.
              </p>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────────
            SLIDE 2: CATEGORÍA REINA & PODIO
            ───────────────────────────────────────────────────────────────────────────── */}
        {currentSlide === 2 && (
          <div className="flex-1 flex flex-col justify-center p-6 sm:p-8 animate-in fade-in duration-300">
            <div className="text-center mb-5">
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Donde se fue el dinero
              </span>
              <h3 className="text-xl sm:text-2xl font-black mt-2 text-white">
                Tu Categoría Reina 👑
              </h3>
            </div>

            {/* Winner Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/50 via-zinc-900 to-zinc-900 border border-amber-500/30 text-center mb-4">
              <span className="text-3xl">🥇</span>
              <h4 className="text-xl font-black text-amber-300 mt-1">
                {topCategory.category}
              </h4>
              <p className="text-2xl font-black text-white mt-1">
                {topCategory.amount.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €
              </p>
              <p className="text-xs text-white/60 mt-1">
                Se llevó el <strong className="text-amber-300 font-bold">{topCategory.pct.toFixed(0)}%</strong> de todos tus gastos de {selectedYear}.
              </p>
            </div>

            {/* Podium items */}
            <div className="flex flex-col gap-2">
              {categoryStats.slice(1, 4).map((c, idx) => (
                <div
                  key={c.category}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white/50">#{idx + 2}</span>
                    <span className="font-extrabold text-white">{c.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-white">{c.amount.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €</span>
                    <span className="text-[10px] text-white/50 ml-1.5">({c.pct.toFixed(0)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────────
            SLIDE 3: MES DORADO VS MES DEL DESMADRE
            ───────────────────────────────────────────────────────────────────────────── */}
        {currentSlide === 3 && (
          <div className="flex-1 flex flex-col justify-center p-6 sm:p-8 animate-in fade-in duration-300">
            <div className="text-center mb-5">
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Los dos extremos del año
              </span>
              <h3 className="text-xl sm:text-2xl font-black mt-2 text-white">
                Mes Dorado vs Desmadre
              </h3>
            </div>

            {/* Golden Month */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-zinc-900 border border-emerald-500/30 mb-3 flex items-center gap-4">
              <span className="text-3xl p-3 rounded-2xl bg-emerald-500/20">🌟</span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Mes Más Ahorrador</span>
                <h4 className="text-lg font-black text-white">{monthlyStats.goldenMonth.monthName}</h4>
                <p className="text-xs text-white/70">
                  Lograste ahorrar <strong className="text-emerald-400 font-bold">+{Math.round(monthlyStats.goldenMonth.net).toLocaleString("es-ES")} €</strong> ({monthlyStats.goldenMonth.savingsRate.toFixed(0)}% de tus ingresos).
                </p>
              </div>
            </div>

            {/* Spender Month */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/60 to-zinc-900 border border-rose-500/30 mb-3 flex items-center gap-4">
              <span className="text-3xl p-3 rounded-2xl bg-rose-500/20">🎉</span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">Mes con Mayor Gasto</span>
                <h4 className="text-lg font-black text-white">{monthlyStats.spenderMonth.monthName}</h4>
                <p className="text-xs text-white/70">
                  El gasto total subió hasta los <strong className="text-rose-400 font-bold">{Math.round(monthlyStats.spenderMonth.expense).toLocaleString("es-ES")} €</strong>.
                </p>
              </div>
            </div>

            {/* Streak */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center text-xs">
              <span className="text-white/60">Tu racha de ahorro más larga: </span>
              <strong className="text-indigo-400 font-black">{monthlyStats.longestStreak} meses seguidos en positivo ⚡</strong>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────────
            SLIDE 4: GASTOS HORMIGA & CURIOSIDADES
            ───────────────────────────────────────────────────────────────────────────── */}
        {currentSlide === 4 && (
          <div className="flex-1 flex flex-col justify-center p-6 sm:p-8 animate-in fade-in duration-300">
            <div className="text-center mb-5">
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Curiosidades Financieras
              </span>
              <h3 className="text-xl sm:text-2xl font-black mt-2 text-white">
                Pequeños Detalles
              </h3>
            </div>

            {/* Micro-expenses */}
            <div className="p-4 rounded-2xl bg-zinc-900 border border-white/10 mb-3 text-center">
              <span className="text-3xl">🐜</span>
              <h4 className="text-sm font-black text-white mt-1">Tus Gastos Hormiga (≤ 10 €)</h4>
              <div className="text-2xl font-black text-amber-400 my-1">
                {microStats.totalMicro.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </div>
              <p className="text-xs text-white/60">
                En {microStats.count} pequeñas compras cotidianas. Si lo hubieses invertido al 7%, en 10 años serían <strong className="text-emerald-400 font-bold">{microStats.future10Years.toLocaleString("es-ES")} €</strong>.
              </p>
            </div>

            {/* Biggest Purchase */}
            {biggestExpense && (
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-white/50">Mayor Compra Única</span>
                  <p className="font-extrabold text-white mt-0.5">{biggestExpense.name || biggestExpense.category}</p>
                </div>
                <div className="text-right font-black text-rose-400 text-sm">
                  {biggestExpense.amount.toLocaleString("es-ES")} €
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────────
            SLIDE 5: TARJETA FINAL RESUMEN COMPARTIBLE
            ───────────────────────────────────────────────────────────────────────────── */}
        {currentSlide === 5 && (
          <div className="flex-1 flex flex-col justify-center p-5 sm:p-7 animate-in fade-in duration-300">
            {/* Poster Card */}
            <div className="relative p-5 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-indigo-950/80 border border-white/20 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{archetype.emoji}</span>
                  <div>
                    <h4 className="text-sm font-black text-white">BudgetNext Wrapped</h4>
                    <p className="text-[10px] text-white/50">Resumen Oficial · {selectedYear}</p>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {archetype.title}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-white/50 uppercase font-semibold">Tasa de Ahorro</span>
                  <p className="text-base font-black text-emerald-400 mt-0.5">{savingsRate.toFixed(1)}%</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-white/50 uppercase font-semibold">Ahorro Neto</span>
                  <p className="text-base font-black text-white mt-0.5">+{netSavings.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-white/50 uppercase font-semibold">Categoría Reina</span>
                  <p className="text-xs font-black text-amber-300 mt-0.5 truncate">{topCategory.category}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-white/50 uppercase font-semibold">Mes Dorado</span>
                  <p className="text-xs font-black text-indigo-300 mt-0.5 truncate">{monthlyStats.goldenMonth.monthName}</p>
                </div>
              </div>

              <div className="text-center pt-2 border-t border-white/10 text-[10px] text-white/40">
                Gestionado con BudgetNext App
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={copySummaryText}
                className="cursor-pointer flex-1 py-2.5 rounded-2xl bg-primary text-primary-foreground font-black text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-lg"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? "¡Copiado al Portapapeles!" : "Copiar Resumen para Redes"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Navigation Buttons */}
        <div className="p-4 bg-zinc-950/80 border-t border-white/10 flex items-center justify-between z-20">
          <button
            type="button"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="cursor-pointer p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <span className="text-xs font-bold text-white/50">
            {currentSlide + 1} / {totalSlides}
          </span>

          <button
            type="button"
            onClick={nextSlide}
            disabled={currentSlide === totalSlides - 1}
            className="cursor-pointer p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function AnnualWrappedBanner({
  summary,
  transactions = [],
  forceShow = false,
}: {
  summary: Summary
  transactions?: Tx[]
  forceShow?: boolean
}) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const currentMonth = new Date().getMonth() // 0 = Jan, 11 = Dec
  const selectedYear = summary.selectedYear || new Date().getFullYear()

  // Only render during the month of December (month 11)
  if (currentMonth !== 11 && !forceShow) {
    return null
  }

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className="cursor-pointer group relative overflow-hidden rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-emerald-950/40 border border-purple-500/30 hover:border-purple-500/60 transition-all shadow-lg hover:shadow-purple-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-2xl shadow-lg shadow-purple-500/30 group-hover:scale-105 transition-transform">
            🎁
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                BudgetNext Wrapped {selectedYear}
              </h3>
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse">
                ¡Diciembre!
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tu resumen anual interactivo estilo Spotify: personalidad financiera, mes dorado y categoría reina
            </p>
          </div>
        </div>

        <button
          type="button"
          className="cursor-pointer px-4 py-2 rounded-2xl bg-white text-zinc-950 hover:bg-white/90 font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shrink-0 self-start sm:self-auto"
        >
          <Sparkles className="h-3.5 w-3.5 text-purple-600" />
          <span>Ver mi Wrapped {selectedYear}</span>
        </button>
      </div>

      <AnnualWrappedModal
        summary={summary}
        transactions={transactions}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}
