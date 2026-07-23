"use server"

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

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

// Single-user app: every row is scoped to this constant owner
const OWNER = "local-user"

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
// Transaction actions
// ─────────────────────────────────────────────────────────────────────────────

export async function getTransactions(): Promise<Tx[]> {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, OWNER))
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))
  return rows.map(toTx)
}

export async function getSummary(): Promise<Summary> {
  const txs = await getTransactions()
  let income = 0
  let expenses = 0
  for (const t of txs) {
    if (t.type === "income") income += t.amount
    else expenses += t.amount
  }

  // Net balance per month for the last 6 months
  const now = new Date()
  const buckets: { key: string; label: string; net: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_LABELS[d.getMonth()], net: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const t of txs) {
    const d = new Date(t.occurredAt)
    const bucket = byKey.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (bucket) bucket.net += t.type === "income" ? t.amount : -t.amount
  }

  return { balance: income - expenses, income, expenses, monthly: buckets }
}

export async function createTransaction(input: TxInput) {
  const { name, category, type, amount } = validate(input)
  await db.insert(transactions).values({
    userId: OWNER,
    name,
    category,
    type,
    amount: amount.toFixed(2),
    occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
  })
  revalidatePath("/")
}

export async function updateTransaction(id: number, input: TxInput) {
  const { name, category, type, amount } = validate(input)
  await db
    .update(transactions)
    .set({ name, category, type, amount: amount.toFixed(2), ...(input.occurredAt ? { occurredAt: new Date(input.occurredAt) } : {}) })
    .where(and(eq(transactions.id, id), eq(transactions.userId, OWNER)))
  revalidatePath("/")
}

export async function deleteTransaction(id: number) {
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, OWNER)))
  revalidatePath("/")
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile stats
// ─────────────────────────────────────────────────────────────────────────────

export async function getProfileStats(): Promise<ProfileStats> {
  const rows = await db.select().from(transactions).where(eq(transactions.userId, OWNER))

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
