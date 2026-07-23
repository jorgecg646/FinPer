"use client"

import { useState, useEffect } from "react"
import { Camera, Save, User, TrendingUp, TrendingDown, Activity, Calendar, Tag } from "lucide-react"
import type { ProfileStats } from "@/app/actions"

// ─────────────────────────────────────────────────────────────────────────────
// Local profile (name, plan, avatar stored in localStorage)
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY  = "finflow-profile"
const PLAN_OPTIONS = ["Gratuito", "Básico", "Premium", "Empresarial"]

type LocalProfile = { name: string; plan: string; avatar: string }

function loadProfile(): LocalProfile {
  if (typeof window === "undefined") return { name: "Alex Piter", plan: "Premium", avatar: "/avatar.png" }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { name: "Alex Piter", plan: "Premium", avatar: "/avatar.png" }
  } catch { return { name: "Alex Piter", plan: "Premium", avatar: "/avatar.png" } }
}

// ─────────────────────────────────────────────────────────────────────────────
// StatItem — a single stat row in the financial summary grid
// ─────────────────────────────────────────────────────────────────────────────

function StatItem({ icon: Icon, label, value, accent }: {
  icon: React.ElementType; label: string; value: string; accent?: "positive" | "destructive"
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
        accent === "positive" ? "bg-positive/10 text-positive" : accent === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary-foreground"
      }`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-base font-bold text-foreground">{value}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfileForm — edit personal info + show financial stats
// ─────────────────────────────────────────────────────────────────────────────

export function ProfileForm({ stats }: { stats: ProfileStats }) {
  const [profile, setProfile] = useState<LocalProfile>(loadProfile)
  const [saved, setSaved]     = useState(false)

  useEffect(() => { setProfile(loadProfile()) }, [])

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setProfile((p) => ({ ...p, avatar: reader.result as string }))
    reader.readAsDataURL(file)
  }

  const fmt = (n: number) => `$${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="flex flex-col gap-6">
      {/* Edit form */}
      <section className="rounded-3xl bg-card p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground">Información personal</h2>
        <form onSubmit={handleSave} className="mt-6 flex flex-col gap-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={profile.avatar || "/placeholder.svg"} alt="Avatar" className="h-20 w-20 rounded-full object-cover ring-4 ring-card shadow-md" />
              <label htmlFor="avatar-upload" aria-label="Cambiar foto"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary shadow-sm transition-opacity hover:opacity-90">
                <Camera className="h-3.5 w-3.5 text-primary-foreground" aria-hidden="true" />
                <input id="avatar-upload" type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
              </label>
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{profile.name}</p>
              <p className="text-sm text-muted-foreground">{profile.plan}</p>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Nombre</span>
            <input id="profile-name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Plan</span>
            <select id="profile-plan" value={profile.plan} onChange={(e) => setProfile((p) => ({ ...p, plan: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
              {PLAN_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>

          <button type="submit" id="profile-save"
            className={`mt-1 w-full rounded-full py-3 text-sm font-semibold transition-all ${saved ? "bg-positive text-white" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
            <span className="flex items-center justify-center gap-2">
              <Save className="h-4 w-4" aria-hidden="true" />
              {saved ? "¡Guardado!" : "Guardar cambios"}
            </span>
          </button>
        </form>
      </section>

      {/* Financial stats */}
      <section className="rounded-3xl bg-card p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground">Resumen financiero</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatItem icon={Activity}     label="Transacciones totales" value={String(stats.totalTransactions)} />
          <StatItem icon={Calendar}     label="Meses activo"          value={String(stats.monthsActive)} />
          <StatItem icon={TrendingUp}   label="Total ingresos"        value={fmt(stats.totalIncome)}        accent="positive" />
          <StatItem icon={TrendingDown} label="Total gastos"          value={fmt(stats.totalExpenses)}      accent="destructive" />
          <StatItem icon={TrendingUp}   label="Ingreso medio/mes"     value={fmt(stats.avgMonthlyIncome)}   accent="positive" />
          <StatItem icon={TrendingDown} label="Gasto medio/mes"       value={fmt(stats.avgMonthlyExpense)}  accent="destructive" />
          {stats.topCategory && <StatItem icon={Tag} label="Categoría principal" value={stats.topCategory} />}
          <StatItem icon={User} label="Balance neto" value={fmt(stats.balance)} accent={stats.balance >= 0 ? "positive" : "destructive"} />
        </div>
      </section>
    </div>
  )
}
