"use client"

import { useState, useTransition, useMemo } from "react"
import { Plus, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, Search, Download, X, ChevronDown } from "lucide-react"
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
  type Tx,
  type TxInput,
  type TxType,
} from "@/app/actions"
import { PdfImportButton } from "@/components/finance/pdf-import"

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = ["Salario","Freelance","Inversiones","Alquiler","Bonificación","Regalo","Reembolso","Otros ingresos"]
const EXPENSE_CATEGORIES = ["Comida","Supermercado","Transporte","Vivienda","Ocio","Salud","Educación","Suscripciones","Ropa","Viajes","Restaurantes","Tecnología","Deporte","General"]

type FilterType   = "all" | "income" | "expense"
type FilterPeriod = "month" | "3months" | "all"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
}

function todayInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function exportCsv(txs: Tx[]) {
  const header = "ID,Descripción,Categoría,Tipo,Importe,Fecha"
  const rows = txs.map((t) =>
    [t.id, `"${t.name.replace(/"/g, '""')}"`, `"${t.category}"`, t.type === "income" ? "Ingreso" : "Gasto", t.amount.toFixed(2), new Date(t.occurredAt).toLocaleDateString("es-ES")].join(",")
  )
  const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement("a"), { href: url, download: `finflow-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionForm — modal to create / edit a transaction
// ─────────────────────────────────────────────────────────────────────────────

export function TransactionForm({ initial, onSubmit, onClose }: {
  initial?: Tx
  onSubmit: (input: TxInput) => Promise<void> | void
  onClose: () => void
}) {
  const [type, setType]         = useState<TxType>(initial?.type ?? "expense")
  const [name, setName]         = useState(initial?.name ?? "")
  const [category, setCategory] = useState(initial?.category ?? "")
  const [amount, setAmount]     = useState(initial ? String(initial.amount) : "")
  const [date, setDate]         = useState(todayInput(initial?.occurredAt))
  const [error, setError]       = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  function handleTypeChange(newType: TxType) {
    setType(newType)
    if (category && !(newType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).includes(category)) setCategory("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const value = Number(amount)
    if (!name.trim()) return setError("Escribe una descripción")
    if (!Number.isFinite(value) || value <= 0) return setError("El importe debe ser mayor que 0")
    setSaving(true)
    try {
      await onSubmit({ name: name.trim(), category: category || "General", type, amount: value, occurredAt: new Date(date).toISOString() })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="dialog" aria-modal="true" aria-label={initial ? "Editar movimiento" : "Nuevo movimiento"} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{initial ? "Editar movimiento" : "Nuevo movimiento"}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Type toggle */}
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
          {(["income", "expense"] as TxType[]).map((t) => (
            <button key={t} type="button" onClick={() => handleTypeChange(t)}
              className={`rounded-full py-2 text-sm font-semibold transition-colors ${type === t ? (t === "income" ? "bg-positive text-white" : "bg-destructive text-white") : "text-muted-foreground"}`}>
              {t === "income" ? "Ingreso" : "Gasto"}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="Descripción">
            <input id="tx-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Nómina, Supermercado…"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Importe">
              <input id="tx-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
            </Field>
            <Field label="Fecha">
              <input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
            </Field>
          </div>
          <Field label="Categoría">
            <div className="relative">
              <select id="tx-category" value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none rounded-xl border border-border bg-background px-3 py-2 pr-9 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
                <option value="">Seleccionar categoría…</option>
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            </div>
          </Field>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}

        <button type="submit" disabled={saving} id="tx-submit"
          className="mt-5 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
          {saving ? "Guardando…" : initial ? "Guardar cambios" : "Añadir movimiento"}
        </button>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RecentTransactions — filterable list with search, CSV export & CRUD
// ─────────────────────────────────────────────────────────────────────────────

export function RecentTransactions({ transactions, showAll = false, typeFilter }: {
  transactions: Tx[]
  showAll?: boolean
  typeFilter?: FilterType
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing]   = useState<Tx | undefined>(undefined)
  const [pending, startTransition] = useTransition()
  const [search, setSearch]        = useState("")
  const [filterType, setFilterType]     = useState<FilterType>(typeFilter ?? "all")
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("all")

  const filtered = useMemo(() => {
    const now = new Date()
    return transactions.filter((t) => {
      const activeType = typeFilter ?? filterType
      if (activeType !== "all" && t.type !== activeType) return false
      if (filterPeriod !== "all") {
        const monthsBack = filterPeriod === "month" ? 1 : 3
        const cutoff = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1)
        if (new Date(t.occurredAt) < cutoff) return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!t.name.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [transactions, filterType, typeFilter, filterPeriod, search])

  const displayList = showAll ? filtered : filtered.slice(0, 10)
  const isFiltered = (typeFilter ?? filterType) !== "all" || filterPeriod !== "all" || search.trim() !== ""

  async function handleSubmit(input: TxInput) {
    if (editing) await updateTransaction(editing.id, input)
    else await createTransaction(input)
  }

  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Movimientos</h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => exportCsv(filtered)} title="Exportar CSV" aria-label="Exportar CSV"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
            <Download className="h-4 w-4" aria-hidden="true" />
          </button>
          <PdfImportButton />
          <button type="button" id="btn-add-transaction" onClick={() => { setEditing(undefined); setFormOpen(true) }}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            <Plus className="h-4 w-4" aria-hidden="true" />Añadir
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input id="tx-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descripción o categoría…"
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-9 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {!typeFilter && (
          <div className="flex flex-wrap gap-2">
            {(["all", "income", "expense"] as FilterType[]).map((t) => (
              <button key={t} type="button" onClick={() => setFilterType(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                {t === "all" ? "Todos" : t === "income" ? "Ingresos" : "Gastos"}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              {(["month", "3months", "all"] as FilterPeriod[]).map((p) => (
                <button key={p} type="button" onClick={() => setFilterPeriod(p)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterPeriod === p ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
                  {p === "month" ? "Este mes" : p === "3months" ? "3 meses" : "Todo"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isFiltered && <p className="mt-3 text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}</p>}

      {/* List */}
      {displayList.length === 0 ? (
        <p className="mt-8 mb-4 text-center text-sm text-muted-foreground">
          {isFiltered ? "No hay movimientos que coincidan con los filtros." : "Aún no hay movimientos. Añade tu primer ingreso o gasto."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {displayList.map((t) => {
            const isIncome = t.type === "income"
            return (
              <li key={t.id} className="group flex items-center gap-3 py-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isIncome ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"}`} aria-hidden="true">
                  {isIncome ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.category} · {formatDate(t.occurredAt)}</p>
                </div>
                <span className={`text-sm font-bold ${isIncome ? "text-positive" : "text-foreground"}`}>
                  {isIncome ? "+" : "-"}${t.amount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => { setEditing(t); setFormOpen(true) }} aria-label={`Editar ${t.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => startTransition(async () => { await deleteTransaction(t.id) })}
                    disabled={pending} aria-label={`Eliminar ${t.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {!showAll && filtered.length > 10 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">Mostrando 10 de {filtered.length} movimientos</p>
      )}

      {formOpen && <TransactionForm initial={editing} onSubmit={handleSubmit} onClose={() => setFormOpen(false)} />}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Field — form label helper
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
