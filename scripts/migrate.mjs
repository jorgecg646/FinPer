/**
 * Script para crear la tabla `transactions` en Neon.
 * Ejecutar UNA sola vez: node scripts/migrate.mjs
 *
 * Requiere que DATABASE_URL esté en .env.local
 */

import { createRequire } from "module"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local manually (no dotenv dependency needed)
try {
  const envPath = resolve(__dirname, "../.env.local")
  const lines = readFileSync(envPath, "utf8").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const [key, ...rest] = trimmed.split("=")
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim()
  }
} catch {
  // .env.local might not exist
}

const require = createRequire(import.meta.url)
const { Pool } = require("pg")

const url = process.env.DATABASE_URL
if (!url || url.includes("REEMPLAZA")) {
  console.error("❌  DATABASE_URL no está configurada en .env.local")
  process.exit(1)
}

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

const SQL = `
CREATE TABLE IF NOT EXISTS transactions (
  "id"          SERIAL PRIMARY KEY,
  "userId"      TEXT NOT NULL DEFAULT 'local-user',
  "name"        TEXT NOT NULL,
  "category"    TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "amount"      NUMERIC(12, 2) NOT NULL,
  "occurredAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_positions (
  "id"        SERIAL PRIMARY KEY,
  "userId"    TEXT NOT NULL DEFAULT 'local-user',
  "symbol"    TEXT NOT NULL,
  "label"     TEXT NOT NULL,
  "shares"    NUMERIC(18, 6),
  "avgPrice"  NUMERIC(18, 6),
  "avgFxRate" NUMERIC(18, 6),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "symbol")
);

ALTER TABLE stock_positions ADD COLUMN IF NOT EXISTS "avgFxRate" NUMERIC(18, 6);
`

;(async () => {
  console.log("🔌  Conectando a Neon…")
  const client = await pool.connect()
  try {
    console.log("🗃️   Creando tabla transactions (si no existe)…")
    await client.query(SQL)
    console.log("✅  Tabla creada / ya existía. ¡Listo!")
  } finally {
    client.release()
    await pool.end()
  }
})().catch((e) => {
  console.error("❌  Error:", e.message)
  process.exit(1)
})
