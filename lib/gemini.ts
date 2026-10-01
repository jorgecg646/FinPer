import { GoogleGenerativeAI } from "@google/generative-ai"

export const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview",
  "gemini-2.5-flash",
] as const

export type GeminiModel = (typeof CANDIDATE_MODELS)[number]

export type FinancialInsights = {
  executiveSummary: string
  topIncrease: {
    category: string
    difference: number
    percentage: number
    explanation: string
  }
  savingsTips: {
    title: string
    description: string
    estimatedMonthlySaving: number
    category: string
    priority: "alta" | "media"
  }[]
  subscriptionAndGhostAlerts: {
    title: string
    amount: number
    type: "duplicado" | "fantasma" | "recurrente_prescindible"
    alert: string
    recommendation: string
  }[]
  ghostExpensesTotal: number
  generatedAt: string
  modelUsed?: string
}

export function cleanJsonText(raw: string): string {
  return raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```$/i, "").trim()
}

/**
 * Reusable helper to generate structured JSON using Google Gemini with automatic model fallback
 */
export async function generateGeminiJson<T>(
  prompt: string,
  options?: {
    timeoutMs?: number
    tag?: string
    temperature?: number
    models?: readonly string[]
  }
): Promise<{ data: T; modelUsed: string }> {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    throw new Error("No hay GEMINI_API_KEY configurada en las variables de entorno del servidor")
  }

  const genAI = new GoogleGenerativeAI(key)
  const models = options?.models || CANDIDATE_MODELS
  const timeoutMs = options?.timeoutMs ?? 20000
  const tag = options?.tag || "gemini"
  const temperature = options?.temperature ?? 0.1

  let lastErr: unknown = null

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature,
          maxOutputTokens: 4096,
          // @ts-ignore - eliminates thinking latency
          thinkingConfig: { thinkingBudget: 0 },
        },
      })

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout (${timeoutMs}ms) en ${modelName}`)), timeoutMs)
      )

      const result = await Promise.race([model.generateContent(prompt), timeoutPromise])
      const text = result.response.text().trim()
      if (!text) continue

      const cleaned = cleanJsonText(text)
      const data = JSON.parse(cleaned) as T

      console.log(`[${tag}] ✅ Éxito con modelo: ${modelName}`)
      return { data, modelUsed: modelName }
    } catch (err: any) {
      lastErr = err
      console.warn(`[${tag}] Modelo ${modelName} no disponible (${err?.status || err?.message}), probando alternativo...`)
    }
  }

  throw lastErr || new Error("No se pudo obtener respuesta de ningún modelo de Gemini")
}
