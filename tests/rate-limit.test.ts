import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { checkRateLimit, RATE_LIMIT_BACKEND } from "../lib/rate-limit"

test("enforces and expires in-memory rate-limit windows", { skip: RATE_LIMIT_BACKEND !== "memory" }, async () => {
  const key = `rate-limit-test:${randomUUID()}`

  assert.equal(await checkRateLimit(key, 2, 20), true)
  assert.equal(await checkRateLimit(key, 2, 20), true)
  assert.equal(await checkRateLimit(key, 2, 20), false)

  await new Promise((resolve) => setTimeout(resolve, 25))
  assert.equal(await checkRateLimit(key, 2, 20), true)
})

test("enforces the in-memory limit under concurrent requests", { skip: RATE_LIMIT_BACKEND !== "memory" }, async () => {
  const key = `rate-limit-concurrency-test:${randomUUID()}`
  const results = await Promise.all(
    Array.from({ length: 10 }, () => checkRateLimit(key, 3, 60_000))
  )

  assert.equal(results.filter(Boolean).length, 3)
})

test("rejects invalid rate-limit configuration", { skip: RATE_LIMIT_BACKEND !== "memory" }, async () => {
  await assert.rejects(checkRateLimit("", 1, 100), /key is required/)
  await assert.rejects(checkRateLimit("invalid-limit", 0, 100), /positive integer/)
  await assert.rejects(checkRateLimit("invalid-window", 1, 0), /window must be a positive integer/)
})
