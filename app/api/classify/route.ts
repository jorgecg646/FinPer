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
  if (/alquiler|hipoteca|comunidad|ibi|seguro hogar|agua\b|luz\b|gas\b|electricidad|endesa|iberdrola|naturgy|internet|tel[eé]fono|vodafone|movistar|orange|yoigo|masmovil|fibra|jazztel|m[aá]smovil/.test(n)) return "Vivienda"

  // Bizum — siempre Ocio cuando no hay categoría más específica (antes del bloque income)
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

function fallbackName(raw: string): string {
  const low = raw.toLowerCase()

  if (/devoluci[oó]n|reembolso|refund/.test(low)) return "Devolución"
  if (/amazon/.test(low)) return "Amazon"
  if (/mercadona/.test(low)) return "Mercadona"
  if (/carrefour/.test(low)) return "Carrefour"
  if (/mcdonald|mc donald/.test(low)) return "McDonald's"
  if (/zara/.test(low)) return "Zara"
  if (/netflix/.test(low)) return "Netflix"
  if (/spotify/.test(low)) return "Spotify"
  if (/paypal/.test(low)) return "PayPal"
  if (/bizum/i.test(raw)) {
    // Try to extract "CONCEPTO" (colon optional: "CONCEPTO: X" or "CONCEPTO X")
    const conceptMatch = raw.match(/CONCEPTO\s*:?\s*(.+?)(?:\s{2,}|$)/i)
    if (conceptMatch?.[1]?.trim()) {
      const concept = conceptMatch[1].trim()
      return `Bizum ${concept.charAt(0).toUpperCase() + concept.slice(1).toLowerCase()}`
    }
    // Try to extract person name after "DE " or "A FAVOR DE "
    const personMatch = raw.match(/(?:A FAVOR DE|DE)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{1,30}?)(?:\s+CONCEPTO|\s{2,}|$)/i)
    if (personMatch?.[1]?.trim()) {
      const firstName = personMatch[1].trim().split(/\s+/)[0]
      return `Bizum ${firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()}`
    }
    return "Bizum Ocio"
  }
  if (/transferencia/.test(low)) return "Transferencia"
  if (/nomina|n[oó]mina|sueldo|salario/.test(low)) return "Nómina"

  // Extract meaningful words
  const cleaned = raw
    .replace(/[ï]/g, "'")
    .replace(/(?:TRANSACCION\s*CONTACTLESS|PAGO\s*MOVIL|COMPRA\s*INTERNET|COMPRA)\s*(?:EN)?/gi, " ")
    .replace(/TARJETA\s+\d+|TARJ\.\s*:\*\d+/gi, " ")
    .replace(/\b[A-Z0-9*]{8,}\b/g, " ")
    .replace(/[,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const words = cleaned.split(" ").filter((w) => w.length > 2 && !/^\d+$/.test(w))
  if (words.length > 0) {
    return words.slice(0, 3).join(" ")
  }

  return "Movimiento"
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini classifier — processes items in batches
// ─────────────────────────────────────────────────────────────────────────────

async function classifyWithGemini(
  items: ClassifyInput[],
  apiKey: string
): Promise<ClassifyResult[]> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

  const BATCH_SIZE = 50 // process up to 50 items per single API call
  const INTER_BATCH_DELAY_MS = 0 // no artificial delay
  const MAX_RETRIES = 1
  const results: ClassifyResult[] = []

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  function getRetryAfterMs(err: unknown): number {
    try {
      const msg = String((err as Error).message ?? "")
      const m = msg.match(/retryDelay[":\s]+"?(\d+)/)
      if (m) {
        const secs = parseInt(m[1], 10)
        // If quota retry is longer than 3 seconds, don't block the request for a minute!
        if (secs <= 3) return secs * 1000
      }
    } catch {}
    return 0 // fail fast if long wait required
  }

  // ── 1. Pre-classify and deduplicate items ─────────────────────────────────
  const AMBIGUOUS_CATEGORIES = new Set(["General", "Otros ingresos"])

  function needsAI(item: ClassifyInput): boolean {
    const cat = fallbackCategory(item.raw, item.type)
    if (/bizum/i.test(item.raw)) return true
    return AMBIGUOUS_CATEGORIES.has(cat)
  }

  // Result map by item ID
  const resultMap = new Map<string, ClassifyResult>()
  const itemsNeedingAI: ClassifyInput[] = []

  // Pre-classify non-ambiguous items with regex
  for (const item of items) {
    if (!needsAI(item)) {
      resultMap.set(item.id, {
        id: item.id,
        name: fallbackName(item.raw),
        category: fallbackCategory(item.raw, item.type),
        aiClassified: false,
      })
    } else {
      itemsNeedingAI.push(item)
    }
  }

  // Deduplicate items needing AI by normalized raw description
  const uniqueAiInputs: ClassifyInput[] = []
  const normRawToItemIds = new Map<string, string[]>()

  for (const item of itemsNeedingAI) {
    const norm = item.raw.trim().toLowerCase()
    if (!normRawToItemIds.has(norm)) {
      normRawToItemIds.set(norm, [])
      uniqueAiInputs.push(item)
    }
    normRawToItemIds.get(norm)!.push(item.id)
  }

  console.log(
    `[classify] Total: ${items.length} | Pre-classified by Regex: ${resultMap.size} | Sent to Gemini: ${uniqueAiInputs.length} (deduped from ${itemsNeedingAI.length})`
  )

  // If no items need AI, return immediately
  if (uniqueAiInputs.length > 0) {
    for (let i = 0; i < uniqueAiInputs.length; i += BATCH_SIZE) {
      const batch = uniqueAiInputs.slice(i, i + BATCH_SIZE)

      const incomeList = INCOME_CATEGORIES.join(", ")
      const expenseList = EXPENSE_CATEGORIES.join(", ")

      const prompt = `Eres un asistente financiero español experto en clasificar extractos bancarios.

Recibirás descripciones de movimientos bancarios en bruto (texto que aparece en los extractos del banco español).
Para cada transacción debes extraer:
- "name": nombre limpio, breve y reconocible del comercio o concepto (máx 35 caracteres, en español)
- "category": categoría correcta según el tipo (ingreso o gasto)

Categorías válidas para INGRESOS: ${incomeList}
Categorías válidas para GASTOS: ${expenseList}

Referencia rápida de comercios españoles y su categoría (muéstrate liberal con variantes del nombre):
Transporte: Cooltra, Acciona (moto/patinete), TIER, Muving, Lime, Bird, Voi, Dott, BiciMad, Bicing, Valenbisi, Free Now, Cabify, Uber, Bolt, Renfe, Cercanías, Metro, EMT, Flixbus, ALSA, Avanza, Busbud, Iryo, Ouigo, BlaBlaCar, Repsol, BP, Galp, Cepsa, peaje, Via T
Suscripciones: Netflix, Spotify, HBO Max, Disney+, Amazon Prime, Apple One, Twitch, Audible, DAZN, Paramount+, Filmin, Xbox Game Pass, PlayStation Plus
Supermercado: Mercadona, Carrefour, Lidl, Aldi, DIA, Eroski, Hipercor, Alcampo, Consum, Ahorramas, Spar, Froiz
Restaurantes: McDonald's, Burger King, KFC, Telepizza, Domino's, Just Eat, Glovo, Uber Eats, Starbucks, Five Guys, VIPS, Goiko, Foster's Hollywood
Salud: farmacia, Sanitas, Adeslas, Asisa, Mapfre Salud, Vithas, Quirón
Deporte: Decathlon, Basic-Fit, McFit, GO fit, Holmes Place, Metropolitan, padel, tenis, Sierra Nevada, Cetursa, Rentalmotion, Monachil, esquí, ski, forfait
Viajes: vueling, Ryanair, Iberia, easyJet, Wizz Air, Booking, Airbnb, Europcar, Hertz, Avis, Sixt
Ropa: Zara, H&M, Mango, Bershka, Pull&Bear, Stradivarius, Primark, Shein, Silbon, Álvaro Moreno, Massimo Dutti
Inversiones: Trading 212, Degiro, MyInvestor, Trade Republic, eToro, Indexa Capital, Finizens, Binance
Vivienda: Endesa, Iberdrola, Naturgy, Vodafone, Movistar, Orange, Yoigo, MasMovil, Jazztel
Tecnología: Amazon (hardware/software), Apple Store, Google Play, Microsoft, Steam, PlayStation Store

Ejemplo de extracción del nombre:
- Ignora códigos, números de tarjeta, fechas, localizaciones y texto genérico bancario (COMPRA EN, PAGO CONTACTLESS, TARJETA *XXXX, etc.)
- Extrae el nombre del comercio real: "COMPRA EN AMAZON MARKETPLACE" → "Amazon"
- Para Bizum: el name SIEMPRE debe ser "Bizum " + concepto extraído. El concepto aparece después de la palabra "CONCEPTO" (con o sin dos puntos). Ejemplos reales: "BIZUM A FAVOR DE JORGE SILLERO MANCHON CONCEPTO: bus" → "Bizum Bus", "BIZUM DE ANA BELEN GORDILLO NARANJO CONCEPTO Funda móvil" → "Bizum Funda móvil", "BIZUM DE JAVIER ALDANA HERNANDEZ CONCEPTO Nochvieja" → "Bizum Nochvieja", "BIZUM DE MARIA CONCEPTO: CENA" → "Bizum Cena", "BIZUM A JUAN" → "Bizum Juan", "BIZUM SIN CONCEPTO" → "Bizum Ocio"
- Para Bizum (categoría): analiza el concepto extraído para inferir la categoría correcta. NUNCA uses "Otros ingresos" para Bizum aunque sea ingreso — la categoría SIEMPRE debe basarse en el concepto. Para Bizum puedes usar cualquier categoría (Vivienda, Restaurantes, Transporte, Ocio, Salud, etc.) independientemente de si es ingreso o gasto. Ejemplos:
  · "comida", "cena", "almuerzo", "desayuno", "pizza", "tapas", "cerveza", "caña", "kebab", "sushi", "bar" → Restaurantes
  · "supermercado", "mercadona", "compra", "fruta", "verdura" → Supermercado
  · "bus", "metro", "taxi", "gasolina", "uber", "tren", "avión", "peaje", "busbud" → Transporte
  · "médico", "farmacia", "dentista", "pastillas" → Salud
  · "gym", "padel", "tenis", "deporte", "decathlon", "sierra nevada", "cetursa", "rentalmotion", "monachil", "esquí", "ski", "forfait" → Deporte
  · "reyes", "regalo" → Regalos
  · "libro", "curso", "academia" → Educación
  · "cubata", "copa", "discoteca", "nochevieja", "fiesta", "concierto", "cine", "teatro", "betis", "fútbol", "partido" → Ocio
  · "alquiler", "piso", "habitación", "cuarto", "casa", "local", "garaje", "renta", "luz", "agua", "internet" → Vivienda
  · Si el concepto es ambiguo, contiene mezcla de cosas, no lo puedes inferir, o el Bizum no tiene concepto claro → Ocio (NUNCA "Otros ingresos" para Bizum)
- Para nóminas/salarios: "Nómina" o "Nómina [empresa si aparece]"
- Para devoluciones/reembolsos: name="Devolución [comercio o concepto si aparece]" (ej: "DEVOLUCION AMAZON" → name="Devolución Amazon", "REEMBOLSO NETFLIX" → name="Devolución Netflix", "DEVOLUCION COMPRA" sin comercio → name="Devolución"), category="Reembolso"
- Para inversiones (Trading 212, Degiro, MyInvestor, Trade Republic, etc.): category="Inversiones"
- Para transferencias sin más info: "Transferencia"
- El nombre debe ser corto y reconocible (ej: "Mercadona", "Netflix", "Repsol", "Amazon", "Nómina")
- Si no puedes determinar la categoría exacta, usa "General" para gastos u "Otros ingresos" para ingresos

Devuelve ÚNICAMENTE un array JSON válido, sin markdown, sin texto adicional. Formato exacto:
[{"id":"1","name":"Mercadona","category":"Supermercado"},{"id":"2","name":"Nómina","category":"Salario"}]

Movimientos a clasificar (campo "descripcion" es el texto original del banco):
${batch.map((t) => `{"id":"${t.id}","descripcion":"${t.raw.replace(/"/g, "'").replace(/\n/g, " ").trim()}","tipo":"${t.type === "income" ? "ingreso" : "gasto"}"}`).join("\n")}
`

      if (i > 0) await sleep(INTER_BATCH_DELAY_MS)

      let lastErr: unknown = null
      let success = false

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const waitMs = getRetryAfterMs(lastErr)
            if (waitMs <= 0) {
              console.warn("[classify] Rate limit hit with long wait, failing fast to regex fallback")
              break
            }
            console.warn(`[classify] Rate limit hit, retrying in ${waitMs / 1000}s (attempt ${attempt}/${MAX_RETRIES})`)
            await sleep(waitMs)
          }

          const result = await model.generateContent(prompt)
          const text = result.response.text().trim()

          const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
          const parsed: { id: string; name: string; category: string }[] = JSON.parse(cleaned)

          for (const item of parsed) {
            const original = batch.find((b) => b.id === item.id)
            if (!original) continue

            const norm = original.raw.trim().toLowerCase()
            const targetIds = normRawToItemIds.get(norm) || [original.id]

            const validCats = original.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
            const category = validCats.includes(item.category)
              ? item.category
              : fallbackCategory(original.raw, original.type)

            const finalName = item.name?.trim() || fallbackName(original.raw)

            for (const targetId of targetIds) {
              resultMap.set(targetId, {
                id: targetId,
                name: finalName,
                category,
                aiClassified: true,
              })
            }
          }

          success = true
          break
        } catch (err) {
          lastErr = err
          const isRateLimit = String((err as Error).message ?? "").includes("429")
          if (!isRateLimit || attempt === MAX_RETRIES) break
        }
      }

      if (!success) {
        console.error("[classify] Gemini batch failed, using fallback for batch:", lastErr)
        for (const item of batch) {
          const norm = item.raw.trim().toLowerCase()
          const targetIds = normRawToItemIds.get(norm) || [item.id]
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
