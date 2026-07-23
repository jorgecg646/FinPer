"use server"

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

// ─────────────────────────────────────────────────────────────────────────────
// DB — Schema + Connection
// ─────────────────────────────────────────────────────────────────────────────

const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull().default("local-user"),
  name: text("name").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull(), // "income" | "expense"
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  occurredAt: timestamp("occurredAt", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
})

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
const db = drizzle(pool, { schema: { transactions } })

/**
 * Get active authenticated user ID / email from cookies.
 * Dynamically scopes DB queries and inserts to the logged-in user!
 */
export async function getActiveUserId(): Promise<string> {
  try {
    const cookieStore = await cookies()
    const userCookie = cookieStore.get("finflow_user_id")?.value
    if (userCookie && userCookie.trim()) {
      return decodeURIComponent(userCookie.trim())
    }
  } catch {
    // fallback if outside request context
  }
  return "local-user"
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

export type Summary = {
  balance: number
  income: number
  expenses: number
  selectedYear: number
  availableYears: number[]
  monthly: { key: string; label: string; net: number }[]
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
    category: row.category,
    type: row.type as TxType,
    amount: Number(row.amount),
    occurredAt: (row.occurredAt as Date).toISOString(),
  }
}

function validate(input: TxInput) {
  const name = input.name?.trim()
  const category = input.category?.trim() || "General"
  const type: TxType = input.type === "income" ? "income" : "expense"
  const amount = Math.abs(Number(input.amount))
  if (!name) throw new Error("El nombre es obligatorio")
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("El importe debe ser mayor que 0")
  return { name, category, type, amount }
}

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

// ─────────────────────────────────────────────────────────────────────────────
// Transaction actions — Dynamically Scoped to Active User
// ─────────────────────────────────────────────────────────────────────────────

export async function getTransactions(): Promise<Tx[]> {
  const activeUserId = await getActiveUserId()
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, activeUserId))
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))
  return rows.map(toTx)
}

export async function getSummary(targetYear?: number): Promise<Summary> {
  const txs = await getTransactions()
  const currentYear = new Date().getFullYear()

  // Dynamic available years from dataset
  const yearSet = new Set<number>([currentYear])
  for (const t of txs) {
    const y = new Date(t.occurredAt).getFullYear()
    if (!isNaN(y)) yearSet.add(y)
  }
  const availableYears = [...yearSet].sort((a, b) => b - a)

  const selectedYear = targetYear && availableYears.includes(targetYear) ? targetYear : availableYears[0] || currentYear

  let income = 0
  let expenses = 0
  for (const t of txs) {
    const d = new Date(t.occurredAt)
    if (d.getFullYear() === selectedYear) {
      if (t.type === "income") income += t.amount
      else expenses += t.amount
    }
  }

  // Always start in Enero (index 0) through Diciembre (index 11) for selectedYear
  const buckets: { key: string; label: string; net: number }[] = []
  for (let m = 0; m < 12; m++) {
    buckets.push({ key: `${selectedYear}-${m}`, label: MONTH_LABELS[m], net: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))

  for (const t of txs) {
    const d = new Date(t.occurredAt)
    if (d.getFullYear() === selectedYear) {
      const bucket = byKey.get(`${selectedYear}-${d.getMonth()}`)
      if (bucket) bucket.net += t.type === "income" ? t.amount : -t.amount
    }
  }

  return {
    balance: income - expenses,
    income,
    expenses,
    selectedYear,
    availableYears,
    monthly: buckets,
  }
}

export async function createTransaction(input: TxInput) {
  const activeUserId = await getActiveUserId()
  const { name, category, type, amount } = validate(input)
  await db.insert(transactions).values({
    userId: activeUserId,
    name,
    category,
    type,
    amount: amount.toFixed(2),
    occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
  })
  revalidatePath("/")
}

export async function updateTransaction(id: number, input: TxInput) {
  const activeUserId = await getActiveUserId()
  const { name, category, type, amount } = validate(input)
  await db
    .update(transactions)
    .set({ name, category, type, amount: amount.toFixed(2), ...(input.occurredAt ? { occurredAt: new Date(input.occurredAt) } : {}) })
    .where(and(eq(transactions.id, id), eq(transactions.userId, activeUserId)))
  revalidatePath("/")
}

export async function deleteTransaction(id: number) {
  const activeUserId = await getActiveUserId()
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, activeUserId)))
  revalidatePath("/")
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile stats — Dynamically Scoped to Active User
// ─────────────────────────────────────────────────────────────────────────────

export async function getProfileStats(): Promise<ProfileStats> {
  const activeUserId = await getActiveUserId()
  const rows = await db.select().from(transactions).where(eq(transactions.userId, activeUserId))

  if (rows.length === 0) {
    return { totalTransactions: 0, totalIncome: 0, totalExpenses: 0, balance: 0, avgMonthlyIncome: 0, avgMonthlyExpense: 0, topCategory: null, monthsActive: 0 }
  }

  let totalIncome = 0
  let totalExpenses = 0
  const categoryMap = new Map<string, number>()
  const months = new Set<string>()

  for (const r of rows) {
    const amount = Number(r.amount)
    if (r.type === "income") totalIncome += amount
    else {
      totalExpenses += amount
      categoryMap.set(r.category, (categoryMap.get(r.category) ?? 0) + amount)
    }
    const d = r.occurredAt as Date
    months.add(`${d.getFullYear()}-${d.getMonth()}`)
  }

  const monthsActive = Math.max(1, months.size)
  const topCategory = [...categoryMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    totalTransactions: rows.length,
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    avgMonthlyIncome: totalIncome / monthsActive,
    avgMonthlyExpense: totalExpenses / monthsActive,
    topCategory,
    monthsActive,
  }
}
