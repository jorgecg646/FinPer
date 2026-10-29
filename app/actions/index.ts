"use server"

import { and, desc, eq, inArray } from "drizzle-orm"
import { cache } from "react"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { isInvestmentTx } from "@/lib/finance"
import { calculateSummary, type Summary } from "@/lib/finance-summary"
import {
  normalizeCategory,
  validateTransactionDate,
  validateTransactionImport,
  validateTransactionInput,
  type TransactionImportRejection as ImportRejection,
} from "@/lib/transaction-validation"
import { db, stockPositions, transactions } from "@/lib/db"
import { getSessionSecret, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session"

export type { Summary } from "@/lib/finance-summary"

// ─────────────────────────────────────────────────────────────────────────────
// Server-side Intelligent Cache & Mutation Tracking
// ─────────────────────────────────────────────────────────────────────────────
// Server actions & DB queries (Multi-device synchronized)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the authenticated account or browser-isolated guest session from its signed cookie.
 */
export async function getActiveUserId(): Promise<string> {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = verifySessionToken(sessionCookie, getSessionSecret())
  if (!session) throw new Error("No hay una sesión válida. Recarga la página para crear una sesión de invitado.")
  return `${session.kind === "user" ? "netlify" : "guest"}:${session.subject}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TxType = "income" | "expense"

export type Tx = {
  id: number
  name: string
  category: string
  type: TxType
  amount: number
  occurredAt: string
}

export type TxInput = {
  name: string
  category: string
  type: TxType
  amount: number
  occurredAt?: string
}

export type TransactionImportInput = TxInput & { rowNumber?: number }
export type TransactionImportRejection = ImportRejection

export type TransactionImportResult = {
  accepted: number
  rejected: TransactionImportRejection[]
}

export type StockPosition = {
  id: number
  symbol: string
  label: string
  shares: number | null
  avgPrice: number | null
  avgFxRate: number | null
}

export type ProfileStats = {
  totalTransactions: number
  totalIncome: number
  totalExpenses: number
  balance: number
  avgMonthlyIncome: number
  avgMonthlyExpense: number
  topCategory: string | null
  monthsActive: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toTx(row: typeof transactions.$inferSelect): Tx {
  return {
    id: row.id,
    name: row.name,
    category: normalizeCategory(row.category),
    type: row.type as TxType,
    amount: Number(row.amount),
    occurredAt: (row.occurredAt as Date).toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction actions — Cached & Optimized
// ─────────────────────────────────────────────────────────────────────────────

const getTransactionsForRequest = cache(async (): Promise<Tx[]> => {
  const activeUserId = await getActiveUserId()

  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, activeUserId))
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))
  
  return rows.map(toTx)
})

export async function getTransactions(): Promise<Tx[]> {
  return getTransactionsForRequest()
}

export async function getSummary(targetYear?: number): Promise<Summary> {
  const txs = await getTransactions()
  let cookieYear: number | undefined
  if (!targetYear) {
    try {
      const cookieStore = await cookies()
      const rawCookie = cookieStore.get("finflow_selected_year")?.value
      if (rawCookie) {
        const parsed = Number(rawCookie)
        if (parsed) cookieYear = parsed
      }
    } catch {}
  }

  return calculateSummary(txs, targetYear, cookieYear)
}

function revalidateAllPaths() {
  // "layout" type invalidates ALL routes sharing the root layout,
  // including the Router Cache on the client side
  revalidatePath("/", "layout")
}

export async function createTransaction(input: TxInput) {
  const activeUserId = await getActiveUserId()
  if (!activeUserId) return
  const { name, category, type, amount } = validateTransactionInput(input)
  const occurredAt = validateTransactionDate(input.occurredAt)
  await db.insert(transactions).values({
    userId: activeUserId,
    name,
    category,
    type,
    amount: amount.toFixed(2),
    occurredAt,
  })
  revalidateAllPaths()
}

export async function updateTransaction(id: number, input: TxInput) {
  const activeUserId = await getActiveUserId()
  if (!activeUserId) return
  const { name, category, type, amount } = validateTransactionInput(input)
  const occurredAt = input.occurredAt === undefined
    ? undefined
    : validateTransactionDate(input.occurredAt)
  await db
    .update(transactions)
    .set({ name, category, type, amount: amount.toFixed(2), ...(occurredAt ? { occurredAt } : {}) })
    .where(and(eq(transactions.id, id), eq(transactions.userId, activeUserId)))
  revalidateAllPaths()
}

export async function deleteTransaction(id: number) {
  const activeUserId = await getActiveUserId()
  if (!activeUserId) return
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, activeUserId)))
  revalidateAllPaths()
}

export async function createTransactionsBulk(inputs: TransactionImportInput[]): Promise<TransactionImportResult> {
  if (!inputs.length) return { accepted: 0, rejected: [] }
  const activeUserId = await getActiveUserId()
  const { accepted, rejected } = validateTransactionImport(inputs)
  if (!accepted.length) return { accepted: 0, rejected }

  const CHUNK_SIZE = 500
  await db.transaction(async (tx) => {
    for (let i = 0; i < accepted.length; i += CHUNK_SIZE) {
      const records = accepted.slice(i, i + CHUNK_SIZE).map((record) => ({
        userId: activeUserId,
        name: record.name,
        category: record.category,
        type: record.type,
        amount: record.amount.toFixed(2),
        occurredAt: record.occurredAt,
      }))
      await tx.insert(transactions).values(records)
    }
  })

  revalidateAllPaths()
  return { accepted: accepted.length, rejected }
}

export async function deleteTransactionsBulk(ids: number[]) {
  if (!ids.length) return
  const activeUserId = await getActiveUserId()
  if (!activeUserId) return
  await db.delete(transactions).where(and(inArray(transactions.id, ids), eq(transactions.userId, activeUserId)))
  revalidateAllPaths()
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile stats — Cached & Scoped to Active User
// ─────────────────────────────────────────────────────────────────────────────

export async function getProfileStats(): Promise<ProfileStats> {
  const txs = await getTransactions()

  if (txs.length === 0) {
    return { totalTransactions: 0, totalIncome: 0, totalExpenses: 0, balance: 0, avgMonthlyIncome: 0, avgMonthlyExpense: 0, topCategory: null, monthsActive: 0 }
  }

  let totalIncome = 0
  let totalExpenses = 0
  const categoryMap = new Map<string, number>()
  const months = new Set<string>()

  for (const t of txs) {
    if (t.type === "income") totalIncome += t.amount
    else {
      totalExpenses += t.amount
      categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + t.amount)
    }
    const d = new Date(t.occurredAt)
    months.add(`${d.getFullYear()}-${d.getMonth()}`)
  }

  const monthsActive = Math.max(1, months.size)
  const topCategory = [...categoryMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    totalTransactions: txs.length,
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    avgMonthlyIncome: totalIncome / monthsActive,
    avgMonthlyExpense: totalExpenses / monthsActive,
    topCategory,
    monthsActive,
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Stock Positions — CRUD scoped to active user
// ─────────────────────────────────────────────────────────────────────────────

export async function getStockPositions(): Promise<StockPosition[]> {
  const activeUserId = await getActiveUserId()

  // Fetch fresh data from DB (guarantees multi-device real-time sync)
  const rows = await db
    .select()
    .from(stockPositions)
    .where(eq(stockPositions.userId, activeUserId))
    .orderBy(stockPositions.createdAt)

  return rows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    label: row.label,
    shares: row.shares !== null ? Number(row.shares) : null,
    avgPrice: row.avgPrice !== null ? Number(row.avgPrice) : null,
    avgFxRate: row.avgFxRate !== null ? Number(row.avgFxRate) : null,
  }))
}

export async function upsertStockPosition(data: {
  symbol: string
  label: string
  shares?: number | null
  avgPrice?: number | null
  avgFxRate?: number | null
}): Promise<void> {
  const activeUserId = await getActiveUserId()
  const existing = await db
    .select({ id: stockPositions.id })
    .from(stockPositions)
    .where(and(eq(stockPositions.userId, activeUserId), eq(stockPositions.symbol, data.symbol)))

  const sharesStr = data.shares != null ? String(data.shares) : null
  const avgPriceStr = data.avgPrice != null ? String(data.avgPrice) : null
  const avgFxRateStr = data.avgFxRate != null ? String(data.avgFxRate) : null

  if (existing.length > 0) {
    await db
      .update(stockPositions)
      .set({ label: data.label, shares: sharesStr, avgPrice: avgPriceStr, avgFxRate: avgFxRateStr })
      .where(and(eq(stockPositions.userId, activeUserId), eq(stockPositions.symbol, data.symbol)))
  } else {
    await db.insert(stockPositions).values({
      userId: activeUserId,
      symbol: data.symbol,
      label: data.label,
      shares: sharesStr,
      avgPrice: avgPriceStr,
      avgFxRate: avgFxRateStr,
    })
  }
  revalidatePath("/inversiones")
}

export async function deleteStockPosition(symbol: string): Promise<void> {
  const activeUserId = await getActiveUserId()
  await db
    .delete(stockPositions)
    .where(and(eq(stockPositions.userId, activeUserId), eq(stockPositions.symbol, symbol)))
  revalidatePath("/inversiones")
}
