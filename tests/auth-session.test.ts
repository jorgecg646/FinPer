import assert from "node:assert/strict"
import test from "node:test"
import { createSessionToken, verifySessionToken } from "../lib/auth-session"

const secret = "test-session-secret-with-more-than-32-characters"

test("verifies signed user and guest sessions", () => {
  const userToken = createSessionToken("netlify-id-123", "user", secret, 1_000_000)
  const guestToken = createSessionToken("browser-id-456", "guest", secret, 1_000_000)

  assert.deepEqual(verifySessionToken(userToken, secret, 1_001_000), {
    subject: "netlify-id-123",
    kind: "user",
  })
  assert.deepEqual(verifySessionToken(guestToken, secret, 1_001_000), {
    subject: "browser-id-456",
    kind: "guest",
  })
})

test("rejects tampered, expired, malformed, and missing session tokens", () => {
  const token = createSessionToken("netlify-id-123", "user", secret, 1_000_000, 60)
  const [payload, signature] = token.split(".")
  const tampered = `${payload}.${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`

  assert.equal(verifySessionToken(tampered, secret, 1_001_000), null)
  assert.equal(verifySessionToken(token, secret, 1_062_000), null)
  assert.equal(verifySessionToken("not-a-session", secret), null)
  assert.equal(verifySessionToken(undefined, secret), null)
})
