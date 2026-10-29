import { pool } from "./db"

type RateLimitEntry = { count: number; resetAt: number }
type RateLimitBackend = "memory" | "postgres"

export class RateLimitStoreError extends Error {
  constructor() {
    super("El servicio de límite de solicitudes no está disponible.")
    this.name = "RateLimitStoreError"
  }
}

declare global {
  var __finperRateLimitStore: Map<string, RateLimitEntry> | undefined
  var __finperRateLimitNextCleanup: number | undefined
}

const configuredBackend = process.env.FINPER_RATE_LIMIT_BACKEND?.trim().toLowerCase() || undefined
const backend = configuredBackend ?? (process.env.NODE_ENV === "production" ? "postgres" : "memory")

if (backend !== "memory" && backend !== "postgres") {
  throw new Error("FINPER_RATE_LIMIT_BACKEND debe ser 'memory' o 'postgres'")
}

export const RATE_LIMIT_BACKEND: RateLimitBackend = backend

function getRateLimitStore(): Map<string, RateLimitEntry> {
  if (!globalThis.__finperRateLimitStore) {
    globalThis.__finperRateLimitStore = new Map<string, RateLimitEntry>()
  }
  return globalThis.__finperRateLimitStore
}

const store = getRateLimitStore()

const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key)
  }
}, 5 * 60 * 1000)
cleanupTimer.unref()

function checkMemoryRateLimit(key: string, limit: number, windowMs: number, now: number): boolean {
  const entry = store.get(key)
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

function cleanExpiredBuckets(now: number): void {
  if (now < (globalThis.__finperRateLimitNextCleanup ?? 0)) return

  globalThis.__finperRateLimitNextCleanup = now + 5 * 60 * 1000
  void pool
    .query('DELETE FROM rate_limit_buckets WHERE "expiresAt" < $1', [now])
    .catch((error: unknown) => {
      console.error("[rate-limit] No se pudieron limpiar los límites expirados:", error)
    })
}

/**
 * Returns true when the request is allowed. PostgreSQL uses an atomic upsert,
 * so concurrent app instances share the same fixed-window counter.
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!key.trim()) throw new Error("Rate limit key is required")
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Rate limit must be a positive integer")
  if (!Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new Error("Rate limit window must be a positive integer")
  }

  const now = Date.now()
  if (RATE_LIMIT_BACKEND === "memory") {
    return checkMemoryRateLimit(key, limit, windowMs, now)
  }

  const windowStart = Math.floor(now / windowMs) * windowMs
  const expiresAt = windowStart + windowMs * 2
  let requestCount: number | undefined
  try {
    const result = await pool.query<{ requestCount: number }>(
      `INSERT INTO rate_limit_buckets ("key", "windowStart", "requestCount", "expiresAt")
       VALUES ($1, $2, 1, $3)
       ON CONFLICT ("key", "windowStart") DO UPDATE
       SET "requestCount" = LEAST(rate_limit_buckets."requestCount" + 1, $4)
       RETURNING "requestCount"`,
      [key, windowStart, expiresAt, limit + 1]
    )
    requestCount = result.rows[0]?.requestCount
  } catch (error) {
    console.error("[rate-limit] No se pudo consultar el almacenamiento PostgreSQL:", error)
    throw new RateLimitStoreError()
  }

  if (typeof requestCount !== "number") {
    throw new RateLimitStoreError()
  }

  cleanExpiredBuckets(now)
  return requestCount <= limit
}

/** Extract a best-effort client IP from a Next.js request. */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  )
}
