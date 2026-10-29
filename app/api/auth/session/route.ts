import { NextRequest, NextResponse } from "next/server"
import {
  createSessionToken,
  getSessionSecret,
  SESSION_COOKIE_NAME,
  USER_SESSION_MAX_AGE,
  verifySessionToken,
} from "@/lib/auth-session"
import { pool } from "@/lib/db"
import { migrateLegacyUserData } from "@/lib/user-data-migration"

const NETLIFY_IDENTITY_URL = "https://budgetnext.netlify.app/.netlify/identity"

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    if (!body || typeof body !== "object" || !("token" in body) || typeof body.token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    const identityRes = await fetch(`${NETLIFY_IDENTITY_URL}/user`, {
      headers: { Authorization: `Bearer ${body.token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!identityRes.ok) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const identityUser: unknown = await identityRes.json()
    if (
      !identityUser ||
      typeof identityUser !== "object" ||
      !("id" in identityUser) ||
      typeof identityUser.id !== "string" ||
      !identityUser.id.trim() ||
      !("email" in identityUser) ||
      typeof identityUser.email !== "string" ||
      !identityUser.email.trim()
    ) {
      return NextResponse.json({ error: "Invalid identity response" }, { status: 401 })
    }

    const sessionSecret = getSessionSecret()
    const stableUserId = `netlify:${identityUser.id}`
    const previousSession = verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value, sessionSecret)
    const legacyUserIds = [identityUser.email]
    if (previousSession?.kind === "guest") {
      legacyUserIds.push(`guest:${previousSession.subject}`)
    }

    const client = await pool.connect()
    let transactionStarted = false
    try {
      await client.query("BEGIN")
      transactionStarted = true
      await migrateLegacyUserData(client, stableUserId, legacyUserIds)
      await client.query("COMMIT")
      transactionStarted = false
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK")
        } catch (rollbackError) {
          console.error("[auth/session] rollback failed", rollbackError)
        }
      }
      throw error
    } finally {
      client.release()
    }

    const response = NextResponse.json({ ok: true, email: identityUser.email })
    response.cookies.set(
      SESSION_COOKIE_NAME,
      createSessionToken(identityUser.id, "user", sessionSecret),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: USER_SESSION_MAX_AGE,
      }
    )
    response.cookies.set("finflow_user_id", "", { path: "/", maxAge: 0 })
    return response
  } catch (error) {
    console.error("[auth/session]", error)
    return NextResponse.json({ error: "Unable to establish a secure session" }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  response.cookies.set("finflow_user_id", "", { path: "/", maxAge: 0 })
  return response
}
