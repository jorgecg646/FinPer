import { NextRequest, NextResponse } from "next/server"

const NETLIFY_IDENTITY_URL = "https://budgetnext.netlify.app/.netlify/identity"

/**
 * POST /api/auth/session
 * Called by the client after a successful Netlify Identity login.
 * Receives the JWT access token, verifies it with Netlify Identity, and
 * sets a secure HttpOnly cookie `finflow_session` containing the user's email.
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = (await req.json()) as { token?: string }

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    // Verify the JWT by calling Netlify Identity's /user endpoint
    const identityRes = await fetch(`${NETLIFY_IDENTITY_URL}/user`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })

    if (!identityRes.ok) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const identityUser = (await identityRes.json()) as { email?: string; id?: string }
    const email = identityUser.email

    if (!email) {
      return NextResponse.json({ error: "No email in token" }, { status: 401 })
    }

    const isHttps = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https"
    const useSecure = process.env.NODE_ENV === "production" && isHttps
    const cookieValue = encodeURIComponent(email)

    // Build response and set the HttpOnly cookie server-side
    const response = NextResponse.json({ ok: true, email })
    response.cookies.set("finflow_session", cookieValue, {
      httpOnly: true,
      secure: useSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })

    return response
  } catch (err) {
    console.error("[auth/session]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/**
 * DELETE /api/auth/session
 * Clears the HttpOnly session cookie (logout).
 */
export async function DELETE(req: NextRequest) {
  const isHttps = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https"
  const response = NextResponse.json({ ok: true })
  response.cookies.set("finflow_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return response
}
