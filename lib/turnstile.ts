/**
 * Cloudflare Turnstile Server Verification Helper
 */

export type TurnstileVerifyResult = {
  success: boolean
  error?: string
  hostname?: string
}

export async function verifyTurnstileToken(
  token: string | undefined | null,
  clientIp?: string
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY

  // If secret key is not configured, skip verification (fail-open in local development without keys)
  if (!secret || secret === "TU_SECRET_KEY_AQUI") {
    return { success: true }
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    console.warn("[turnstile] ⚠️ Petición bloqueada: No se proporcionó token de Turnstile")
    return {
      success: false,
      error: "Verificación de seguridad requerida. Por favor, completa el captcha de Cloudflare.",
    }
  }

  try {
    const formData = new URLSearchParams()
    formData.append("secret", secret)
    formData.append("response", token)
    if (clientIp && clientIp !== "unknown") {
      formData.append("remoteip", clientIp)
    }

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    })

    const data = await res.json()

    if (data.success) {
      console.log(`[turnstile] ✅ Verificación Cloudflare exitosa (host: ${data.hostname || "local"})`)
      return { success: true, hostname: data.hostname }
    }

    console.warn("[turnstile] ❌ Cloudflare rechazó el token:", data["error-codes"] || data)
    return {
      success: false,
      error: "La verificación de seguridad de Cloudflare ha caducado o no es válida. Inténtalo de nuevo.",
    }
  } catch (err: any) {
    console.error("[turnstile] Error al contactar con Cloudflare:", err?.message || err)
    return {
      success: false,
      error: "No se pudo validar la verificación con Cloudflare.",
    }
  }
}
