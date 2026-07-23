"use client"

import { useState, useRef, useCallback, useTransition } from "react"
import {
  Upload, FileText, X, CheckSquare, Square, ChevronDown,
  AlertTriangle, CheckCircle, Loader2, ArrowUpRight, ArrowDownLeft,
  FileUp, RotateCcw,
} from "lucide-react"
import { createTransaction } from "@/app/actions"
import type { ParsedTransaction } from "@/app/api/parse-pdf/route"

// ─────────────────────────────────────────────────────────────────────────────
// Category options (must match TransactionForm lists)
// ─────────────────────────────────────────────────────────────────────────────

const INCOME_CATS  = ["Salario","Freelance","Inversiones","Alquiler","Bonificación","Regalo","Reembolso","Otros ingresos"]
const EXPENSE_CATS = ["Comida","Supermercado","Transporte","Vivienda","Ocio","Salud","Educación","Suscripciones","Ropa","Viajes","Restaurantes","Tecnología","Deporte","General"]

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ConfidenceBadge({ c }: { c: ParsedTransaction["confidence"] }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      c === "high" ? "bg-positive/10 text-positive" :
      c === "medium" ? "bg-amber-100 text-amber-700" :
      "bg-destructive/10 text-destructive"
    }`}>
      {c === "high" ? "Alta" : c === "medium" ? "Media" : "Baja"}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DropZone — file picker / drag-and-drop area
// ─────────────────────────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.type === "application/pdf") onFile(file)
  }, [onFile])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 transition-all ${
        dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-secondary/50"
      }`}
    >
      <div className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors ${dragging ? "bg-primary/10" : "bg-secondary"}`}>
        <FileUp className={`h-7 w-7 transition-colors ${dragging ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">
          {dragging ? "Suelta el PDF aquí" : "Arrastra tu extracto bancario"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">o haz clic para seleccionar · PDF · máx. 20 MB</p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Compatible con BBVA, Santander, CaixaBank, ING, Sabadell, Bankinter y más
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Row editor — one detected transaction
// ─────────────────────────────────────────────────────────────────────────────

type EditableTx = ParsedTransaction & { selected: boolean }

function TxRow({
  tx,
  onToggle,
  onChange,
}: {
  tx: EditableTx
  onToggle: () => void
  onChange: (patch: Partial<EditableTx>) => void
}) {
  const cats = tx.type === "income" ? INCOME_CATS : EXPENSE_CATS

  return (
    <tr className={`border-b border-border text-sm transition-colors ${tx.selected ? "" : "opacity-40"}`}>
      {/* Checkbox */}
      <td className="py-2 pl-2 pr-1">
        <button type="button" onClick={onToggle} aria-label={tx.selected ? "Deseleccionar" : "Seleccionar"}>
          {tx.selected
            ? <CheckSquare className="h-4 w-4 text-primary" />
            : <Square className="h-4 w-4 text-muted-foreground" />}
        </button>
      </td>

      {/* Date */}
      <td className="px-2 py-2">
        <input
          type="date"
          value={tx.date}
          onChange={(e) => onChange({ date: e.target.value })}
          className="w-32 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
      </td>

      {/* Description */}
      <td className="px-2 py-2">
        <input
          value={tx.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full min-w-[140px] rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
      </td>

      {/* Type toggle */}
      <td className="px-2 py-2">
        <button
          type="button"
          onClick={() => onChange({ type: tx.type === "income" ? "expense" : "income", category: "" })}
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
            tx.type === "income" ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"
          }`}
        >
          {tx.type === "income"
            ? <><ArrowUpRight className="h-3 w-3" />Ingreso</>
            : <><ArrowDownLeft className="h-3 w-3" />Gasto</>}
        </button>
      </td>

      {/* Amount */}
      <td className="px-2 py-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={tx.amount}
          onChange={(e) => onChange({ amount: parseFloat(e.target.value) || 0 })}
          className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-right text-xs outline-none focus:ring-1 focus:ring-ring"
        />
      </td>

      {/* Category */}
      <td className="px-2 py-2">
        <div className="relative">
          <select
            value={tx.category}
            onChange={(e) => onChange({ category: e.target.value })}
            className="w-36 appearance-none rounded-lg border border-border bg-background px-2 py-1 pr-6 text-xs outline-none focus:ring-1 focus:ring-ring"
          >
            {!cats.includes(tx.category) && <option value={tx.category}>{tx.category}</option>}
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        </div>
      </td>

      {/* Confidence */}
      <td className="px-2 py-2">
        <ConfidenceBadge c={tx.confidence} />
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PdfImportModal — main modal
// ─────────────────────────────────────────────────────────────────────────────

type Step = "upload" | "parsing" | "review" | "importing" | "done"

export function PdfImportModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("upload")
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState("")
  const [txs, setTxs] = useState<EditableTx[]>([])
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all")
  const [importedCount, setImportedCount] = useState(0)
  const [isPending, startTransition] = useTransition()

  // ── Parse PDF ──────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setFileName(file.name)
    setError(null)
    setStep("parsing")

    try {
      const fd = new FormData()
      fd.append("file", file)

      const res = await fetch("/api/parse-pdf", { method: "POST", body: fd })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || "Error desconocido")
      if (!json.transactions?.length) {
        setError("No se detectaron transacciones en este PDF. Comprueba que es un extracto bancario con texto seleccionable (no escaneado).")
        setStep("upload")
        return
      }

      setTxs(json.transactions.map((t: ParsedTransaction) => ({ ...t, selected: true })))
      setStep("review")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar el PDF")
      setStep("upload")
    }
  }

  // ── Import selected ────────────────────────────────────────────────────────

  function handleImport() {
    const selected = txs.filter((t) => t.selected)
    if (!selected.length) return

    setStep("importing")
    startTransition(async () => {
      let count = 0
      for (const tx of selected) {
        try {
          await createTransaction({
            name: tx.name,
            category: tx.category,
            type: tx.type,
            amount: tx.amount,
            occurredAt: new Date(tx.date).toISOString(),
          })
          count++
        } catch {
          // silently skip invalid rows
        }
      }
      setImportedCount(count)
      setStep("done")
    })
  }

  // ── Bulk select helpers ────────────────────────────────────────────────────

  const selectedCount = txs.filter((t) => t.selected).length
  const allSelected   = selectedCount === txs.length
  const visible       = txs.filter((t) => filter === "all" || t.type === filter)

  function toggleAll() {
    setTxs((prev) =>
      prev.map((t) =>
        filter === "all" || t.type === filter ? { ...t, selected: !allSelected } : t
      )
    )
  }

  function reset() {
    setStep("upload")
    setTxs([])
    setError(null)
    setFileName("")
    setFilter("all")
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Importar PDF bancario"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full max-w-4xl flex-col rounded-3xl bg-card shadow-2xl" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Importar extracto bancario</h2>
              {fileName && <p className="text-xs text-muted-foreground truncate max-w-xs">{fileName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === "review" && (
              <button type="button" onClick={reset} title="Subir otro PDF"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Upload step ── */}
          {step === "upload" && (
            <div className="p-6">
              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              <DropZone onFile={handleFile} />
              <div className="mt-4 rounded-2xl bg-secondary p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">💡 Consejos para mejores resultados</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• Usa el extracto en PDF <strong>descargado del banco</strong> (no escaneado)</li>
                  <li>• PDFs con texto seleccionable funcionan mucho mejor que imágenes</li>
                  <li>• Puedes revisar y editar cada transacción antes de importar</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Parsing step ── */}
          {step === "parsing" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Analizando el PDF…</p>
                <p className="mt-1 text-xs text-muted-foreground">Extrayendo y procesando las transacciones</p>
              </div>
            </div>
          )}

          {/* ── Review step ── */}
          {step === "review" && (
            <div className="flex flex-col gap-4 p-6">
              {/* Summary bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-2">
                  {(["all", "income", "expense"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setFilter(f)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}>
                      {f === "all" ? `Todos (${txs.length})` : f === "income" ? `Ingresos (${txs.filter(t => t.type === "income").length})` : `Gastos (${txs.filter(t => t.type === "expense").length})`}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{selectedCount} seleccionados</span>
                  <button type="button" onClick={toggleAll}
                    className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground">
                    {allSelected ? <><Square className="h-3 w-3" />Ninguno</> : <><CheckSquare className="h-3 w-3" />Todos</>}
                  </button>
                </div>
              </div>

              {txs.some(t => t.confidence === "low") && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-700">
                    Algunas filas tienen <strong>confianza baja</strong> — revísalas antes de importar. Puedes editar cualquier campo directamente en la tabla.
                  </p>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50 text-left text-xs text-muted-foreground">
                      <th className="py-2 pl-2 pr-1 w-8">
                        <button type="button" onClick={toggleAll} aria-label="Seleccionar todos">
                          {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                        </button>
                      </th>
                      <th className="px-2 py-2">Fecha</th>
                      <th className="px-2 py-2">Concepto</th>
                      <th className="px-2 py-2">Tipo</th>
                      <th className="px-2 py-2 text-right">Importe</th>
                      <th className="px-2 py-2">Categoría</th>
                      <th className="px-2 py-2">Precisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((tx) => (
                      <TxRow
                        key={tx.id}
                        tx={tx}
                        onToggle={() => setTxs((prev) => prev.map((t) => t.id === tx.id ? { ...t, selected: !t.selected } : t))}
                        onChange={(patch) => setTxs((prev) => prev.map((t) => t.id === tx.id ? { ...t, ...patch } : t))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Importing step ── */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-semibold text-foreground">Importando transacciones…</p>
            </div>
          )}

          {/* ── Done step ── */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-positive/10">
                <CheckCircle className="h-8 w-8 text-positive" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">¡Importación completada!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se importaron <strong>{importedCount}</strong> transacciones correctamente.
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={reset}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary">
                  Importar otro PDF
                </button>
                <button type="button" onClick={onClose}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  Ver transacciones
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer — import button */}
        {step === "review" && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <p className="text-xs text-muted-foreground">
              {selectedCount === 0 ? "Selecciona al menos una transacción" : `${selectedCount} de ${txs.length} transacciones seleccionadas`}
            </p>
            <button
              type="button"
              id="btn-import-pdf-confirm"
              onClick={handleImport}
              disabled={selectedCount === 0 || isPending}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Importar {selectedCount > 0 ? `${selectedCount} transacción${selectedCount !== 1 ? "es" : ""}` : "seleccionadas"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PdfImportButton — trigger button (used in RecentTransactions header)
// ─────────────────────────────────────────────────────────────────────────────

export function PdfImportButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        id="btn-import-pdf"
        onClick={() => setOpen(true)}
        title="Importar extracto bancario (PDF)"
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Importar PDF</span>
      </button>
      {open && <PdfImportModal onClose={() => setOpen(false)} />}
    </>
  )
}
