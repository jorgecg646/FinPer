import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import type { Tx } from "@/app/actions"
import { isInvestmentTx } from "@/lib/finance"
import { generateGeminiJson, type FinancialInsights } from "@/lib/gemini"
import { verifyTurnstileToken } from "@/lib/turnstile"

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    if (!checkRateLimit(`ai-insights:${ip}`, 10, 60_000)) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Espera un momento antes de volver a solicitar un análisis." },
        { status: 429 }
      )
    }

    const {
      transactions = [],
      currencySymbol = "€",
      turnstileToken,
    }: {
      transactions: Tx[]
      currencySymbol?: string
      turnstileToken?: string
    } = await req.json()

    // 🛡️ Cloudflare Turnstile bot verification
    const turnstileCheck = await verifyTurnstileToken(turnstileToken, ip)
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { error: turnstileCheck.error || "Verificación de seguridad fallida." },
        { status: 403 }
      )
    }

    const validTxs = transactions.filter((t) => !isInvestmentTx(t))

    if (validTxs.length < 3) {
      return NextResponse.json(
        { error: "Se necesitan al menos 3 transacciones para poder generar un análisis financiero con IA." },
        { status: 400 }
      )
    }

    // Group transactions by YYYY-MM
    const monthsMap = new Map<string, Tx[]>()
    for (const tx of validTxs) {
      const monthKey = tx.occurredAt.slice(0, 7) // YYYY-MM
      if (!monthsMap.has(monthKey)) monthsMap.set(monthKey, [])
      monthsMap.get(monthKey)!.push(tx)
    }

    const sortedMonths = Array.from(monthsMap.keys()).sort().reverse()
    const curMonthKey = sortedMonths[0]
    const prevMonthKey = sortedMonths[1] || null

    const curMonthTxs = monthsMap.get(curMonthKey) || []
    const prevMonthTxs = prevMonthKey ? monthsMap.get(prevMonthKey) || [] : []

    // Calculate totals
    const curIncome = curMonthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const curExpenses = curMonthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)

    const prevIncome = prevMonthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const prevExpenses = prevMonthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)

    // Category breakdown
    const curCatExpenses = new Map<string, number>()
    for (const t of curMonthTxs.filter((t) => t.type === "expense")) {
      curCatExpenses.set(t.category, (curCatExpenses.get(t.category) || 0) + t.amount)
    }

    const prevCatExpenses = new Map<string, number>()
    for (const t of prevMonthTxs.filter((t) => t.type === "expense")) {
      prevCatExpenses.set(t.category, (prevCatExpenses.get(t.category) || 0) + t.amount)
    }

    // Find highest increase category
    let maxDiffCategory = "General"
    let maxDiff = 0
    let maxPct = 0

    for (const [cat, curAmount] of curCatExpenses) {
      const prevAmount = prevCatExpenses.get(cat) || 0
      const diff = curAmount - prevAmount
      if (diff > maxDiff) {
        maxDiff = diff
        maxDiffCategory = cat
        maxPct = prevAmount > 0 ? (diff / prevAmount) * 100 : 100
      }
    }

    // Detect candidate subscriptions and potential duplicates/ghost expenses
    const expenseCounts = new Map<string, { count: number; amounts: number[]; dates: string[] }>()
    for (const t of validTxs.filter((t) => t.type === "expense")) {
      const norm = t.name.toLowerCase().trim()
      if (!expenseCounts.has(norm)) expenseCounts.set(norm, { count: 0, amounts: [], dates: [] })
      const item = expenseCounts.get(norm)!
      item.count++
      item.amounts.push(t.amount)
      item.dates.push(t.occurredAt.slice(0, 10))
    }

    const subscriptionKeywords = /netflix|spotify|amazon|prime|apple|google|gym|gimnasio|hbo|disney|youtube|dazn|suscripci|cuota|playstation|xbox|game pass/i
    const candidateAlerts: { name: string; amount: number; count: number; note: string }[] = []

    for (const [name, data] of expenseCounts) {
      // Check multiple charges in same month
      const curMonthCount = curMonthTxs.filter((t) => t.name.toLowerCase().trim() === name && t.type === "expense").length
      if (curMonthCount > 1 && data.amounts[0] > 5) {
        candidateAlerts.push({
          name,
          amount: data.amounts[0],
          count: curMonthCount,
          note: `Detectados ${curMonthCount} cobros del mismo concepto en este mes`,
        })
      } else if (subscriptionKeywords.test(name) || (data.count >= 2 && data.amounts[0] < 50)) {
        candidateAlerts.push({
          name,
          amount: data.amounts[0],
          count: data.count,
          note: `Gasto recurrente de periodicidad mensual (${data.count} ocurrencias registradas)`,
        })
      }
    }

    // Call Gemini AI
    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey && apiKey !== "TU_CLAVE_AQUI") {
      const prompt = `Actúa como asesor financiero personal senior y experto en finanzas personales para España.
Analiza con rigor los siguientes datos financieros reales del usuario y devuelve ÚNICAMENTE un objeto JSON válido.

Datos del usuario (${currencySymbol}):
- Mes actual (${curMonthKey}): Ingresos ${curIncome.toFixed(2)}${currencySymbol}, Gastos ${curExpenses.toFixed(2)}${currencySymbol}, Balance ${(curIncome - curExpenses).toFixed(2)}${currencySymbol}.
- Desglose gastos mes actual: ${Array.from(curCatExpenses.entries()).map(([k, v]) => `${k}: ${v.toFixed(2)}${currencySymbol}`).join(", ")}
${prevMonthKey ? `- Mes anterior (${prevMonthKey}): Ingresos ${prevIncome.toFixed(2)}${currencySymbol}, Gastos ${prevExpenses.toFixed(2)}${currencySymbol}` : "Mes anterior: sin datos previos suficientes"}
- Mayor incremento detectado: Categoría ${maxDiffCategory} (+${maxDiff.toFixed(2)}${currencySymbol}, +${maxPct.toFixed(0)}% vs mes anterior).
- Candidatos a suscripciones / gastos recurrentes o duplicados:
${candidateAlerts.slice(0, 6).map((c) => `- ${c.name}: ${c.amount}${currencySymbol} (${c.note})`).join("\n") || "No se detectaron servicios recurrentes obvios"}

Estructura JSON requerida (sin backticks ni markdown adicional):
{
  "executiveSummary": "Resumen conciso de 2-3 frases destacando el balance del mes y el estado general de su ahorro de forma cercana y motivadora.",
  "topIncrease": {
    "category": "${maxDiffCategory}",
    "difference": ${Number(maxDiff.toFixed(2))},
    "percentage": ${Number(maxPct.toFixed(0))},
    "explanation": "Explicación directa de por qué esta categoría ha tenido la mayor subida respecto al mes anterior y qué impacto tiene en su presupuesto."
  },
  "savingsTips": [
    {
      "title": "Título conciso y directo del consejo",
      "description": "Explicación aplicable de qué hacer exactamente según sus categorías de mayor gasto.",
      "estimatedMonthlySaving": 35,
      "category": "Restaurantes",
      "priority": "alta"
    }
  ],
  "subscriptionAndGhostAlerts": [
    {
      "title": "Nombre del servicio o gasto",
      "amount": 14.99,
      "type": "duplicado",
      "alert": "Motivo claro de por qué debería revisar este cobro (posible duplicidad o gasto innecesario)",
      "recommendation": "Acción recomendada concreta (ej: cancelar una de las cuentas o cambiar a plan anual)"
    }
  ],
  "ghostExpensesTotal": 39.98
}`

      try {
        const { data: parsed, modelUsed } = await generateGeminiJson<FinancialInsights>(
          prompt,
          { timeoutMs: 25000, tag: "ai-insights", temperature: 0.2 }
        )

        return NextResponse.json({
          ...parsed,
          generatedAt: new Date().toISOString(),
          modelUsed,
        })
      } catch (geminiErr: any) {
        console.warn("[ai-insights] Fallaron los modelos de Gemini, aplicando fallback determinista:", geminiErr?.message)
      }
    }

    // Deterministic Smart Fallback if Gemini is completely unavailable
    const fallbackResponse: FinancialInsights = {
      executiveSummary: `Durante el mes de ${curMonthKey}, registraste ${curIncome.toFixed(2)}${currencySymbol} de ingresos y ${curExpenses.toFixed(2)}${currencySymbol} de gastos, resultando en un balance neto de ${(curIncome - curExpenses).toFixed(2)}${currencySymbol}.`,
      topIncrease: {
        category: maxDiffCategory,
        difference: Number(maxDiff.toFixed(2)),
        percentage: Number(maxPct.toFixed(0)),
        explanation: maxDiff > 0
          ? `La categoría ${maxDiffCategory} aumentó en ${maxDiff.toFixed(2)}${currencySymbol} (+${maxPct.toFixed(0)}%) respecto al mes anterior.`
          : `Tus gastos se mantuvieron estables respecto al periodo anterior.`,
      },
      savingsTips: [
        {
          title: `Optimizar gastos en ${maxDiffCategory}`,
          description: `Al ser el área de mayor consumo este mes (${(curCatExpenses.get(maxDiffCategory) || 0).toFixed(2)}${currencySymbol}), limitar un 15% de estos consumos generará un alivio inmediato en tu ahorro.`,
          estimatedMonthlySaving: Number(((curCatExpenses.get(maxDiffCategory) || 0) * 0.15).toFixed(2)),
          category: maxDiffCategory,
          priority: "alta",
        },
        {
          title: "Revisión de microgastos hormiga",
          description: "Pequeños pagos menores a 15€ repetidos varias veces por semana pueden acumular más de 60€ al mes sin que lo notes.",
          estimatedMonthlySaving: 45,
          category: "General",
          priority: "media",
        },
      ],
      subscriptionAndGhostAlerts: candidateAlerts.slice(0, 3).map((a) => ({
        title: a.name.charAt(0).toUpperCase() + a.name.slice(1),
        amount: Number(a.amount.toFixed(2)),
        type: a.note.includes("mismo concepto") ? "duplicado" : "fantasma",
        alert: a.note,
        recommendation: "Comprueba si tienes dos suscripciones activas o si puedes dar de baja este cobro recurrente.",
      })),
      ghostExpensesTotal: candidateAlerts.reduce((acc, c) => acc + c.amount, 0),
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(fallbackResponse)
  } catch (err: any) {
    console.error("[ai-insights] Error:", err)
    return NextResponse.json(
      { error: "Error al procesar el análisis con IA. Inténtalo de nuevo." },
      { status: 500 }
    )
  }
}
