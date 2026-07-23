import { NextRequest, NextResponse } from "next/server"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ParsedTransaction = {
  id: string
  date: string        // YYYY-MM-DD
  name: string
  amount: number
  type: "income" | "expense"
  category: string
  raw: string         // original line (for debugging)
  confidence: "high" | "medium" | "low"
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser — heuristics for Spanish / international bank statements
// ─────────────────────────────────────────────────────────────────────────────

/** Parse European amount string → number  e.g. "1.234,56" → 1234.56 */
function parseEuAmount(raw: string): number {
  // Remove currency symbols, spaces, then handle European vs US format
  const clean = raw.replace(/[€$£\s]/g, "").trim()
  if (/\d,\d{2}$/.test(clean)) {
    // European: 1.234,56 or 12,34
    return parseFloat(clean.replace(/\./g, "").replace(",", "."))
  }
  if (/\d\.\d{2}$/.test(clean)) {
    // US: 1,234.56 or 12.34
    return parseFloat(clean.replace(/,/g, ""))
  }
  return parseFloat(clean.replace(",", ".")) || 0
}

/** Normalize date to YYYY-MM-DD */
function parseDate(d: string, m: string, y: string): string {
  const day = d.padStart(2, "0")
  const month = m.padStart(2, "0")
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${month}-${day}`
}

/** Auto-assign category from description keywords */
function autoCategory(name: string, type: "income" | "expense"): string {
  const n = name.toLowerCase()
  if (type === "income") {
    if (/nomina|sueldo|salario|n[oó]mina/.test(n)) return "Salario"
    if (/freelance|honorarios|factura/.test(n)) return "Freelance"
    if (/dividendo|inversi[oó]n|fondo|bolsa/.test(n)) return "Inversiones"
    if (/alquiler cobrado|renta/.test(n)) return "Alquiler"
    if (/devoluci[oó]n|reembolso|refund/.test(n)) return "Reembolso"
    if (/bizum|transferencia recibida|ingreso/.test(n)) return "Otros ingresos"
    return "Otros ingresos"
  }
  if (/mercadona|carrefour|lidl|aldi|dia|eroski|hipercor|condis|alcampo|makro/.test(n)) return "Supermercado"
  if (/restaurante|bar\b|cafeter[ií]a|mcdonald|burger|pizza|telepizza|just eat|glovo|uber eat/.test(n)) return "Restaurantes"
  if (/taxi|uber|cabify|renfe|metro|bus\b|gasolinera|repsol|bp|galp|cepsa|autov[ií]a|peaje/.test(n)) return "Transporte"
  if (/netflix|spotify|hbo|disney|youtube premium|amazon prime|apple one|twitch|audible/.test(n)) return "Suscripciones"
  if (/farmacia|doctor|m[eé]dico|hospital|cl[ií]nica|seguro salud|mutua/.test(n)) return "Salud"
  if (/amazon|fnac|media markt|pccomponentes|ebay|aliexpress|apple store|google play/.test(n)) return "Tecnología"
  if (/gym|gimnasio|decathlon|fitness|nataci[oó]n|deporte|padel|tenis/.test(n)) return "Deporte"
  if (/alquiler|hipoteca|comunidad|ibi|seguro hogar|agua\b|luz\b|gas\b|electricidad|endesa|iberdrola|naturgy/.test(n)) return "Vivienda"
  if (/internet|tel[eé]fono|vodafone|movistar|orange|yoigo|masmovil|fibra/.test(n)) return "Vivienda"
  if (/zara|h&m|inditex|mango|pull and bear|stradivarius|bershka|primark|shein|asos/.test(n)) return "Ropa"
  if (/hotel|vueling|ryanair|iberia|booking|airbnb|viaje|resort/.test(n)) return "Viajes"
  if (/universidad|colegio|academia|libro|curso|udemy|coursera/.test(n)) return "Educación"
  if (/comisi[oó]n|mantenimiento|cuota|iva|seguro vida|seguro auto/.test(n)) return "General"
  return "General"
}

/** Determine type from line content */
function detectType(line: string, description: string, hasExplicitSign: boolean, sign: number): "income" | "expense" {
  if (hasExplicitSign) return sign >= 0 ? "income" : "expense"

  const l = (line + " " + description).toLowerCase()

  // Spanish bank keywords for income (abono/haber = credit)
  if (/\babono\b|\bhaber\b|transferencia\s+recibida|ingreso\s+n[oó]mina|n[oó]mina|devoluci[oó]n|reembolso|bizum\s+recibido|pago\s+recibido/.test(l)) return "income"

  // Spanish bank keywords for expense (cargo/debe = debit)
  if (/\bcargo\b|\bdebe\b|\bpago\b|\bcompra\b|\brecibo\b|comisi[oó]n|retirada|cajero|domiciliaci[oó]n|cuota/.test(l)) return "expense"

  // If amount appears in a "haber" column (right of center in some formats) treat as income
  // Fallback: unknown → expense (most transactions are expenses)
  return "expense"
}

/** Main parser: text → detected transactions */
function parseBankText(text: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = []
  const lines = text.split(/\r?\n/)
  const seen = new Set<string>()

  // Patterns
  const dateRe = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/
  const isoDateRe = /\b(\d{4})[\/\-](\d{2})[\/\-](\d{2})\b/
  // European amount: optional sign + optional thousands dots + comma decimal
  const euAmountRe = /([+\-]?\s*(?:\d{1,3}\.)*\d{1,3},\d{2})/g
  // US amount: optional sign + optional thousands commas + period decimal
  const usAmountRe = /([+\-]?\s*(?:\d{1,3},)*\d{1,3}\.\d{2})/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.length < 8) continue

    // Try to find a date
    let dateStr: string | null = null
    let dateIndex = -1

    const isoM = line.match(isoDateRe)
    if (isoM) {
      dateStr = `${isoM[1]}-${isoM[2]}-${isoM[3]}`
      dateIndex = line.indexOf(isoM[0])
    } else {
      const dm = line.match(dateRe)
      if (dm) {
        // Detect if it could be YYYY-MM-DD stored weirdly
        const p1 = parseInt(dm[1]), p3 = parseInt(dm[3])
        if (p1 > 31 || (p3 < 31 && dm[3].length === 4 && p1 <= 12)) {
          // probably YYYY-MM-DD in disguise
          dateStr = parseDate(dm[3], dm[2], dm[1])
        } else {
          dateStr = parseDate(dm[1], dm[2], dm[3])
        }
        dateIndex = line.indexOf(dm[0])
      }
    }

    if (!dateStr) continue

    // Validate date is reasonable (2000-2030)
    const year = parseInt(dateStr.slice(0, 4))
    if (year < 2000 || year > 2030) continue

    // Find amounts in the line
    const textAfterDate = line.slice(dateIndex)
    const euMatches = [...textAfterDate.matchAll(euAmountRe)]
    const usMatches = [...textAfterDate.matchAll(usAmountRe)]

    // Prefer European if more matches, else US
    const amountMatches = euMatches.length >= usMatches.length ? euMatches : usMatches
    const isEuropean = euMatches.length >= usMatches.length

    if (amountMatches.length === 0) {
      // Try the next line for an amount (some banks split date + description / amount)
      const nextLine = lines[i + 1]?.trim() || ""
      const nextEu = [...nextLine.matchAll(euAmountRe)]
      const nextUs = [...nextLine.matchAll(usAmountRe)]
      if (nextEu.length === 0 && nextUs.length === 0) continue
      amountMatches.push(...(nextEu.length ? nextEu : nextUs))
    }

    if (amountMatches.length === 0) continue

    // Choose the transaction amount:
    // If 2+ amounts, last is usually balance → take first or second-to-last
    // If 1 amount, that's the transaction
    let txAmountRaw = amountMatches[0][1]
    let hasExplicitSign = txAmountRaw.trim().startsWith("+") || txAmountRaw.trim().startsWith("-")
    
    // Some banks: AMOUNT | BALANCE → skip if all amounts are clearly balances (large numbers)
    // Heuristic: if last amount is much larger, it's balance
    if (amountMatches.length >= 2) {
      const amounts = amountMatches.map((m) => Math.abs(parseEuAmount(m[1])))
      const lastIsBalance = amounts[amounts.length - 1] > amounts[0] * 5
      // If no explicit sign on first, check if there's a signed one
      const signedIdx = amountMatches.findIndex((m) => m[1].trim().match(/^[+\-]/))
      if (signedIdx >= 0) {
        txAmountRaw = amountMatches[signedIdx][1]
        hasExplicitSign = true
      } else if (lastIsBalance) {
        txAmountRaw = amountMatches[0][1]
      }
    }

    const rawSign = txAmountRaw.trim().startsWith("-") ? -1 : 1
    const amount = parseEuAmount(txAmountRaw.replace(/[+\-\s]/g, match => (match.trim() === "" ? "" : match)))
    if (isNaN(amount) || amount <= 0) continue

    // Extract description: text between date and first amount
    const afterDate = line.slice(dateIndex + (isoM ? isoM[0].length : line.match(dateRe)![0].length))
    const firstAmtIdx = afterDate.search(/[\d].*[,.][\d]{2}/)
    let description = firstAmtIdx > 0
      ? afterDate.slice(0, firstAmtIdx).trim()
      : afterDate.replace(/[\d.,+\-€$£%]+/g, "").trim()

    // Clean up description
    description = description
      .replace(/\s{2,}/g, " ")
      .replace(/^[-–—|/\\*#\s]+|[-–—|/\\*#\s]+$/g, "")
      .trim()

    if (!description || description.length < 2) description = "Transacción bancaria"

    // Deduplicate (same date + same amount + same description)
    const key = `${dateStr}-${amount}-${description.slice(0, 20)}`
    if (seen.has(key)) continue
    seen.add(key)

    const type = detectType(line, description, hasExplicitSign, rawSign)
    const category = autoCategory(description, type)

    // Confidence: high if date + signed amount + description all clear
    const confidence: ParsedTransaction["confidence"] =
      description.length > 3 && hasExplicitSign ? "high"
      : description.length > 3 ? "medium"
      : "low"

    results.push({
      id: `pdf-${i}-${Math.random().toString(36).slice(2, 7)}`,
      date: dateStr,
      name: description,
      amount: Math.abs(amount),
      type,
      category,
      raw: line.slice(0, 120),
      confidence,
    })
  }

  // Sort by date descending
  return results.sort((a, b) => b.date.localeCompare(a.date))
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 })
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "El archivo debe ser un PDF" }, { status: 400 })
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "El PDF no puede superar 20 MB" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Use specific lib path to avoid pdf-parse test file issue in Next.js
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js")
    const data = await pdfParse(buffer, {
      // Don't render pages — we only need text
      max: 0,
    })

    if (!data.text || data.text.trim().length < 10) {
      return NextResponse.json({ error: "No se pudo extraer texto del PDF. El archivo podría estar escaneado como imagen." }, { status: 422 })
    }

    const transactions = parseBankText(data.text)

    return NextResponse.json({
      transactions,
      pages: data.numpages,
      textLength: data.text.length,
    })
  } catch (err) {
    console.error("[parse-pdf]", err)
    return NextResponse.json(
      { error: "Error al procesar el PDF. Asegúrate de que no está protegido con contraseña." },
      { status: 500 }
    )
  }
}
