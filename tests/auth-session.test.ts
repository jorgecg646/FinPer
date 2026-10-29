import assert from "node:assert/strict"
import test from "node:test"
import { isGuestSessionId, verifyNetlifyIdentityToken } from "../lib/auth-session"

test("accepts only version-4 UUIDs as guest session identifiers", () => {
  assert.equal(isGuestSessionId("d9428888-122b-4b6e-8b2f-4e88a4e1f63c"), true)
  assert.equal(isGuestSessionId("not-a-session"), false)
  assert.equal(isGuestSessionId(undefined), false)
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
