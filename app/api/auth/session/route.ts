import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  GUEST_SESSION_COOKIE_NAME,
  GUEST_SESSION_MAX_AGE,
  isGuestSessionId,
  SESSION_COOKIE_NAME,
  USER_SESSION_MAX_AGE,
  verifyNetlifyIdentityToken,
} from "@/lib/auth-session"
import { pool } from "@/lib/db"
import { migrateLegacyUserData } from "@/lib/user-data-migration"

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    if (
      !body ||
      typeof body !== "object" ||
      !("token" in body) ||
      typeof body.token !== "string" ||
      body.token.length > 16_384
    ) {
      return NextResponse.json({ error: "Missing or invalid token" }, { status: 400 })
    }

    const identityUser = await verifyNetlifyIdentityToken(body.token)
    const stableUserId = `netlify:${identityUser.id}`
    const legacyUserIds = [identityUser.email]
    const guestSessionId = req.cookies.get(GUEST_SESSION_COOKIE_NAME)?.value
    if (isGuestSessionId(guestSessionId)) {
      legacyUserIds.push(`guest:${guestSessionId}`)
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
    response.cookies.set(SESSION_COOKIE_NAME, body.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: USER_SESSION_MAX_AGE,
    })
    response.cookies.set("finflow_session", "", { path: "/", maxAge: 0 })
    response.cookies.set("finflow_user_id", "", { path: "/", maxAge: 0 })
    return response
  } catch (error) {
    console.error("[auth/session]", error)
    const status = error instanceof Error && error.message.startsWith("Invalid Netlify Identity") ? 401 : 500
    return NextResponse.json({ error: "Unable to establish a secure session" }, { status })
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
  response.cookies.set(GUEST_SESSION_COOKIE_NAME, randomUUID(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_SESSION_MAX_AGE,
  })
  response.cookies.set("finflow_session", "", { path: "/", maxAge: 0 })
  response.cookies.set("finflow_user_id", "", { path: "/", maxAge: 0 })
  return response
}
