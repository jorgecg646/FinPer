import { createHmac, timingSafeEqual } from "node:crypto"

export const SESSION_COOKIE_NAME = "finflow_session"
export const GUEST_SESSION_MAX_AGE = 60 * 60 * 24 * 365
export const USER_SESSION_MAX_AGE = 60 * 60 * 24 * 30

export type SessionKind = "guest" | "user"

export type VerifiedSession = {
  subject: string
  kind: SessionKind
}

type SessionPayload = VerifiedSession & {
  expiresAt: number
}

const DEVELOPMENT_SECRET = "finper-development-only-secret-do-not-use-in-production"

export function getSessionSecret(): string {
  const secret = process.env.FINPER_SESSION_SECRET
  if (!secret && process.env.NODE_ENV !== "production") return DEVELOPMENT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("FINPER_SESSION_SECRET must be configured with at least 32 characters")
  }
  return secret
}

export function createSessionToken(
  subject: string,
  kind: SessionKind,
  secret: string,
  now = Date.now(),
  maxAgeSeconds = kind === "guest" ? GUEST_SESSION_MAX_AGE : USER_SESSION_MAX_AGE
): string {
  if (!subject.trim()) throw new Error("Session subject is required")
  if (secret.length < 32) throw new Error("Session secret must contain at least 32 characters")

  const payload: SessionPayload = {
    subject,
    kind,
    expiresAt: Math.floor(now / 1000) + maxAgeSeconds,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url")
  return `${encodedPayload}.${signature}`
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now()
): VerifiedSession | null {
  if (!token || secret.length < 32) return null

  const [encodedPayload, signature, extra] = token.split(".")
  if (!encodedPayload || !signature || extra !== undefined) return null

  const expectedSignature = createHmac("sha256", secret).update(encodedPayload).digest()
  let receivedSignature: Buffer
  try {
    receivedSignature = Buffer.from(signature, "base64url")
  } catch {
    return null
  }
  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<SessionPayload>
    if (
      typeof payload.subject !== "string" ||
      !payload.subject.trim() ||
      (payload.kind !== "guest" && payload.kind !== "user") ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(now / 1000)
    ) {
      return null
    }

    return { subject: payload.subject, kind: payload.kind }
  } catch {
    return null
  }
}
