import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  createSessionToken,
  GUEST_SESSION_MAX_AGE,
  getSessionSecret,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth-session"

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/auth/session") {
    return NextResponse.next()
  }

  const secret = getSessionSecret()
  const currentToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const currentSession = verifySessionToken(currentToken, secret)
  if (currentSession) return NextResponse.next()

  const guestToken = createSessionToken(randomUUID(), "guest", secret)
  request.cookies.set(SESSION_COOKIE_NAME, guestToken)
  const response = NextResponse.next({ request: { headers: request.headers } })
  response.cookies.set(SESSION_COOKIE_NAME, guestToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_SESSION_MAX_AGE,
  })
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|manifest.json|sw.js).*)"],
}
