"use client"

import { useState, useEffect } from "react"
import { Target, Plus, Trash2, CheckCircle2, AlertCircle, ShieldAlert, Sparkles } from "lucide-react"
import type { Tx } from "@/app/actions"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Budget = {
  id: string
  category: string
  limitAmount: number
}

export type Goal = {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: string
}

const BUDGETS_KEY = "finflow-budgets"
const GOALS_KEY = "finflow-goals"

const DEFAULT_BUDGETS: Budget[] = []
const DEFAULT_GOALS: Goal[] = []

// ─────────────────────────────────────────────────────────────────────────────
// BudgetsAndGoalsManager Component
// ─────────────────────────────────────────────────────────────────────────────

export function BudgetsAndGoalsManager({ transactions }: { transactions: Tx[] }) {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])

  const [newBudgetCategory, setNewBudgetCategory] = useState("Supermercado")
  const [newBudgetLimit, setNewBudgetLimit] = useState("")

  const [newGoalName, setNewGoalName] = useState("")
  const [newGoalTarget, setNewGoalTarget] = useState("")
  const [newGoalCurrent, setNewGoalCurrent] = useState("")
  const [newGoalDate, setNewGoalDate] = useState("")

  useEffect(() => {
    try {
      const bStored = localStorage.getItem(BUDGETS_KEY)
      setBudgets(bStored ? JSON.parse(bStored) : DEFAULT_BUDGETS)

      const gStored = localStorage.getItem(GOALS_KEY)
      setGoals(gStored ? JSON.parse(gStored) : DEFAULT_GOALS)
    } catch {
      setBudgets(DEFAULT_BUDGETS)
      setGoals(DEFAULT_GOALS)
    }
  }, [])

  function saveBudgets(list: Budget[]) {
    setBudgets(list)
    localStorage.setItem(BUDGETS_KEY, JSON.stringify(list))
  }

  function saveGoals(list: Goal[]) {
    setGoals(list)
    localStorage.setItem(GOALS_KEY, JSON.stringify(list))
  }

  // Calculate actual spending per category for the current month
  const now = new Date()
  const currentMonthExpenses = new Map<string, number>()
  for (const t of transactions) {
    if (t.type === "expense") {
      const d = new Date(t.occurredAt)
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        currentMonthExpenses.set(t.category, (currentMonthExpenses.get(t.category) || 0) + t.amount)
      }
    }
  }

  function handleAddBudget(e: React.FormEvent) {
    e.preventDefault()
    const limit = parseFloat(newBudgetLimit)
    if (!newBudgetCategory || isNaN(limit) || limit <= 0) return
    const updated = [...budgets.filter((b) => b.category !== newBudgetCategory), { id: `b-${Date.now()}`, category: newBudgetCategory, limitAmount: limit }]
    saveBudgets(updated)
    setNewBudgetLimit("")
  }

  function handleDeleteBudget(id: string) {
    saveBudgets(budgets.filter((b) => b.id !== id))
  }

  function handleAddGoal(e: React.FormEvent) {
    e.preventDefault()
    const target = parseFloat(newGoalTarget)
    const current = parseFloat(newGoalCurrent) || 0
    if (!newGoalName || isNaN(target) || target <= 0) return
    const updated = [...goals, { id: `g-${Date.now()}`, name: newGoalName, targetAmount: target, currentAmount: current, targetDate: newGoalDate || "2026-12-31" }]
    saveGoals(updated)
    setNewGoalName("")
    setNewGoalTarget("")
    setNewGoalCurrent("")
    setNewGoalDate("")
  }

  function handleUpdateGoalAmount(id: string, delta: number) {
    saveGoals(goals.map((g) => (g.id === id ? { ...g, currentAmount: Math.max(0, g.currentAmount + delta) } : g)))
  }

  function handleDeleteGoal(id: string) {
    saveGoals(goals.filter((g) => g.id !== id))
  }

  return (
    <div className="flex flex-col gap-8">
      {/* SECTION 1: PRESUPUESTOS POR CATEGORÍA */}
      <section className="rounded-3xl bg-card p-5 sm:p-6 shadow-sm border border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> Presupuestos Mensuales por Categoría
            </h2>
            <p className="text-xs text-muted-foreground">Controla tus límites de gasto en el mes actual</p>
          </div>
        </div>

        {/* Form add budget */}
        <form onSubmit={handleAddBudget} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={newBudgetCategory}
            onChange={(e) => setNewBudgetCategory(e.target.value)}
            placeholder="Categoría (ej. Supermercado)"
            className="rounded-2xl border border-border bg-background px-3.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="number"
            step="10"
            value={newBudgetLimit}
            onChange={(e) => setNewBudgetLimit(e.target.value)}
            placeholder="Límite mensual ($)"
            className="rounded-2xl border border-border bg-background px-3.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" /> Fijar Presupuesto
          </button>
        </form>

        {/* List of budgets */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const spent = currentMonthExpenses.get(b.category) || 0
            const pct = Math.min(100, (spent / b.limitAmount) * 100)
            const isExceeded = spent > b.limitAmount
            const isWarning = pct >= 75 && !isExceeded

            return (
              <div key={b.id} className="flex flex-col gap-2 rounded-2xl border border-border p-4 bg-background/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    {b.category}
                    {isExceeded && <span title="Límite superado"><ShieldAlert className="h-4 w-4 text-destructive" /></span>}
                    {isWarning && <span title="Cerca del límite"><AlertCircle className="h-4 w-4 text-amber-500" /></span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      ${spent.toLocaleString("es-ES")} / ${b.limitAmount.toLocaleString("es-ES")}
                    </span>
                    <button
                      onClick={() => handleDeleteBudget(b.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Eliminar presupuesto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isExceeded ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-positive"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{pct.toFixed(1)}% gastado</span>
                  <span>{isExceeded ? `Excedido -$${(spent - b.limitAmount).toFixed(0)}` : `Disponible $${(b.limitAmount - spent).toFixed(0)}`}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* SECTION 2: OBJETIVOS DE AHORRO */}
      <section className="rounded-3xl bg-card p-5 sm:p-6 shadow-sm border border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" /> Objetivos de Ahorro (Saving Goals)
            </h2>
            <p className="text-xs text-muted-foreground">Planifica y consigue tus metas financieras a futuro</p>
          </div>
        </div>

        {/* Form add goal */}
        <form onSubmit={handleAddGoal} className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            value={newGoalName}
            onChange={(e) => setNewGoalName(e.target.value)}
            placeholder="Meta (ej. Fondo de Emergencia)"
            className="rounded-2xl border border-border bg-background px-3.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="number"
            value={newGoalTarget}
            onChange={(e) => setNewGoalTarget(e.target.value)}
            placeholder="Objetivo ($)"
            className="rounded-2xl border border-border bg-background px-3.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="number"
            value={newGoalCurrent}
            onChange={(e) => setNewGoalCurrent(e.target.value)}
            placeholder="Ahorrado ya ($)"
            className="rounded-2xl border border-border bg-background px-3.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" /> Crear Meta
          </button>
        </form>

        {/* List of goals */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100)
            const isCompleted = g.currentAmount >= g.targetAmount

            return (
              <div key={g.id} className="flex flex-col gap-3 rounded-2xl border border-border p-4 bg-background/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    {g.name}
                    {isCompleted && <span title="Meta conseguida"><CheckCircle2 className="h-4 w-4 text-positive" /></span>}
                  </span>
                  <button
                    onClick={() => handleDeleteGoal(g.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    title="Eliminar meta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>${g.currentAmount.toLocaleString("es-ES")} de ${g.targetAmount.toLocaleString("es-ES")}</span>
                  <span className="text-positive font-bold">{pct.toFixed(1)}%</span>
                </div>

                <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-positive transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px]">
                  <span className="text-muted-foreground">Aportar:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateGoalAmount(g.id, 50)}
                      className="rounded-full bg-positive/10 px-2.5 py-0.5 font-bold text-positive hover:bg-positive/20"
                    >
                      +$50
                    </button>
                    <button
                      onClick={() => handleUpdateGoalAmount(g.id, 100)}
                      className="rounded-full bg-positive/10 px-2.5 py-0.5 font-bold text-positive hover:bg-positive/20"
                    >
                      +$100
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
