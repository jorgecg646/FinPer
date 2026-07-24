import { NextRequest, NextResponse } from "next/server"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ParsedTransaction = {
  id: string
  date: string
  name: string
  amount: number
  type: "income" | "expense"
  category: string
  raw: string
  confidence: "high" | "medium" | "low"
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseEuAmount(raw: string): number {
  const clean = String(raw ?? "")
    .replace(/[€$£\s]/g, "")
    .trim()

  if (/\d,\d{2}$/.test(clean)) {
    return parseFloat(clean.replace(/\./g, "").replace(",", "."))
  }

  if (/\d\.\d{2}$/.test(clean)) {
    return parseFloat(clean.replace(/,/g, ""))
  }

  return parseFloat(clean.replace(",", ".")) || 0
}

function parseDate(d: string, m: string, y: string): string {
  const day = d.padStart(2, "0")
  const month = m.padStart(2, "0")
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${month}-${day}`
}

function parseSpanishDate(value: unknown): string | null {
  const s = String(value ?? "").trim()
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (!m) return null
  return parseDate(m[1], m[2], m[3])
}

function autoCategory(name: string, type: "income" | "expense"): string {
  const n = name.toLowerCase()

  if (/devoluci[oó]n|reembolso|refund/.test(n)) return "Reembolso"

  if (/amazon|alipay|g2a|apple|google play|pccomponentes|media markt|fnac|ebay|aliexpress/.test(n)) return "Tecnología"
  if (/mercadona|carrefour|lidl|aldi|\bdia\b|supermercado|eroski|hipercor|condis|alcampo|makro|consum/.test(n)) return "Supermercado"
  if (/restaurante|bar\b|cafeter[ií]a|mcdonald|burger|pizza|telepizza|just eat|glovo|uber eat|kfc|dominos|starbucks/.test(n)) return "Restaurantes"
  if (/taxi|uber|cabify|renfe|metro|bus\b|gasolinera|repsol|bp|galp|cepsa|autov[ií]a|peaje/.test(n)) return "Transporte"
  if (/netflix|spotify|hbo|disney|youtube premium|amazon prime|apple one|twitch|audible/.test(n)) return "Suscripciones"
  if (/farmacia|doctor|m[eé]dico|hospital|cl[ií]nica|seguro salud|mutua/.test(n)) return "Salud"
  if (/gym|gimnasio|decathlon|fitness|nataci[oó]n|deporte|padel|tenis/.test(n)) return "Deporte"
  if (/hotel|vueling|ryanair|iberia|booking|airbnb|viaje|resort/.test(n)) return "Viajes"
  if (/universidad|colegio|academia|libro|curso|udemy|coursera/.test(n)) return "Educación"
  if (/zara|h&m|inditex|mango|pull and bear|stradivarius|bershka|primark|shein|asos|álvaro moreno|alvaro moreno|silbon|nike|adidas|puma/.test(n)) return "Ropa"
  if (/trading\s*212|degiro|myinvestor|trade\s*republic|ibkr|interactive\s*brokers|inversi[oó]n|bolsa|cripto|binance|coinbase/.test(n)) return "Inversiones"
  if (/alquiler|hipoteca|comunidad|ibi|seguro hogar|agua\b|luz\b|gas\b|electricidad|endesa|iberdrola|naturgy|internet|tel[eé]fono|vodafone|movistar|orange|yoigo|masmovil|fibra/.test(n)) return "Vivienda"

  if (type === "income") {
    if (/nomina|sueldo|salario|n[oó]mina/.test(n)) return "Salario"
    if (/freelance|honorarios|factura/.test(n)) return "Freelance"
    if (/alquiler cobrado|renta/.test(n)) return "Alquiler"
    if (/bizum|transferencia recibida|ingreso/.test(n)) return "Ocio"
    return "Otros ingresos"
  }

  if (/bizum/.test(n)) return "Ocio"
  if (/comisi[oó]n|mantenimiento|cuota|iva|seguro vida|seguro auto/.test(n)) return "General"

  return "General"
}

function detectType(line: string, description: string, hasExplicitSign: boolean, sign: number): "income" | "expense" {
  if (hasExplicitSign) {
    return sign < 0 ? "expense" : "income"
  }

  const l = (line + " " + description).toLowerCase()

  if (/\bdevoluci[oó]n\b|\breembolso\b|bizum\s+de\b|\babono\b|\bhaber\b|n[oó]mina|sueldo|salario|transferencia\s+recibida/.test(l)) {
    return "income"
  }

  if (/\bcompra\b|\bpago\b|\btransaccion\b|\btransferencia\s+a\b|bizum\s+a\b|\bcargo\b|\bdebe\b|comisi[oó]n/.test(l)) {
    return "expense"
  }

  return "expense"
}

function cleanDescription(raw: string): string {
  let s = String(raw ?? "")
    .replace(/[ï]/g, "'")
    .replace(/\s+/g, " ")
    .trim()

  const low = s.toLowerCase()

  if (/devoluci[oó]n|reembolso|refund/.test(low)) return "Devolución"
  if (/amazon/.test(low)) return "Amazon"
  if (/alipay/.test(low)) return "Alipay"
  if (/g2a/.test(low)) return "G2A"
  if (/decathlon/.test(low)) return "Decathlon"
  if (/mercadona/.test(low)) return "Mercadona"
  if (/carrefour/.test(low)) return "Carrefour"
  if (/\bdia\b|\ben dia\b/.test(low)) return "DIA"
  if (/mcdonald|mc donald/.test(low)) return "McDonald's"
  if (/zara/.test(low)) return "Zara"
  if (/zalando/.test(low)) return "Zalando"
  if (/nike/.test(low)) return "Nike"
  if (/alvaro moreno|álvaro moreno/.test(low)) return "Álvaro Moreno"
  if (/silbon/.test(low)) return "Silbon"
  if (/trading 212/.test(low)) return "Trading 212"
  if (/junta andalucia|junta de andalucia/.test(low)) return "Junta Andalucía"
  if (/paypal/.test(low)) return "PayPal"

  if (/bizum/.test(low)) {
    if (/sin concepto/i.test(s)) return "Bizum Ocio"

    const bizumConcept = s.match(/CONCEPTO\s*:?\s*(.+)$/i)?.[1]?.trim()
    if (bizumConcept) {
      const clean = bizumConcept
        .replace(/\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()

      if (clean) return `Bizum ${clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()}`
    }

    const personMatch = s.match(/bizum\s+(?:de|a favor de)\s+(.+?)(?:\s+concepto|$)/i)
    if (personMatch?.[1]) {
      return `Bizum ${personMatch[1].replace(/\s+/g, " ").trim()}`
    }

    return "Bizum Ocio"
  }

  if (/transferencia/.test(low)) return "Transferencia"

  s = s
    .replace(/(?:TRANSACCION\s*CONTACTLESS|PAGO\s*MOVIL|COMPRA\s*INTERNET|DEVOLUCION\s*COMPRA|COMPRA)\s*(?:EN)?/gi, " ")
    .replace(/TARJETA\s+\d+|TARJ\.\s*:\*\d+|TARJETA\s*:\*\d+/gi, " ")
    .replace(/COMISION\s+\d+[,.]\d+/gi, " ")
    .replace(/\b[A-Z0-9*]{6,20}\b/gi, " ")
    .replace(/CONCEPTO:\s*Sin concepto|CONCEPTO:/gi, " ")
    .replace(/\b(?:SEVILLA|AZUAGA|SAN SEBASTIAN|ARTEIXO|OSUNA|BERLIN|LUXEMBOURG|S\.A\.U|ES)\b/gi, " ")
    .replace(/[,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const words = s.split(" ").filter((w) => w.length > 2 && !/^\d+$/.test(w))
  if (words.length > 0) {
    return words.slice(0, 3).join(" ")
  }

  return "Movimiento"
}

function parseExcelRows(matrix: unknown[][]): ParsedTransaction[] {
  const results: ParsedTransaction[] = []
  const seen = new Set<string>()

  const rows = matrix.map((row) => row.map((c) => (c === null || c === undefined ? "" : String(c).trim())))

  const headerIndex = rows.findIndex((row) => {
    const line = row.join(" ")
    return (
      row.length >= 2 &&
      (/fecha/i.test(line) || /date/i.test(line)) &&
      (/concepto|descripci[oó]n|nombre|description|name/i.test(line)) &&
      (/importe|monto|cantidad|amount|value/i.test(line) || /gasto|ingreso/i.test(line))
    )
  })

  if (headerIndex < 0) return []

  const header = rows[headerIndex].map((h) => h.toLowerCase())
  const dateCol = header.findIndex((h) => /fecha|date/i.test(h))
  const conceptCol = header.findIndex((h) => /concepto|descripci[oó]n|nombre|description|name/i.test(h))
  const typeCol = header.findIndex((h) => /^tipo$|^type$/i.test(h))
  const categoryCol = header.findIndex((h) => /^categor[ií]a$|^category$/i.test(h))
  let amountCol = header.findIndex((h) => /importe|monto|cantidad|amount|value/i.test(h))

  if (amountCol < 0) {
    amountCol = header.findIndex((h) => /gasto|ingreso/i.test(h))
  }

  if (dateCol < 0 || conceptCol < 0 || amountCol < 0) return []

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row.some(Boolean)) continue

    const dateRaw = row[dateCol] || ""
    const conceptRaw = row[conceptCol] || ""
    const amountRaw = row[amountCol] || ""
    const typeRaw = typeCol >= 0 ? (row[typeCol] || "").toLowerCase() : ""
    const categoryRaw = categoryCol >= 0 ? (row[categoryCol] || "").trim() : ""

    const date = parseSpanishDate(dateRaw) || (dateRaw.match(/^\d{4}-\d{2}-\d{2}$/) ? dateRaw : null)
    if (!date) continue

    if (!conceptRaw.trim()) continue
    if (!amountRaw.trim()) continue

    const explicitNegative = amountRaw.includes("-")
    const amount = parseEuAmount(amountRaw.replace(/[+\-]/g, ""))
    if (!Number.isFinite(amount) || amount <= 0) continue

    let description = cleanDescription(conceptRaw)
    const isDevolucion = /devoluci[oó]n|reembolso|refund/i.test(conceptRaw) || /devoluci[oó]n|reembolso|refund/i.test(description) || /devoluci[oó]n|reembolso/i.test(categoryRaw)

    if (isDevolucion) {
      description = "Devolución"
    }

    let type: "income" | "expense" = "expense"
    if (typeRaw) {
      if (/gasto|expense/.test(typeRaw)) {
        type = "expense"
      } else if (/ingreso|income/.test(typeRaw)) {
        type = "income"
      } else {
        type = detectType(conceptRaw, description, true, explicitNegative ? -1 : 1)
      }
    } else {
      type = detectType(conceptRaw, description, true, explicitNegative ? -1 : 1)
    }

    const category = isDevolucion ? "Reembolso" : (categoryRaw || autoCategory(`${conceptRaw} ${description}`, type))
    const key = `${date}-${amount.toFixed(2)}-${description}-${type}`

    if (seen.has(key)) continue
    seen.add(key)

    results.push({
      id: `file-${i}-${Math.random().toString(36).slice(2, 7)}`,
      date,
      name: description,
      amount: Math.abs(amount),
      type,
      category,
      raw: JSON.stringify(row),
      confidence: "high",
    })
  }

  return results.sort((a, b) => b.date.localeCompare(a.date))
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 })
    }

    const lowerName = file.name.toLowerCase()
    const isSupported = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv")

    if (!isSupported) {
      return NextResponse.json({ error: "El archivo debe ser Excel (.xlsx, .xls) o CSV (.csv)" }, { status: 400 })
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede superar 20 MB" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const XLSX = require("xlsx")
    const workbook = XLSX.read(buffer, { type: "buffer", raw: true })

    const sheetName =
      workbook.SheetNames.find((n: string) => /movimientos/i.test(n)) || workbook.SheetNames[0]

    if (!sheetName) {
      return NextResponse.json({ error: "No se encontró ninguna hoja en el archivo" }, { status: 422 })
    }

    const sheet = workbook.Sheets[sheetName]
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][]
    const transactions = parseExcelRows(matrix)

    if (!transactions.length) {
      return NextResponse.json(
        {
          error: "No se detectaron transacciones válidas en el archivo. Asegúrate de incluir las columnas Fecha, Concepto e Importe.",
          debug: {
            rows: matrix.length,
            sheetName,
          },
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      transactions,
      pages: 1,
      textLength: matrix.length,
      source: "xlsx",
      sheetName,
    })
  } catch (err) {
    console.error("[parse-file]", err)
    return NextResponse.json(
      { error: "Error al procesar el archivo. Asegúrate de que no está dañado ni protegido." },
      { status: 500 }
    )
  }
}