"use client"

import { useState, useMemo } from "react"
import type { Tx } from "@/app/actions"
import { filterLivingExpenses } from "@/lib/finance"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Flame,
  ShoppingBag,
} from "lucide-react"

// ─── Popular Recurring Service Patterns ────────────────────────────────────────

const SUBSCRIPTION_PATTERNS = [
  { match: /netflix/i, label: "Netflix", logo: "🎬" },
  { match: /spotify/i, label: "Spotify", logo: "🎵" },
  { match: /amazon|prime/i, label: "Amazon Prime", logo: "📦" },
  { match: /youtube|google/i, label: "YouTube Premium", logo: "▶️" },
  { match: /disney/i, label: "Disney+", logo: "🏰" },
  { match: /hbo|max/i, label: "Max / HBO", logo: "📺" },
  { match: /apple|icloud/i, label: "Apple / iCloud", logo: "🍏" },
  { match: /gym|gimnasio|fitness|basic-fit/i, label: "Gimnasio", logo: "🏋️" },
  { match: /alquiler|rent|hipoteca/i, label: "Alquiler / Casa", logo: "🏠" },
  { match: /luz|iberdrola|endesa|naturgy|electricidad/i, label: "Luz / Electricidad", logo: "⚡" },
  { match: /agua|aqualia|canal/i, label: "Agua", logo: "💧" },
  { match: /internet|fibra|vodafone|movistar|orange|digi|o2/i, label: "Internet / Móvil", logo: "📶" },
  { match: /chatgpt|openai|cursor|github|midjourney|claude/i, label: "Suscripción IA / Dev", logo: "🤖" },
  { match: /seguro|mapfre|allianz|mutua|sanitas/i, label: "Seguro", logo: "🛡️" },
]

interface DayExpenseDetail {
  date: Date
  dayNum: number
  dateStr: string // YYYY-MM-DD
  totalExpense: number
  transactions: Tx[]
  subscriptions: { label: string; logo: string; amount: number }[]
  isToday: boolean
  isCurrentMonth: boolean
}

export function ExpenseCalendarHeatmap({
  transactions,
  initialYear,
}: {
  transactions: Tx[]
  initialYear?: number
}) {
  const today = useMemo(() => new Date(), [])
  const [selectedYear, setSelectedYear] = useState<number>(() => initialYear ?? today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(() => today.getMonth())
  const [activeDay, setActiveDay] = useState<DayExpenseDetail | null>(null)
  const [isMinimized, setIsMinimized] = useState<boolean>(false)

  // Filter only living expenses (no transfers/investments)
  const expenseTxs = useMemo(() => filterLivingExpenses(transactions), [transactions])

  // Detect recurring subscriptions across all transaction history
  const detectedRecurring = useMemo(() => {
    const map = new Map<string, { label: string; logo: string; avgAmount: number; typicalDay: number; count: number }>()

    for (const tx of expenseTxs) {
      for (const pattern of SUBSCRIPTION_PATTERNS) {
        if (pattern.match.test(tx.name) || pattern.match.test(tx.category)) {
          const key = pattern.label
          const day = new Date(tx.occurredAt).getDate()
          const existing = map.get(key)
          if (existing) {
            existing.avgAmount = (existing.avgAmount * existing.count + tx.amount) / (existing.count + 1)
            existing.count += 1
            existing.typicalDay = day
          } else {
            map.set(key, {
              label: pattern.label,
              logo: pattern.logo,
              avgAmount: tx.amount,
              typicalDay: day,
              count: 1,
            })
          }
          break
        }
      }
    }

    return Array.from(map.values())
  }, [expenseTxs])

  // Build calendar matrix for selectedYear & selectedMonth
  const { daysMatrix, monthTotal, peakDay, dailyAvg, daysWithExpensesCount } = useMemo(() => {
    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1)
    const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0)
    const numDaysInMonth = lastDayOfMonth.getDate()

    // 0 = Sunday, 1 = Monday ... We want Monday as index 0
    let startDayOfWeek = firstDayOfMonth.getDay() - 1
    if (startDayOfWeek === -1) startDayOfWeek = 6

    const days: DayExpenseDetail[] = []

    // Padding previous month
    const prevMonthLastDay = new Date(selectedYear, selectedMonth, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(selectedYear, selectedMonth - 1, prevMonthLastDay - i)
      days.push({
        date: prevDate,
        dayNum: prevMonthLastDay - i,
        dateStr: prevDate.toISOString().slice(0, 10),
        totalExpense: 0,
        transactions: [],
        subscriptions: [],
        isToday: false,
        isCurrentMonth: false,
      })
    }

    // Days in current month
    let total = 0
    let maxExpense = 0
    let peakDayNum = 0
    let daysWithExp = 0

    for (let d = 1; d <= numDaysInMonth; d++) {
      const date = new Date(selectedYear, selectedMonth, d)
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`

      // Matching transactions on this exact day
      const dayTxs = expenseTxs.filter((t) => {
        const txDate = new Date(t.occurredAt)
        return (
          txDate.getFullYear() === selectedYear &&
          txDate.getMonth() === selectedMonth &&
          txDate.getDate() === d
        )
      })

      const dayTotal = dayTxs.reduce((sum, t) => sum + t.amount, 0)
      total += dayTotal
      if (dayTotal > 0) daysWithExp++
      if (dayTotal > maxExpense) {
        maxExpense = dayTotal
        peakDayNum = d
      }

      // Matching recurring subscriptions due on this day
      const daySubs = detectedRecurring
        .filter((sub) => sub.typicalDay === d)
        .map((s) => ({ label: s.label, logo: s.logo, amount: s.avgAmount }))

      const isToday =
        today.getFullYear() === selectedYear &&
        today.getMonth() === selectedMonth &&
        today.getDate() === d

      days.push({
        date,
        dayNum: d,
        dateStr,
        totalExpense: dayTotal,
        transactions: dayTxs,
        subscriptions: daySubs,
        isToday,
        isCurrentMonth: true,
      })
    }

    // Padding next month to fill grid 35 or 42
    const totalCells = days.length <= 35 ? 35 : 42
    const nextDaysNeeded = totalCells - days.length
    for (let n = 1; n <= nextDaysNeeded; n++) {
      const nextDate = new Date(selectedYear, selectedMonth + 1, n)
      days.push({
        date: nextDate,
        dayNum: n,
        dateStr: nextDate.toISOString().slice(0, 10),
        totalExpense: 0,
        transactions: [],
        subscriptions: [],
        isToday: false,
        isCurrentMonth: false,
      })
    }

    return {
      daysMatrix: days,
      monthTotal: total,
      peakDay: { day: peakDayNum, amount: maxExpense },
      dailyAvg: numDaysInMonth > 0 ? total / numDaysInMonth : 0,
      daysWithExpensesCount: daysWithExp,
    }
  }, [selectedYear, selectedMonth, expenseTxs, detectedRecurring, today])

  const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ]

  const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

  function handlePrevMonth() {
    if (selectedMonth === 0) {
      setSelectedMonth(11)
      setSelectedYear((y) => y - 1)
    } else {
      setSelectedMonth((m) => m - 1)
    }
    setActiveDay(null)
  }

  function handleNextMonth() {
    if (selectedMonth === 11) {
      setSelectedMonth(0)
      setSelectedYear((y) => y + 1)
    } else {
      setSelectedMonth((m) => m + 1)
    }
    setActiveDay(null)
  }

  function getHeatmapColor(amount: number, isCurrentMonth: boolean) {
    if (!isCurrentMonth) return "bg-muted/10 text-muted-foreground/40 border-border/20"
    if (amount === 0) return "bg-card hover:bg-muted/30 text-foreground border-border/40"
    if (amount < 20) return "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-950 dark:text-emerald-200 border-emerald-500/30"
    if (amount < 60) return "bg-amber-500/15 hover:bg-amber-500/25 text-amber-950 dark:text-amber-200 border-amber-500/40"
    if (amount < 150) return "bg-orange-500/20 hover:bg-orange-500/30 text-orange-950 dark:text-orange-200 border-orange-500/40"
    return "bg-rose-500/25 hover:bg-rose-500/35 text-rose-950 dark:text-rose-200 border-rose-500/50 font-black shadow-2xs"
  }

  return (
    <section className="rounded-3xl border border-border/50 bg-card p-4 sm:p-6 shadow-sm flex flex-col gap-5 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex items-center justify-between gap-3 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shrink-0">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <span>Calendario de Gastos & Cobros</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                  Heatmap
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {isMinimized
                  ? `${MONTH_NAMES[selectedMonth]} ${selectedYear} · Total: $${monthTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`
                  : "Mapa de calor de consumo diario y previsión de suscripciones fijas"}
              </p>
            </div>
          </div>

          {/* Minimize / Expand Toggle Button on Mobile & Desktop */}
          <button
            type="button"
            onClick={() => setIsMinimized((v) => !v)}
            title={isMinimized ? "Desplegar calendario" : "Minimizar calendario"}
            aria-label={isMinimized ? "Desplegar calendario" : "Minimizar calendario"}
            className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-secondary/60 text-xs font-bold text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            {isMinimized ? (
              <>
                <span>Ver</span>
                <ChevronDown className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>Ocultar</span>
                <ChevronUp className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {/* Month Selector Navigation & Desktop Minimize Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!isMinimized && (
            <div className="flex items-center gap-2 bg-secondary/60 p-1 rounded-2xl border border-border/40">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl hover:bg-background text-foreground transition-colors cursor-pointer"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-xs font-black text-foreground min-w-[130px] text-center">
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl hover:bg-background text-foreground transition-colors cursor-pointer"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsMinimized((v) => !v)}
            title={isMinimized ? "Desplegar calendario" : "Minimizar calendario"}
            aria-label={isMinimized ? "Desplegar calendario" : "Minimizar calendario"}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-border/60 bg-secondary/60 text-xs font-bold text-foreground hover:bg-secondary hover:border-primary/40 transition-colors cursor-pointer"
          >
            {isMinimized ? (
              <>
                <span>Desplegar</span>
                <ChevronDown className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>Minimizar</span>
                <ChevronUp className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col p-3 rounded-2xl bg-secondary/30 border border-border/40">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Gasto del Mes</span>
          <span className="text-base sm:text-lg font-black text-foreground tabular-nums mt-0.5">
            ${monthTotal.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex flex-col p-3 rounded-2xl bg-secondary/30 border border-border/40">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Media Diaria</span>
          <span className="text-base sm:text-lg font-black text-foreground tabular-nums mt-0.5">
            ${dailyAvg.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex flex-col p-3 rounded-2xl bg-secondary/30 border border-border/40">
          <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
            <Flame className="h-3 w-3 text-rose-500" />
            Pico Más Alto
          </span>
          <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
            {peakDay.amount > 0 ? (
              <>
                Día {peakDay.day} (${peakDay.amount.toFixed(0)})
              </>
            ) : (
              "—"
            )}
          </span>
        </div>

        <div className="flex flex-col p-3 rounded-2xl bg-secondary/30 border border-border/40">
          <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
            <CreditCard className="h-3 w-3 text-sky-500" />
            Suscripciones
          </span>
          <span className="text-base sm:text-lg font-black text-sky-600 dark:text-sky-400 tabular-nums mt-0.5">
            {detectedRecurring.length} detectadas
          </span>
        </div>
      </div>

      {/* Main Calendar Heatmap Grid */}
      <div className="flex flex-col gap-1.5">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1">
          {WEEK_DAYS.map((wd) => (
            <div key={wd} className="py-1">
              {wd}
            </div>
          ))}
        </div>

        {/* Days Cells */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {daysMatrix.map((day, idx) => {
            const isSelected = activeDay?.dateStr === day.dateStr
            const colorClasses = getHeatmapColor(day.totalExpense, day.isCurrentMonth)

            return (
              <div
                key={idx}
                onClick={() => day.isCurrentMonth && setActiveDay(day)}
                className={`min-h-[64px] sm:min-h-[82px] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition-all flex flex-col justify-between cursor-pointer relative ${colorClasses} ${
                  day.isToday ? "ring-2 ring-primary shadow-xs" : ""
                } ${isSelected ? "ring-2 ring-foreground scale-[1.03] z-10" : ""}`}
              >
                {/* Day Number and Today Badge */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] sm:text-xs font-black ${
                      day.isToday
                        ? "bg-primary text-primary-foreground h-5 w-5 rounded-full flex items-center justify-center -ml-0.5 -mt-0.5"
                        : ""
                    }`}
                  >
                    {day.dayNum}
                  </span>

                  {day.subscriptions.length > 0 && day.isCurrentMonth && (
                    <div className="flex items-center gap-0.5">
                      {day.subscriptions.slice(0, 2).map((s, i) => (
                        <span key={i} title={s.label} className="text-xs">
                          {s.logo}
                        </span>
                      ))}
                      {day.subscriptions.length > 2 && (
                        <span className="text-[8px] font-bold text-muted-foreground">
                          +{day.subscriptions.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Day Expense Total */}
                {day.isCurrentMonth && (
                  <div className="mt-1">
                    {day.totalExpense > 0 ? (
                      <p className="text-[10px] sm:text-xs font-black tabular-nums tracking-tight leading-tight">
                        -${day.totalExpense.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                      </p>
                    ) : (
                      <span className="text-[9px] text-muted-foreground/40 font-medium block">
                        0 €
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Heatmap Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold text-muted-foreground pt-2 border-t border-border/30">
        <div className="flex items-center gap-2">
          <span>Intensidad de Gasto:</span>
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-card border border-border/40" title="Sin gasto" />
            <span className="text-[9px]">0€</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-emerald-500/20 border border-emerald-500/40" title="< 20€" />
            <span className="text-[9px]">&lt; 20€</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-amber-500/25 border border-amber-500/50" title="20€ - 60€" />
            <span className="text-[9px]">20-60€</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-orange-500/30 border border-orange-500/50" title="60€ - 150€" />
            <span className="text-[9px]">60-150€</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-rose-500/40 border border-rose-500/60" title="> 150€" />
            <span className="text-[9px]">&gt; 150€</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" /> Hoy
          </span>
          <span className="flex items-center gap-1">
            <span>🎬 🎵 🏠</span> Suscripciones fijas
          </span>
        </div>
      </div>

      {/* Active Day Detail Modal / Banner */}
      {activeDay && (
        <div className="p-4 rounded-2xl bg-secondary/40 border border-primary/30 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-foreground">
                Detalle del Día {activeDay.dayNum} de {MONTH_NAMES[selectedMonth]} {selectedYear}
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                Total: -${activeDay.totalExpense.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveDay(null)}
              className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cerrar ✕
            </button>
          </div>

          {/* Subscriptions due on this day */}
          {activeDay.subscriptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                Suscripciones y Cobros Recurrentes de este día:
              </span>
              <div className="flex flex-wrap gap-2">
                {activeDay.subscriptions.map((sub, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs font-bold text-sky-950 dark:text-sky-200"
                  >
                    <span>{sub.logo}</span>
                    <span>{sub.label}</span>
                    <span className="text-muted-foreground">
                      (~${sub.amount.toFixed(2)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transactions list */}
          {activeDay.transactions.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" />
                Movimientos Realizados ({activeDay.transactions.length}):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeDay.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/50 text-xs"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-foreground truncate">{tx.name}</span>
                      <span className="text-[10px] text-muted-foreground">{tx.category}</span>
                    </div>
                    <span className="font-black text-destructive tabular-nums ml-2 shrink-0">
                      -${tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic py-1">
              No hubo compras extraordinarias registradas este día.
            </p>
          )}
        </div>
      )}
      </>
      )}
    </section>
  )
}
