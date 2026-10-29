import assert from "node:assert/strict"
import test from "node:test"
import { isGuestSessionId, isJwtExpired, verifyNetlifyIdentityToken } from "../lib/auth-session"

test("accepts only version-4 UUIDs as guest session identifiers", () => {
  assert.equal(isGuestSessionId("d9428888-122b-4b6e-8b2f-4e88a4e1f63c"), true)
  assert.equal(isGuestSessionId("not-a-session"), false)
  assert.equal(isGuestSessionId(undefined), false)
})

test("detects expired and valid JWT tokens", () => {
  const now = Math.floor(Date.now() / 1000)
  const validJwt = "header." + Buffer.from(JSON.stringify({ exp: now + 3600 })).toString("base64url") + ".sig"
  const expiredJwt = "header." + Buffer.from(JSON.stringify({ exp: now - 3600 })).toString("base64url") + ".sig"

  assert.equal(isJwtExpired(validJwt), false)
  assert.equal(isJwtExpired(expiredJwt), true)
  assert.equal(isJwtExpired(undefined), true)
  assert.equal(isJwtExpired(""), true)
  assert.equal(isJwtExpired("not-a-jwt"), false)
})

test("verifies user identity using the Netlify Identity token", async (t) => {
  const originalFetch = globalThis.fetch
  let authorization: string | null = null
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get("Authorization")
    return Response.json({ id: "netlify-id-123", email: "user@example.com" })
  }
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  assert.deepEqual(await verifyNetlifyIdentityToken("valid-token"), {
    id: "netlify-id-123",
    email: "user@example.com",
  })
  assert.equal(authorization, "Bearer valid-token")
})

test("rejects invalid Netlify Identity tokens", async (t) => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(null, { status: 401 })
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  await assert.rejects(verifyNetlifyIdentityToken("invalid-token"), /Invalid Netlify Identity token/)
})

test("immediately rejects expired JWT without making network requests", async (t) => {
  let fetchCalled = false
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    fetchCalled = true
    return new Response(null, { status: 200 })
  }
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  const now = Math.floor(Date.now() / 1000)
  const expiredJwt = "header." + Buffer.from(JSON.stringify({ exp: now - 120 })).toString("base64url") + ".sig"

  await assert.rejects(verifyNetlifyIdentityToken(expiredJwt), /token is expired/)
  assert.equal(fetchCalled, false)
})
