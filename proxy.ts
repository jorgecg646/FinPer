import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  GUEST_SESSION_COOKIE_NAME,
  GUEST_SESSION_MAX_AGE,
  SESSION_COOKIE_NAME,
  isGuestSessionId,
  isJwtExpired,
} from "@/lib/auth-session"

export function proxy(request: NextRequest) {
  const guestSessionId = request.cookies.get(GUEST_SESSION_COOKIE_NAME)?.value
  const newGuestSessionId = isGuestSessionId(guestSessionId) ? undefined : randomUUID()

  if (newGuestSessionId) {
    request.cookies.set(GUEST_SESSION_COOKIE_NAME, newGuestSessionId)
  }

  // If the Netlify Identity token cookie is present but expired or malformed,
  // remove it from request and clear it on response so downstream RSC rendering does not fail.
  const identityToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const shouldClearIdentityToken = identityToken !== undefined && isJwtExpired(identityToken)
  if (shouldClearIdentityToken) {
    request.cookies.delete(SESSION_COOKIE_NAME)
  }

  const response = NextResponse.next({ request: { headers: request.headers } })
  if (newGuestSessionId) {
    response.cookies.set(GUEST_SESSION_COOKIE_NAME, newGuestSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_SESSION_MAX_AGE,
    })
  }

  if (shouldClearIdentityToken) {
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  }

  if (request.cookies.has("finflow_session")) {
    response.cookies.set("finflow_session", "", { path: "/", maxAge: 0 })
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|manifest.json|sw.js).*)"],
}
