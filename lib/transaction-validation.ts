import type { TxType } from "@/app/actions"

export type TransactionInput = {
  name: string
  category: string
  type: TxType
  amount: number
}

export function normalizeCategory(category: string): string {
  return /devoluci[oó]n|reembolso|refund/i.test(category) ? "Reembolso" : category
}

export function validateTransactionInput(input: TransactionInput) {
  const name = input.name?.trim()?.slice(0, 200)
  const category = normalizeCategory(input.category?.trim()?.slice(0, 100) || "General")
  const type: TxType = input.type === "income" ? "income" : "expense"
  const amount = Math.abs(Number(input.amount))

  if (!name) throw new Error("El nombre es obligatorio")
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("El importe debe ser mayor que 0")
  return { name, category, type, amount }
}
