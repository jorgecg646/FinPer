// ─────────────────────────────────────────────────────────────────────────────
// Shared local profile — stored in localStorage under STORAGE_KEY
// Consumed by: navigation.tsx, dashboard.tsx, profile.tsx
// ─────────────────────────────────────────────────────────────────────────────

export const PROFILE_STORAGE_KEY = "finflow-profile"

export type LocalProfile = { name: string; plan: string; avatar: string }

const DEFAULT_PROFILE: LocalProfile = { name: "Usuario", plan: "Plan Personal", avatar: "" }

export function loadLocalProfile(): LocalProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_PROFILE
  } catch {
    return DEFAULT_PROFILE
  }
}
