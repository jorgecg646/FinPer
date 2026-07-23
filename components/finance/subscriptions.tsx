"use client"

import { useState, useEffect } from "react"
import { Calendar, Plus, Trash2, CreditCard, Clock } from "lucide-react"

export type Subscription = {
  id: string
  name: string
  amount: number
  frequency: "monthly" | "yearly"
  billingDay: number // 1 to 31
  category: string
}

const SUBS_KEY = "finflow-subscriptions"

const DEFAULT_SUBS: Subscription[] = []

export function SubscriptionsManager() {
  const [subs, setSubs] = useState<Subscription[]>([])

  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [frequency, setFrequency] = useState<"monthly" | "yearly">("monthly")
  const [billingDay, setBillingDay] = useState("1")
  const [category, setCategory] = useState("Suscripciones")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SUBS_KEY)
      setSubs(stored ? JSON.parse(stored) : DEFAULT_SUBS)
    } catch {
      setSubs(DEFAULT_SUBS)
    }
  }, [])

  function saveSubs(list: Subscription[]) {
    setSubs(list)
    localStorage.setItem(SUBS_KEY, JSON.stringify(list))
  }

  function handleAddSub(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    const day = parseInt(billingDay) || 1
    if (!name || isNaN(amt) || amt <= 0) return

    const newSub: Subscription = {
      id: `sub-${Date.now()}`,
      name,
      amount: amt,
      frequency,
      billingDay: day,
      category: category || "Suscripciones",
    }
    const updated = [...subs, newSub]
    saveSubs(updated)
    setName("")
    setAmount("")
  }

  function handleDeleteSub(id: string) {
    saveSubs(subs.filter((s) => s.id !== id))
  }

  // Monthly cost equivalent
  const totalMonthlyCost = subs.reduce((sum, s) => {
    return sum + (s.frequency === "monthly" ? s.amount : s.amount / 12)
  }, 0)

  // Next upcoming billing items in the current month
  const today = new Date().getDate()
  const sortedSubs = [...subs].sort((a, b) => a.billingDay - b.billingDay)

  return (
    <div className="flex flex-col gap-8">
      {/* Overview Card */}
      <section className="rounded-3xl bg-card p-5 sm:p-6 shadow-sm border border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-muted-foreground font-semibold">Coste Total en Suscripciones</span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground mt-1">
              ${totalMonthlyCost.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs text-muted-foreground font-normal"> / mes equiv.</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 bg-secondary px-4 py-2 rounded-2xl self-start sm:self-auto">
            <CreditCard className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold text-foreground">{subs.length} suscripciones activas</span>
          </div>
        </div>
      </section>

      {/* Add Subscription Form */}
      <section className="rounded-3xl bg-card p-5 sm:p-6 shadow-sm border border-border/50">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/50 pb-3">
          <Plus className="h-5 w-5 text-primary" /> Añadir Nueva Suscripción Recurrente
        </h2>

        <form onSubmit={handleAddSub} className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre (ej. Netflix)"
            className="rounded-2xl border border-border bg-background px-3.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Importe ($)"
            className="rounded-2xl border border-border bg-background px-3.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as "monthly" | "yearly")}
            className="rounded-2xl border border-border bg-background px-3.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            <option value="monthly" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100 font-semibold">Mensual</option>
            <option value="yearly" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100 font-semibold">Anual</option>
          </select>
          <input
            type="number"
            min="1"
            max="31"
            value={billingDay}
            onChange={(e) => setBillingDay(e.target.value)}
            placeholder="Día del mes (1-31)"
            className="rounded-2xl border border-border bg-background px-3.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Añadir
          </button>
        </form>
      </section>

      {/* Subscriptions List */}
      <section className="rounded-3xl bg-card p-5 sm:p-6 shadow-sm border border-border/50">
        <h2 className="text-base font-bold text-foreground mb-4">Calendario de Pagos Recurrentes</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedSubs.map((s) => {
            const isDueSoon = s.billingDay >= today && s.billingDay <= today + 5

            return (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-2xl border border-border bg-background/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                      {s.name}
                      {isDueSoon && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                          <Clock className="h-3 w-3" /> Cobro en breve (Día {s.billingDay})
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Día {s.billingDay} de cada {s.frequency === "monthly" ? "mes" : "año"} · {s.category}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs sm:text-sm font-bold text-foreground">
                    ${s.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                  </span>
                  <button
                    onClick={() => handleDeleteSub(s.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    title="Eliminar suscripción"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
