import type { TxType } from "@/app/actions"

export type TransactionInput = {
  name: string
  category: string
  type: TxType | string
  amount: number | string
}

export type TransactionImportInput = TransactionInput & {
  occurredAt?: string
  rowNumber?: number
}

export type TransactionImportRejection = {
  row: number
  name: string
  reason: string
}

export type ValidatedTransactionImportRow = {
  row: number
  name: string
  category: string
  type: TxType
  amount: number
  occurredAt: Date
}

export function normalizeCategory(category: string): string {
  return /devoluci[oó]n|reembolso|refund/i.test(category) ? "Reembolso" : category
}

export function validateTransactionInput(input: TransactionInput) {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 200) : ""
  const rawCategory = typeof input.category === "string" ? input.category.trim().slice(0, 100) : ""
  const category = normalizeCategory(rawCategory || "General")
  const rawType = String(input.type ?? "").trim().toLowerCase()
  const amount = Number(input.amount)

  if (!name) throw new Error("El nombre es obligatorio")
  if (rawType !== "income" && rawType !== "expense") {
    throw new Error("El tipo de transacción debe ser 'income' o 'expense'")
  }
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("El importe debe ser mayor que 0")

  const type: TxType = rawType === "income" ? "income" : "expense"
  return { name, category, type, amount }
}

export function validateTransactionDate(value: string | undefined, defaultDate = new Date()): Date {
  if (value === undefined) return defaultDate
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("La fecha de la transacción es obligatoria")
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(value)
  if (
    !Number.isFinite(date.getTime()) ||
    (dateOnly && date.toISOString().slice(0, 10) !== value)
  ) {
    throw new Error("La fecha de la transacción no es válida")
  }
  return date
}

export function validateTransactionImport(inputs: TransactionImportInput[]): {
  accepted: ValidatedTransactionImportRow[]
  rejected: TransactionImportRejection[]
} {
  const accepted: ValidatedTransactionImportRow[] = []
  const rejected: TransactionImportRejection[] = []

  for (const [index, input] of inputs.entries()) {
    const suppliedRowNumber = input?.rowNumber
    const row = typeof suppliedRowNumber === "number" &&
      Number.isSafeInteger(suppliedRowNumber) &&
      suppliedRowNumber > 0
      ? suppliedRowNumber
      : index + 1
    const importName = typeof input?.name === "string" ? input.name.trim().slice(0, 200) : ""

    try {
      if (!input || typeof input !== "object") {
        throw new Error("La fila no contiene una transacción válida")
      }

      const { name, category, type, amount } = validateTransactionInput(input)
      const occurredAt = validateTransactionDate(input.occurredAt)
      accepted.push({ row, name, category, type, amount, occurredAt })
    } catch (error) {
      rejected.push({
        row,
        name: importName || "Sin concepto",
        reason: error instanceof Error ? error.message : "No se pudo validar la fila",
      })
    }
  }

  return { accepted, rejected }
}
