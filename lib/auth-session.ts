export const SESSION_COOKIE_NAME = "finflow_identity_token"
export const GUEST_SESSION_COOKIE_NAME = "finflow_guest_session"
export const GUEST_SESSION_MAX_AGE = 60 * 60 * 24 * 365
export const USER_SESSION_MAX_AGE = 60 * 60 * 24 * 30

const NETLIFY_IDENTITY_URL = "https://budgetnext.netlify.app/.netlify/identity"

export type NetlifyIdentityUser = {
  id: string
  email: string
}

export function isGuestSessionId(value: string | undefined): value is string {
  return value !== undefined &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function verifyNetlifyIdentityToken(accessToken: string): Promise<NetlifyIdentityUser> {
  const identityRes = await fetch(`${NETLIFY_IDENTITY_URL}/user`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(5000),
  })
  if (!identityRes.ok) throw new Error("Invalid Netlify Identity token")

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
    throw new Error("Invalid Netlify Identity response")
  }

  return { id: identityUser.id, email: identityUser.email }
}
