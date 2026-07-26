"use client"

import { useState, useEffect, useTransition, useMemo, useCallback } from "react"
import {
  Plus, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, Search, Download, X, ChevronDown, CheckSquare, Square,
  Briefcase, Laptop, TrendingUp, Home, Gift, RefreshCw, DollarSign,
  Utensils, ShoppingCart, Bus, HeartPulse, GraduationCap, Tv, Shirt, Plane, Smartphone, Dumbbell, Tag, Sparkles
} from "lucide-react"
import {
  createTransaction,
  deleteTransaction,
  deleteTransactionsBulk,
  updateTransaction,
  type Tx,
  type TxInput,
  type TxType,
} from "@/app/actions"
import { ExcelImportButton } from "@/components/finance/excel-import"
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = ["Salario", "Freelance", "Inversiones", "Alquiler", "Bonificación", "Regalo", "Reembolso", "Ocio", "Otros ingresos"]
const EXPENSE_CATEGORIES = ["Comida", "Supermercado", "Transporte", "Vivienda", "Ocio", "Salud", "Educación", "Suscripciones", "Ropa", "Viajes", "Restaurantes", "Tecnología", "Deporte", "Inversiones", "Reembolso", "General"]

function getCategoryIcon(category: string, type: TxType) {
  switch (category) {
    // Ingresos
    case "Salario": return Briefcase
    case "Freelance": return Laptop
    case "Inversiones": return TrendingUp
    case "Alquiler": return Home
    case "Bonificación": return Gift
    case "Regalo": return Gift
    case "Reembolso": return RefreshCw
    case "Otros ingresos": return DollarSign

    // Gastos
    case "Comida": return Utensils
    case "Restaurantes": return Utensils
    case "Supermercado": return ShoppingCart
    case "Transporte": return Bus
    case "Vivienda": return Home
    case "Ocio": return Tv
    case "Salud": return HeartPulse
    case "Educación": return GraduationCap
    case "Suscripciones": return Tv
    case "Ropa": return Shirt
    case "Viajes": return Plane
    case "Tecnología": return Smartphone
    case "Deporte": return Dumbbell
    case "Inversiones": return TrendingUp
    case "General": default:
      return type === "income" ? ArrowUpRight : ArrowDownLeft
  }
}

type FilterType = "all" | "income" | "expense"
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
  const a = Object.assign(document.createElement("a"), { href: url, download: `BudgetNext-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// DeleteConfirmModal — confirmation dialog for deleting transactions
// ─────────────────────────────────────────────────────────────────────────────

export function DeleteConfirmModal({ tx, onConfirm, onClose, isDeleting }: {
  tx: Tx
  onConfirm: () => Promise<void> | void
  onClose: () => void
  isDeleting?: boolean
}) {
  const isIncome = tx.type === "income"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog" aria-modal="true" aria-label="Confirmar eliminación" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-xl border border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">¿Eliminar movimiento?</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Se borrará permanentemente "{tx.name}".</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-secondary/50 p-3 text-xs">
          <p className="font-semibold text-foreground">{tx.name}</p>
          <p className="mt-0.5 text-muted-foreground">{tx.category} · {formatDate(tx.occurredAt)}</p>
          <p className={`mt-1 font-bold ${isIncome ? "text-positive" : "text-foreground"}`}>
            {isIncome ? "+" : "-"}${tx.amount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isDeleting}
            className="rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={isDeleting} id="btn-confirm-delete"
            className="rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
            {isDeleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionForm — modal to create / edit a transaction
// ─────────────────────────────────────────────────────────────────────────────

export function TransactionForm({ initial, defaultYear, defaultCategory, onSubmit, onDelete, onClose }: {
  initial?: Tx
  defaultYear?: number
  defaultCategory?: string
  onSubmit: (input: TxInput) => Promise<void> | void
  onDelete?: (id: number) => Promise<void> | void
  onClose: () => void
}) {
  const [type, setType] = useState<TxType>(initial?.type ?? "expense")
  const [name, setName] = useState(initial?.name ?? "")
  const [category, setCategory] = useState(initial?.category ?? defaultCategory ?? "")
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "")

  const defaultIso = initial
    ? todayInput(initial.occurredAt)
    : defaultYear && defaultYear !== new Date().getFullYear()
    ? `${defaultYear}-01-01`
    : todayInput()

  const [date, setDate] = useState(defaultIso)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Debounced AI suggestion: fires when name changes and category is empty
  useEffect(() => {
    if (category || !name.trim() || name.trim().length < 3) {
      setAiSuggestion(null)
      return
    }

    const timer = setTimeout(async () => {
      setAiLoading(true)
      try {
        const res = await fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ id: "suggest", raw: name.trim(), type }],
          }),
        })
        if (res.ok) {
          const { results } = await res.json()
          const suggestion = results?.[0]
          if (suggestion?.aiClassified && suggestion.category) {
            setAiSuggestion(suggestion.category)
          } else {
            setAiSuggestion(null)
          }
        }
      } catch {
        // Silent fail
      } finally {
        setAiLoading(false)
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [name, type, category])

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

    let finalName = name.trim()
    let finalCategory = category || defaultCategory || "General"

    if (/devoluci[oó]n|reembolso|refund/i.test(finalName) || /devoluci[oó]n|reembolso/i.test(finalCategory)) {
      finalName = "Devolución"
      finalCategory = "Reembolso"
    } else if (
      /trading|invest|broker|myinvestor|trade|crypto|cripto|acciones|fondos|etf|bitcoin|binance|degiro|bolsa/i.test(finalName) &&
      (finalCategory === "General" || !finalCategory)
    ) {
      finalCategory = "Inversiones"
    }

    setSaving(true)
    try {
      const occurredAtIso = date.includes("T") ? new Date(date).toISOString() : new Date(`${date}T12:00:00Z`).toISOString()
      await onSubmit({ name: finalName, category: finalCategory, type, amount: value, occurredAt: occurredAtIso })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar")
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initial || !onDelete) return
    setDeleting(true)
    try {
      await onDelete(initial.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar")
      setDeleting(false)
      setConfirmingDelete(false)
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
              <select id="tx-category" value={category} onChange={(e) => { setCategory(e.target.value); setAiSuggestion(null) }}
                className="w-full appearance-none rounded-xl border border-border bg-background px-3 py-2 pr-9 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
                <option value="">Seleccionar categoría…</option>
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            </div>
            {/* AI category suggestion */}
            {!category && (aiLoading || aiSuggestion) && (
              <div className="flex items-center gap-2 mt-1.5">
                {aiLoading && !aiSuggestion && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3 animate-pulse text-violet-500" />
                    Sugiriendo categoría…
                  </span>
                )}
                {aiSuggestion && !aiLoading && (
                  <button
                    type="button"
                    onClick={() => { setCategory(aiSuggestion); setAiSuggestion(null) }}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-200"
                    title="Aplicar sugerencia de Gemini AI"
                  >
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    IA sugiere: {aiSuggestion}
                  </button>
                )}
              </div>
            )}
          </Field>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}

        <div className="mt-5 flex items-center gap-2">
          {initial && onDelete && (
            confirmingDelete ? (
              <div className="flex w-full gap-2">
                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting}
                  className="flex-1 rounded-full bg-secondary py-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-60">
                  Cancelar
                </button>
                <button type="button" onClick={handleDelete} disabled={deleting} id="tx-delete-confirm"
                  className="flex-1 rounded-full bg-destructive py-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                  {deleting ? "Eliminando…" : "Confirmar eliminar"}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmingDelete(true)} disabled={saving} id="tx-delete-trigger"
                className="flex items-center justify-center rounded-full bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-60"
                title="Eliminar este movimiento" aria-label="Eliminar movimiento">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )
          )}
          {!confirmingDelete && (
            <button type="submit" disabled={saving} id="tx-submit"
              className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
              {saving ? "Guardando…" : initial ? "Guardar cambios" : "Añadir movimiento"}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RecentTransactions — filterable list with search, CSV export & CRUD
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

export function RecentTransactions({ transactions, showAll = false, typeFilter, selectedYear, defaultCategory }: {
  transactions: Tx[]
  showAll?: boolean
  typeFilter?: FilterType
  selectedYear?: number
  defaultCategory?: string
}) {
  const now = new Date()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Tx | undefined>(undefined)
  const [deletingTx, setDeletingTx] = useState<Tx | null>(null)
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<FilterType>(typeFilter ?? "all")
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("all")
  // Month/Year filters for the full transaction view (ingresos/gastos pages)
  const [filterMonth, setFilterMonth] = useState<number | "all">("all")
  const [filterYear, setFilterYear] = useState<number | "all">(selectedYear ?? "all")

  useEffect(() => {
    if (selectedYear !== undefined) {
      setFilterYear(selectedYear)
    }
  }, [selectedYear])

  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState<number | "all">(10)

  // Available years derived from transactions data for the year selector
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    for (const t of transactions) years.add(new Date(t.occurredAt).getFullYear())
    return [...years].sort((a, b) => b - a)
  }, [transactions])

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const activeType = typeFilter ?? filterType
      if (activeType !== "all" && t.type !== activeType) return false

      const d = new Date(t.occurredAt)

      if (showAll) {
        // Full view: filter by specific year and/or month
        if (filterYear !== "all" && d.getFullYear() !== filterYear) return false
        if (filterMonth !== "all" && d.getMonth() !== filterMonth) return false
      } else {
        // Dashboard compact view: filter by relative period
        if (filterPeriod !== "all") {
          const monthsBack = filterPeriod === "month" ? 1 : 3
          const cutoff = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1)
          if (d < cutoff) return false
        }
      }

      if (search.trim()) {
        const q = search.toLowerCase()
        if (!t.name.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [transactions, filterType, typeFilter, filterPeriod, filterMonth, filterYear, showAll, search])

  // Reset pagination when filters change
  const totalItems = filtered.length
  const effectiveItemsPerPage = itemsPerPage === "all" ? Math.max(1, totalItems) : itemsPerPage
  const totalPages = Math.ceil(totalItems / (typeof effectiveItemsPerPage === "number" ? effectiveItemsPerPage : 1)) || 1

  const safeCurrentPage = Math.min(currentPage, totalPages)

  const displayList = useMemo(() => {
    if (!showAll) {
      return filtered.slice(0, 10)
    }
    if (itemsPerPage === "all") {
      return filtered
    }
    const start = (safeCurrentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, showAll, itemsPerPage, safeCurrentPage])

  const isFiltered = (typeFilter ?? filterType) !== "all" || filterPeriod !== "all" || search.trim() !== "" || filterMonth !== "all" || filterYear !== "all"

  const allFilteredSelected = filtered.length > 0 && filtered.every((t) => selectedIds.includes(t.id))

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map((t) => t.id))
    }
  }

  function toggleSelectTx(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  function dispatchMutation() {
    window.dispatchEvent(new Event("data-mutated"))
  }

  async function handleSubmit(input: TxInput) {
    if (editing) await updateTransaction(editing.id, input)
    else await createTransaction(input)

    const txYear = input.occurredAt ? new Date(input.occurredAt).getFullYear() : new Date().getFullYear()
    if (showAll && filterYear !== "all" && filterYear !== txYear) {
      setFilterYear(txYear)
    }

    dispatchMutation()
  }

  async function handleDelete(id: number) {
    startTransition(async () => {
      await deleteTransaction(id)
      dispatchMutation()
    })
  }

  async function handleBulkDelete() {
    startTransition(async () => {
      await deleteTransactionsBulk(selectedIds)
      setSelectedIds([])
      setConfirmingBulkDelete(false)
      dispatchMutation()
    })
  }

  const periodLabel = filterPeriod === "month" ? "este mes" : filterPeriod === "3months" ? "los últimos 3 meses" : "todo el historial"

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
          <ExcelImportButton />
          <button type="button" id="btn-add-transaction" onClick={() => { setEditing(undefined); setFormOpen(true) }}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            <Plus className="h-4 w-4" aria-hidden="true" />Añadir
          </button>
        </div>
      </div>

      {/* Filters & Bulk Toolbar */}
      <div className="mt-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input id="tx-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder="Buscar por descripción o categoría…"
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-9 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
          {search && (
            <button type="button" onClick={() => { setSearch(""); setCurrentPage(1) }} aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Full-view: month + year pickers */}
        {showAll && (
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {/* Year selector */}
              <select
                value={filterYear === "all" ? "all" : String(filterYear)}
                onChange={(e) => { setFilterYear(e.target.value === "all" ? "all" : parseInt(e.target.value)); setCurrentPage(1) }}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                aria-label="Filtrar por año"
              >
                <option value="all">Todos los años</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {/* Month selector */}
              <select
                value={filterMonth === "all" ? "all" : String(filterMonth)}
                onChange={(e) => { setFilterMonth(e.target.value === "all" ? "all" : parseInt(e.target.value)); setCurrentPage(1) }}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                aria-label="Filtrar por mes"
              >
                <option value="all">Todos los meses</option>
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>

              {/* Reset filters */}
              {(filterMonth !== "all" || filterYear !== "all") && (
                <button
                  type="button"
                  onClick={() => { setFilterMonth("all"); setFilterYear("all"); setCurrentPage(1) }}
                  className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                  aria-label="Limpiar filtros de fecha"
                >
                  <X className="h-3 w-3" />
                  Limpiar
                </button>
              )}
            </div>

            {/* Type filter — only visible in all-types view */}
            {!typeFilter && (
              <div className="flex gap-2">
                {(["all", "income", "expense"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => { setFilterType(t); setCurrentPage(1) }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                    {t === "all" ? "Todos" : t === "income" ? "Ingresos" : "Gastos"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dashboard compact view: relative period buttons */}
        {!showAll && !typeFilter && (
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              {(["all", "income", "expense"] as const).map((t) => (
                <button key={t} type="button" onClick={() => { setFilterType(t); setCurrentPage(1) }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                  {t === "all" ? "Todos" : t === "income" ? "Ingresos" : "Gastos"}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              {(["month", "3months", "all"] as const).map((p) => (
                <button key={p} type="button" onClick={() => { setFilterPeriod(p); setSelectedIds([]); setCurrentPage(1) }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterPeriod === p ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
                  {p === "month" ? "Este mes" : p === "3months" ? "3 meses" : "Todo"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selection Bar */}
        <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
          <button type="button" onClick={toggleSelectAll} className="flex items-center gap-1.5 hover:text-foreground">
            {allFilteredSelected
              ? <CheckSquare className="h-4 w-4 text-primary" />
              : <Square className="h-4 w-4" />}
            <span>Seleccionar todo ({filtered.length} de {periodLabel})</span>
          </button>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmingBulkDelete(true)}
              className="flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar {selectedIds.length} seleccionado{selectedIds.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {isFiltered && <p className="mt-2 text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}</p>}

      {/* List */}
      {displayList.length === 0 ? (
        <p className="mt-8 mb-4 text-center text-sm text-muted-foreground">
          {isFiltered ? "No hay movimientos que coincidan con los filtros." : "Aún no hay movimientos. Añade tu primer ingreso o gasto."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {displayList.map((t) => {
            const isIncome = t.type === "income"
            const isSelected = selectedIds.includes(t.id)
            const Icon = getCategoryIcon(t.category, t.type)
            return (
              <li key={t.id} className="group flex items-center gap-3 py-3">
                <button type="button" onClick={() => toggleSelectTx(t.id)} aria-label="Seleccionar transacción">
                  {isSelected
                    ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                    : <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isIncome ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"}`} aria-hidden="true">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${isIncome ? "text-positive" : "text-destructive"}`}>{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.category} · {formatDate(t.occurredAt)}</p>
                </div>
                <span className={`text-sm font-bold ${isIncome ? "text-positive" : "text-foreground"}`}>
                  {isIncome ? "+" : "-"}${t.amount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
                  <button type="button" onClick={() => { setEditing(t); setFormOpen(true) }} aria-label={`Editar ${t.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setDeletingTx(t)}
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

      {/* Pagination Controls */}
      {showAll ? (
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Mostrar:</span>
            <select
              id="tx-items-per-page"
              value={itemsPerPage}
              onChange={(e) => {
                const val = e.target.value
                setItemsPerPage(val === "all" ? "all" : Number(val))
                setCurrentPage(1)
              }}
              className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={10}>10 por pág.</option>
              <option value={20}>20 por pág.</option>
              <option value={50}>50 por pág.</option>
              <option value="all">Ver todos ({totalItems})</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span>
              {totalItems === 0
                ? "0 de 0"
                : itemsPerPage === "all"
                ? `1-${totalItems} de ${totalItems}`
                : `${(safeCurrentPage - 1) * (itemsPerPage as number) + 1}-${Math.min(safeCurrentPage * (itemsPerPage as number), totalItems)} de ${totalItems}`}
            </span>

            {itemsPerPage !== "all" && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
                    .reduce<(number | string)[]>((acc, page, idx, arr) => {
                      if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                        acc.push("...")
                      }
                      acc.push(page)
                      return acc
                    }, [])
                    .map((item, idx) =>
                      typeof item === "number" ? (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrentPage(item)}
                          className={`h-7 w-7 rounded-lg text-xs font-semibold transition-colors ${
                            safeCurrentPage === item
                              ? "bg-primary text-primary-foreground"
                              : "bg-background border border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          {item}
                        </button>
                      ) : (
                        <span key={`dots-${idx}`} className="px-1 text-muted-foreground">
                          ...
                        </span>
                      )
                    )}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        filtered.length > 10 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">Mostrando 10 de {filtered.length} movimientos</p>
        )
      )}

      {formOpen && (
        <TransactionForm
          initial={editing}
          defaultYear={typeof filterYear === "number" ? filterYear : selectedYear}
          defaultCategory={defaultCategory}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          onClose={() => setFormOpen(false)}
        />
      )}

      {deletingTx && (
        <DeleteConfirmModal
          tx={deletingTx}
          isDeleting={pending}
          onConfirm={async () => {
            await handleDelete(deletingTx.id)
            setDeletingTx(null)
          }}
          onClose={() => setDeletingTx(null)}
        />
      )}

      {confirmingBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog" aria-modal="true" aria-label="Confirmar eliminación masiva" onClick={() => setConfirmingBulkDelete(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">¿Eliminar {selectedIds.length} movimientos?</h3>
                <p className="text-xs text-muted-foreground">Se eliminarán todos los elementos seleccionados de ({periodLabel}). Esta acción no se puede deshacer.</p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setConfirmingBulkDelete(false)} disabled={pending}
                className="rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={handleBulkDelete} disabled={pending} id="btn-confirm-bulk-delete"
                className="rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                {pending ? "Eliminando…" : `Eliminar (${selectedIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
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
