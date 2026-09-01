"use server"

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"
import { and, desc, eq, inArray } from "drizzle-orm"
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

const stockPositions = pgTable("stock_positions", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull().default("local-user"),
  symbol: text("symbol").notNull(),
  label: text("label").notNull(),
  shares: numeric("shares", { precision: 18, scale: 6 }),
  avgPrice: numeric("avgPrice", { precision: 18, scale: 6 }),
  avgFxRate: numeric("avgFxRate", { precision: 18, scale: 6 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
})

function getConnectionString(): string | undefined {
  let connStr = process.env.DATABASE_URL
  if (!connStr) return undefined
  if (connStr.includes("sslmode=require") || connStr.includes("sslmode=prefer")) {
    connStr = connStr.replace(/sslmode=(require|prefer)/g, "sslmode=verify-full")
  }
  return connStr
}

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: true } : false,
  max: 10,
  idleTimeoutMillis: 30000,
})
const db = drizzle(pool, { schema: { transactions, stockPositions } })

// ─────────────────────────────────────────────────────────────────────────────
// Server-side Intelligent Cache & Mutation Tracking
// ─────────────────────────────────────────────────────────────────────────────

type CacheEntry = {
  timestamp: number
  data: Tx[]
}

const memoryCache = new Map<string, CacheEntry>()
const lastMutationTimes = new Map<string, number>()

function invalidateUserCache(userId: string) {
  // Delete cache entry entirely so the next getTransactions() always hits the DB
  memoryCache.delete(userId)
  lastMutationTimes.set(userId, Date.now())
}

/**
 * Get active authenticated user ID / email from cookies.
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
  monthly: { key: string; label: string; net: number; income: number; expense: number }[]
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
  let name = row.name
  let category = row.category
  if (/devoluci[oó]n|reembolso|refund/i.test(category)) {
    category = "Reembolso"
  }
  return {
    id: row.id,
    name,
    category,
    type: row.type as TxType,
    amount: Number(row.amount),
    occurredAt: (row.occurredAt as Date).toISOString(),
  }
}

function validate(input: TxInput) {
  let name = input.name?.trim()
  let category = input.category?.trim() || "General"
  const type: TxType = input.type === "income" ? "income" : "expense"
  const amount = Math.abs(Number(input.amount))

  if (/devoluci[oó]n|reembolso|refund/i.test(category)) {
    category = "Reembolso"
  }

  if (!name) throw new Error("El nombre es obligatorio")
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("El importe debe ser mayor que 0")
  return { name, category, type, amount }
}

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

// ─────────────────────────────────────────────────────────────────────────────
// Transaction actions — Cached & Optimized
// ─────────────────────────────────────────────────────────────────────────────

export async function getTransactions(): Promise<Tx[]> {
  const activeUserId = await getActiveUserId()
  const lastMutation = lastMutationTimes.get(activeUserId) || 0
  const cached = memoryCache.get(activeUserId)

  // Serve instantly from cache if no mutations occurred since last fetch
  if (cached && cached.timestamp > lastMutation) {
    return cached.data
  }

  // Fetch fresh data from DB
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, activeUserId))
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))
  
  const result = rows.map(toTx)

  // Store in cache
  memoryCache.set(activeUserId, {
    timestamp: Date.now(),
    data: result,
  })

  return result
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

  // Select targetYear if specified, otherwise pick the year with transactions or currentYear
  let selectedYear = targetYear && availableYears.includes(targetYear) ? targetYear : currentYear

  if (!targetYear) {
    const hasTxsInCurrentYear = txs.some((t) => new Date(t.occurredAt).getFullYear() === currentYear)
    if (!hasTxsInCurrentYear && availableYears.length > 0) {
      const yearWithTxs = availableYears.find((y) => txs.some((t) => new Date(t.occurredAt).getFullYear() === y))
      if (yearWithTxs) selectedYear = yearWithTxs
    }
  }

  // Investment categories are capital transfers — they don't count as income or expense
  const INVESTMENT_CAT = /invers|trading|broker|myinvestor|trade republic|crypto|cripto|acciones|fondos|etf|bitcoin|binance|degiro|bolsa|patrimonio/i

  function isInvestmentRow(t: Tx): boolean {
    return INVESTMENT_CAT.test(t.category) || INVESTMENT_CAT.test(t.name)
  }

  let income = 0
  let expenses = 0
  for (const t of txs) {
    if (isInvestmentRow(t)) continue // skip capital transfers
    const d = new Date(t.occurredAt)
    if (d.getFullYear() === selectedYear) {
      if (t.type === "income") income += t.amount
      else expenses += t.amount
    }
  }

  // Always start in Enero (index 0) through Diciembre (index 11) for selectedYear
  const buckets: { key: string; label: string; net: number; income: number; expense: number }[] = []
  for (let m = 0; m < 12; m++) {
    buckets.push({ key: `${selectedYear}-${m}`, label: MONTH_LABELS[m], net: 0, income: 0, expense: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))

  for (const t of txs) {
    if (isInvestmentRow(t)) continue // skip capital transfers
    const d = new Date(t.occurredAt)
    if (d.getFullYear() === selectedYear) {
      const bucket = byKey.get(`${selectedYear}-${d.getMonth()}`)
      if (bucket) {
        if (t.type === "income") {
          bucket.income += t.amount
          bucket.net += t.amount
        } else {
          bucket.expense += t.amount
          bucket.net -= t.amount
        }
      }
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

function revalidateAllPaths() {
  // "layout" type invalidates ALL routes sharing the root layout,
  // including the Router Cache on the client side
  revalidatePath("/", "layout")
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
  invalidateUserCache(activeUserId)
  revalidateAllPaths()
}

export async function updateTransaction(id: number, input: TxInput) {
  const activeUserId = await getActiveUserId()
  const { name, category, type, amount } = validate(input)
  await db
    .update(transactions)
    .set({ name, category, type, amount: amount.toFixed(2), ...(input.occurredAt ? { occurredAt: new Date(input.occurredAt) } : {}) })
    .where(and(eq(transactions.id, id), eq(transactions.userId, activeUserId)))
  invalidateUserCache(activeUserId)
  revalidateAllPaths()
}

export async function deleteTransaction(id: number) {
  const activeUserId = await getActiveUserId()
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, activeUserId)))
  invalidateUserCache(activeUserId)
  revalidateAllPaths()
}

export async function createTransactionsBulk(inputs: TxInput[]) {
  if (!inputs.length) return 0
  const activeUserId = await getActiveUserId()

  const records = inputs.map((input) => {
    const { name, category, type, amount } = validate(input)
    return {
      userId: activeUserId,
      name,
      category,
      type,
      amount: amount.toFixed(2),
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
    }
  })

  // Insert all in chunks of 500 to avoid query size limits
  const CHUNK_SIZE = 500
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE)
    await db.insert(transactions).values(chunk)
  }

  invalidateUserCache(activeUserId)
  revalidateAllPaths()
  return records.length
}

export async function deleteTransactionsBulk(ids: number[]) {
  if (!ids.length) return
  const activeUserId = await getActiveUserId()
  await db.delete(transactions).where(and(inArray(transactions.id, ids), eq(transactions.userId, activeUserId)))
  invalidateUserCache(activeUserId)
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
