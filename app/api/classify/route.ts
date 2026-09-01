import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ClassifyInput = {
  id: string
  raw: string
  type: "income" | "expense"
}

export type ClassifyResult = {
  id: string
  name: string
  category: string
  aiClassified: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Valid categories (must match the app's category lists)
// ─────────────────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = [
  "Salario",
  "Freelance",
  "Inversiones",
  "Alquiler",
  "Bonificación",
  "Regalo",
  "Reembolso",
  "Ocio",
  "Otros ingresos",
  // Bizum recibido puede pertenecer a cualquier categoría de gasto
  "Vivienda",
  "Restaurantes",
  "Transporte",
  "Supermercado",
  "Salud",
  "Educación",
  "Deporte",
  "Ropa",
  "Viajes",
  "Suscripciones",
  "Tecnología",
  "General",
]

const EXPENSE_CATEGORIES = [
  "Comida",
  "Supermercado",
  "Transporte",
  "Vivienda",
  "Ocio",
  "Salud",
  "Educación",
  "Suscripciones",
  "Ropa",
  "Viajes",
  "Restaurantes",
  "Tecnología",
  "Deporte",
  "Inversiones",
  "Reembolso",
  "General",
]

// ─────────────────────────────────────────────────────────────────────────────
// Fallback regex classifier (used when Gemini is unavailable)
// ─────────────────────────────────────────────────────────────────────────────

function fallbackCategory(raw: string, type: "income" | "expense"): string {
  const n = raw.toLowerCase()

  if (/devoluci[oó]n|reembolso|refund/.test(n)) return "Reembolso"

  // Tecnología
  if (/amazon|alipay|g2a|apple|google play|pccomponentes|media markt|fnac|ebay|aliexpress|apple store|app store|microsoft|steam|playstation|xbox|nintendo/.test(n)) return "Tecnología"

  // Supermercado
  if (/mercadona|carrefour|lidl|aldi|\bdia\b|supermercado|eroski|hipercor|condis|alcampo|makro|consum|ahorramas|spar|coviran|froiz|simply/.test(n)) return "Supermercado"

  // Restaurantes
  if (/restaurante|cafeter[ií]a|mcdonald|burger king|burger\s*king|pizza hut|telepizza|domino|dominos|just eat|glovo|uber eat|kfc|starbucks|five guys|vips|100 montaditos|100montaditos|taco bell|tacobell|foster|pans\b|dunkin|goiko/.test(n)) return "Restaurantes"

  // Transporte — movilidad urbana española + general
  if (/cooltra|acciona|tier\b|muving|lime\b|bird\b|\bvoi\b|dott\b|bicimad|bicing|valenbisi|seville cycling|nextbike|donkey republic/.test(n)) return "Transporte"
  if (/taxi|cabify|uber|bolt\b|free now|freenow|blablacar|flixbus|alsa\b|avanza\b|busbud/.test(n)) return "Transporte"
  if (/renfe|ave\b|iryo|ouigo|metro|cercan[ií]as|rodalies|\bfgc\b|\bemt\b|autob[uú]s|bus\b|tranv[ií]a|bizi\b/.test(n)) return "Transporte"
  if (/gasolinera|repsol|\bbp\b|galp|cepsa|shell|total\b|petrop[rr]ice|petroprix|carrefour energy/.test(n)) return "Transporte"
  if (/autov[ií]a|peaje|via t|viat\b|ap-[0-9]|applus/.test(n)) return "Transporte"

  // Suscripciones
  if (/netflix|spotify|hbo|disney|youtube premium|amazon prime|apple one|twitch|audible|dazn|paramount|filmin|crunchyroll|nba league|xbox game pass|playstation plus/.test(n)) return "Suscripciones"

  // Salud
  if (/farmacia|doctor|m[eé]dico|hospital|cl[ií]nica|seguro salud|mutua|sanitas|adeslas|asisa|mapfre salud|vithas|quiron|dent/.test(n)) return "Salud"

  // Deporte
  if (/gym|gimnasio|decathlon|fitness|nataci[oó]n|deporte|padel|tenis|planet fitness|basic-fit|basicfit|mcfit|anytime|holmes place|metropolitan|go fit|gofit|sierra\s*nevada|cetursa|rentalmotion|monachil|esqu[ií]|ski|forfait/.test(n)) return "Deporte"

  // Viajes
  if (/hotel|vueling|ryanair|iberia|easy jet|easyjet|wizz|wizzair|norwegian|level\b|booking|airbnb|viaje|resort|rentalcars|europcar|hertz|avis|sixt|record go|ok mobility/.test(n)) return "Viajes"

  // Educación
  if (/universidad|colegio|academia|\blibro|curso|udemy|coursera|domestika|linkedin learning|skillshare/.test(n)) return "Educación"

  // Ropa
  if (/zara|h&m|inditex|mango|pull and bear|pull&bear|stradivarius|bershka|primark|shein|asos|álvaro moreno|alvaro moreno|silbon|nike|adidas|puma|massimo dutti|cortefiel|springfield|lefties|calzedonia/.test(n)) return "Ropa"

  // Inversiones
  if (/trading\s*212|degiro|myinvestor|trade\s*republic|ibkr|interactive\s*brokers|inversi[oó]n|bolsa|cripto|binance|coinbase|etoro|finizens|indexa/.test(n)) return "Inversiones"

  // Vivienda
  if (/alquiler|hipoteca|comunidad|ibi|seguro hogar|seguro vivienda|agua\b|aguas|emasesa|aqualia|luz\b|gas\b|electricidad|endesa|iberdrola|naturgy|totalenergies|holaluz|curenergia|internet|tel[eé]fono|vodafone|movistar|orange|yoigo|masmovil|fibra|jazztel|m[aá]smovil|digi\b|pepephone|lowi|o2\b|simyo|piso\b|casa\b|facturas?\s*piso|gastos?\s*piso|facturas?|suministros|recibo\s*(?:luz|agua|gas|piso|comunidad)|butano|ikea|leroy\s*merlin|bricomart|obramat|bauhaus|conforama/.test(n)) return "Vivienda"

  // Bizum — si no encaja en ninguna categoría específica (Vivienda, Restaurantes, Supermercado, etc.)
  if (/bizum/i.test(n)) return "Ocio"

  if (type === "income") {
    if (/nomina|sueldo|salario|n[oó]mina/.test(n)) return "Salario"
    if (/freelance|honorarios|factura/.test(n)) return "Freelance"
    if (/alquiler cobrado|renta/.test(n)) return "Alquiler"
    return "Otros ingresos"
  }

  if (/comisi[oó]n|mantenimiento|cuota|iva|seguro/.test(n)) return "General"

  return "General"
}

function extractRefundMerchant(raw: string): string {
  const low = raw.toLowerCase()
  if (/amazon/.test(low)) return "Devolución Amazon"
  if (/zara/.test(low)) return "Devolución Zara"
  if (/zalando/.test(low)) return "Devolución Zalando"
  if (/shein/.test(low)) return "Devolución Shein"
  if (/aliexpress/.test(low)) return "Devolución AliExpress"
  if (/pccomponentes/.test(low)) return "Devolución PcComponentes"
  if (/el corte ingles|el corte ingl[eé]s/.test(low)) return "Devolución El Corte Inglés"
  if (/decathlon/.test(low)) return "Devolución Decathlon"
  if (/nike/.test(low)) return "Devolución Nike"
  if (/apple/.test(low)) return "Devolución Apple"
  if (/paypal/.test(low)) return "Devolución PayPal"
  if (/uber\s*eats/.test(low)) return "Devolución Uber Eats"
  if (/glovo/.test(low)) return "Devolución Glovo"
  if (/just\s*eat/.test(low)) return "Devolución Just Eat"
  if (/mercadona/.test(low)) return "Devolución Mercadona"
  if (/carrefour/.test(low)) return "Devolución Carrefour"

  const cleaned = raw
    .replace(/(?:devoluci[oó]n|reembolso|refund)\s*(?:compra\s*(?:en\s*)?)?/gi, " ")
    .replace(/(?:www\.)/gi, " ")
    .replace(/[,;*]/g, " ")
    .replace(/\.com|\.es|\.org/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

  const firstWord = cleaned.split(" ").filter((w) => w.length >= 2 && !/^\d+$/.test(w))[0]
  if (firstWord) {
    return `Devolución ${firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()}`
  }
  return "Devolución"
}

function fallbackName(raw: string): string {
  const low = raw.toLowerCase()

  if (/devoluci[oó]n|reembolso|refund/.test(low)) return extractRefundMerchant(raw)
  if (/trading\s*212/.test(low)) return "Trading 212"
  if (/trade\s*republic/.test(low)) return "Trade Republic"
  if (/myinvestor/.test(low)) return "MyInvestor"
  if (/degiro/.test(low)) return "Degiro"
  if (/amazon/.test(low)) return "Amazon"
  if (/zalando/.test(low)) return "Zalando"
  if (/hawkers/.test(low)) return "Hawkers"
  if (/hsn/.test(low)) return "HSN Store"
  if (/silbon/.test(low)) return "Silbon"
  if (/alvaro moreno|álvaro moreno/.test(low)) return "Álvaro Moreno"
  if (/mercadona/.test(low)) return "Mercadona"
  if (/carrefour/.test(low)) return "Carrefour"
  if (/\bdia\b/.test(low)) return "DIA"
  if (/lidl/.test(low)) return "Lidl"
  if (/aldi/.test(low)) return "Aldi"
  if (/decathlon/.test(low)) return "Decathlon"
  if (/mcdonald|mc donald/.test(low)) return "McDonald's"
  if (/burger king/.test(low)) return "Burger King"
  if (/uber\s*eats/.test(low)) return "Uber Eats"
  if (/just\s*eat/.test(low)) return "Just Eat"
  if (/glovo/.test(low)) return "Glovo"
  if (/100\s*montaditos/.test(low)) return "100 Montaditos"
  if (/zara/.test(low)) return "Zara"
  if (/netflix/.test(low)) return "Netflix"
  if (/spotify/.test(low)) return "Spotify"
  if (/paypal/.test(low)) return "PayPal"
  if (/casa del libro/.test(low)) return "Casa del Libro"
  if (/sierra\s*nevada/.test(low)) return "Sierra Nevada"
  if (/busbud/.test(low)) return "Busbud"
  if (/cooltra/.test(low)) return "Cooltra"
  if (/wallapop/.test(low)) return "Wallapop"

  if (/bizum/i.test(raw)) {
    // Try to extract "CONCEPTO" (colon optional: "CONCEPTO: X" or "CONCEPTO X")
    const conceptMatch = raw.match(/CONCEPTO\s*:?\s*(.+?)(?:\s{2,}|$)/i)
    if (conceptMatch?.[1]?.trim()) {
      const concept = conceptMatch[1].trim()
      return `Bizum ${concept.charAt(0).toUpperCase() + concept.slice(1)}`
    }
    // Try to extract person name after "DE " or "A FAVOR DE "
    const personMatch = raw.match(/(?:A FAVOR DE|DE)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{1,30}?)(?:\s+CONCEPTO|\s{2,}|$)/i)
    if (personMatch?.[1]?.trim()) {
      const firstName = personMatch[1].trim().split(/\s+/)[0]
      return `Bizum ${firstName.charAt(0).toUpperCase() + firstName.slice(1)}`
    }
    // If raw is already "Bizum <something>", preserve the actual text
    const directMatch = raw.match(/^bizum\s+(.+)$/i)
    if (directMatch?.[1]?.trim()) {
      const rest = directMatch[1].trim()
      return `Bizum ${rest.charAt(0).toUpperCase() + rest.slice(1)}`
    }
    return raw.trim() || "Bizum"
  }
  if (/transferencia/.test(low)) return "Transferencia"
  if (/nomina|n[oó]mina|sueldo|salario/.test(low)) return "Nómina"

  // Extract meaningful words without stripping short numbers like 212
  const cleaned = raw
    .replace(/[ï]/g, "'")
    .replace(/(?:TRANSACCION\s*CONTACTLESS|PAGO\s*MOVIL|COMPRA\s*INTERNET|COMPRA)\s*(?:EN)?/gi, " ")
    .replace(/TARJETA\s+\d+|TARJ\.\s*:\*\d+/gi, " ")
    .replace(/\b[A-Z0-9*]{8,}\b/g, " ")
    .replace(/[,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const words = cleaned.split(" ").filter((w) => w.length >= 2 && !/^\d{5,}$/.test(w))
  if (words.length > 0) {
    return words.slice(0, 3).join(" ")
  }

  return "Movimiento"
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini classifier — processes items in batches
// ─────────────────────────────────────────────────────────────────────────────

// In-memory runtime cache: key = "type:normalized_raw" -> { name, category }
const classificationCache = new Map<string, { name: string; category: string }>()

export async function classifyWithGemini(
  items: ClassifyInput[],
  apiKey: string
): Promise<ClassifyResult[]> {
  const BATCH_SIZE = 30
  const resultMap = new Map<string, ClassifyResult>()
  const itemsNeedingAI: ClassifyInput[] = []
  const normKeyToItemIds = new Map<string, string[]>()

  // ── 1. Check in-memory cache & Smart Pre-filter ─────────────────────────
  const AMBIGUOUS_CATEGORIES = new Set(["General", "Otros ingresos"])

  function isAmbiguous(item: ClassifyInput): boolean {
    if (/bizum/i.test(item.raw)) return true
    const fallbackCat = fallbackCategory(item.raw, item.type)
    return AMBIGUOUS_CATEGORIES.has(fallbackCat)
  }

  for (const item of items) {
    const norm = item.raw.trim().toLowerCase()
    const cacheKey = `${item.type}:${norm}`

    // Check memory cache
    if (classificationCache.has(cacheKey)) {
      const cached = classificationCache.get(cacheKey)!
      resultMap.set(item.id, {
        id: item.id,
        name: cached.name,
        category: cached.category,
        aiClassified: true,
      })
      continue
    }

    // If it's a clear, non-ambiguous merchant (e.g. Mercadona, Amazon, Zara, Trading 212),
    // resolve immediately to avoid wasting API quota and hitting rate limits
    if (!isAmbiguous(item)) {
      const name = fallbackName(item.raw)
      const category = fallbackCategory(item.raw, item.type)
      classificationCache.set(cacheKey, { name, category })
      resultMap.set(item.id, {
        id: item.id,
        name,
        category,
        aiClassified: true,
      })
      continue
    }

    // Group remaining genuinely ambiguous / Bizum items
    if (!normKeyToItemIds.has(cacheKey)) {
      normKeyToItemIds.set(cacheKey, [])
      itemsNeedingAI.push(item)
    }
    normKeyToItemIds.get(cacheKey)!.push(item.id)
  }

  console.log(
    `[classify] Total items: ${items.length} | Resolved instantly: ${resultMap.size} | Sent to Gemini AI: ${itemsNeedingAI.length}`
  )

  // ── 2. Call Gemini only for genuinely ambiguous items in parallel ────────
  if (itemsNeedingAI.length > 0) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 4096,
          // @ts-ignore - disables thinking delay
          thinkingConfig: { thinkingBudget: 0 },
        },
      })

      const batches: ClassifyInput[][] = []
      for (let i = 0; i < itemsNeedingAI.length; i += BATCH_SIZE) {
        batches.push(itemsNeedingAI.slice(i, i + BATCH_SIZE))
      }

      const incomeList = INCOME_CATEGORIES.join(", ")
      const expenseList = EXPENSE_CATEGORIES.join(", ")

      await Promise.all(
        batches.map(async (batch) => {
          const prompt = `Actúa como clasificador financiero bancario para España.
Categorías válidas GASTOS: ${expenseList}
Categorías válidas INGRESOS: ${incomeList}

Reglas:
- Para Bizum: name = "Bizum " + concepto. La categoría DEBE deducirse del concepto y contexto:
  * Facturas, piso, gastos piso, alquiler, luz, agua, gas, internet, wifi, comunidad, suministros, casa -> Vivienda (NUNCA Ocio).
  * Comida, cena, cerveza, tapas, kebab, burger, café, desayuno, restaurante, bar, vermut -> Restaurantes.
  * Supermercado, compra semanal, compra piso, mercadona -> Supermercado.
  * Bus, tren, metro, gasolina, viaje coche, peaje, blablacar -> Transporte.
  * Padel, gym, gimnasio, fútbol, esquí, forfait -> Deporte.
  * Regalo, reyes, cumple, boda -> Regalo.
  * Fiesta, discoteca, cine, concierto, festival, entradas, copas -> Ocio.
  * Si es solo el nombre de una persona sin concepto (ej: "Bizum Juan") -> Ocio.
- Para Devoluciones o Reembolsos: name = "Devolución " + comercio (ej: "Devolución Amazon", "Devolución Zara", "Devolución Shein"). Categoría = "Reembolso".
- Para comercios: Zalando/Hawkers/Silbon -> Ropa; HSN/Decathlon -> Deporte/Salud; Amazon -> Tecnología/Hogar; Cine -> Ocio; Wallapop -> Tecnología/General.
- Responde ÚNICAMENTE un array JSON: [{"id":"...","name":"...","category":"..."}]

Lista (id|tipo|descripcion):
${batch.map((t) => `${t.id}|${t.type === "income" ? "ingreso" : "gasto"}|${t.raw.replace(/[\r\n|]/g, " ").trim()}`).join("\n")}`

          try {
            const result = await model.generateContent(prompt)
            const text = result.response.text().trim()
            const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
            const parsed: { id: string; name: string; category: string }[] = JSON.parse(cleaned)

            for (const parsedItem of parsed) {
              const original = batch.find((b) => b.id === parsedItem.id)
              if (!original) continue

              const norm = original.raw.trim().toLowerCase()
              const cacheKey = `${original.type}:${norm}`
              const targetIds = normKeyToItemIds.get(cacheKey) || [original.id]

              const validCats = original.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
              const category = validCats.includes(parsedItem.category)
                ? parsedItem.category
                : fallbackCategory(original.raw, original.type)

              const finalName = parsedItem.name?.trim() || fallbackName(original.raw)

              // Save to memory cache for future requests
              classificationCache.set(cacheKey, { name: finalName, category })

              for (const targetId of targetIds) {
                resultMap.set(targetId, {
                  id: targetId,
                  name: finalName,
                  category,
                  aiClassified: true,
                })
              }
            }
          } catch (batchErr) {
            console.warn("[classify] Gemini batch error (falling back to regex):", batchErr)
            for (const item of batch) {
              const norm = item.raw.trim().toLowerCase()
              const cacheKey = `${item.type}:${norm}`
              const targetIds = normKeyToItemIds.get(cacheKey) || [item.id]
              for (const targetId of targetIds) {
                resultMap.set(targetId, {
                  id: targetId,
                  name: fallbackName(item.raw),
                  category: fallbackCategory(item.raw, item.type),
                  aiClassified: false,
                })
              }
            }
          }
        })
      )
    } catch (err) {
      console.error("[classify] Gemini init error:", err)
    }
  }

  // Build ordered result array guarantee no empty slots or missing IDs
  return items.map((item) => {
    const res = resultMap.get(item.id)
    if (res && res.name && res.category) return res

    return {
      id: item.id,
      name: fallbackName(item.raw) || "Movimiento",
      category: fallbackCategory(item.raw, item.type),
      aiClassified: false,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { items }: { items: ClassifyInput[] } = await req.json()

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Se requiere un array de items" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey || apiKey === "TU_CLAVE_AQUI") {
      // No API key: use fallback for all items
      const results: ClassifyResult[] = items.map((item) => ({
        id: item.id,
        name: fallbackName(item.raw),
        category: fallbackCategory(item.raw, item.type),
        aiClassified: false,
      }))
      return NextResponse.json({ results })
    }

    const results = await classifyWithGemini(items, apiKey)

    // Ensure all input items have a result (fill gaps with fallback)
    const resultIds = new Set(results.map((r) => r.id))
    for (const item of items) {
      if (!resultIds.has(item.id)) {
        results.push({
          id: item.id,
          name: fallbackName(item.raw),
          category: fallbackCategory(item.raw, item.type),
          aiClassified: false,
        })
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error("[classify] Error:", err)
    return NextResponse.json({ error: "Error al clasificar las transacciones" }, { status: 500 })
  }
}
