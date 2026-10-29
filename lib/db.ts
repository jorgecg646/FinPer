import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { index, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    userId: text("userId").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    type: text("type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    occurredAt: timestamp("occurredAt", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("transactions_user_occurred_id_idx").on(
      table.userId,
      table.occurredAt.desc(),
      table.id.desc()
    ),
  ]
)

export const stockPositions = pgTable("stock_positions", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  symbol: text("symbol").notNull(),
  label: text("label").notNull(),
  shares: numeric("shares", { precision: 18, scale: 6 }),
  avgPrice: numeric("avgPrice", { precision: 18, scale: 6 }),
  avgFxRate: numeric("avgFxRate", { precision: 18, scale: 6 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
})

function getConnectionString(): string | undefined {
  let connectionString = process.env.DATABASE_URL
  if (!connectionString) return undefined
  if (connectionString.includes("sslmode=require") || connectionString.includes("sslmode=prefer")) {
    connectionString = connectionString.replace(/sslmode=(require|prefer)/g, "sslmode=verify-full")
  }
  return connectionString
}

function getOrCreatePool(): Pool {
  const globalPool = globalThis as typeof globalThis & { _finperPool?: Pool }
  if (!globalPool._finperPool) {
    globalPool._finperPool = new Pool({
      connectionString: getConnectionString(),
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: true } : false,
      max: 10,
      idleTimeoutMillis: 30000,
    })
  }
  return globalPool._finperPool
}

export const pool = getOrCreatePool()
export const db = drizzle(pool, { schema: { transactions, stockPositions } })
