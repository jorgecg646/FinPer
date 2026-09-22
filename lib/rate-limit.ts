/**
 * Simple in-memory IP-based rate limiter.
 * Works per-serverless-instance (good enough for Netlify/Vercel edge functions).
 * For distributed rate limiting across instances, swap this with Upstash Ratelimit.
 */

type RateLimitEntry = { count: number; resetAt: number }

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * Returns `true` if the request is allowed, `false` if rate-limited.
 * @param key      Identifier (e.g. IP address or user email)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

/** Extract a best-effort client IP from a Next.js request. */
export function getClientIp(req: Request): string {
  const headers = req instanceof Request ? req.headers : (req as { headers: Headers }).headers
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  )
}
