import { isInvestmentTx } from "@/lib/finance"

export type FinanceTransaction = {
  name: string
  category: string
  type: "income" | "expense"
  amount: number
  occurredAt: string
}

export type Summary = {
  balance: number
  income: number
  expenses: number
  selectedYear: number
  availableYears: number[]
  monthly: { key: string; label: string; net: number; income: number; expense: number }[]
}

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

export function calculateSummary(
  txs: FinanceTransaction[],
  targetYear?: number,
  cookieYear?: number,
  currentYear = new Date().getFullYear()
): Summary {
  const yearSet = new Set<number>([currentYear])
  for (const t of txs) {
    const year = new Date(t.occurredAt).getFullYear()
    if (!isNaN(year)) yearSet.add(year)
  }
  const availableYears = [...yearSet].sort((a, b) => b - a)

  const desiredYear = targetYear || cookieYear
  let selectedYear = desiredYear && availableYears.includes(desiredYear) ? desiredYear : currentYear

  if (!desiredYear) {
    const hasTxsInCurrentYear = txs.some((t) => new Date(t.occurredAt).getFullYear() === currentYear)
    if (!hasTxsInCurrentYear && availableYears.length > 0) {
      const yearWithTxs = availableYears.find((year) =>
        txs.some((t) => new Date(t.occurredAt).getFullYear() === year)
      )
      if (yearWithTxs) selectedYear = yearWithTxs
    }
  }

  let income = 0
  let expenses = 0
  for (const t of txs) {
    if (isInvestmentTx(t)) continue
    if (new Date(t.occurredAt).getFullYear() === selectedYear) {
      if (t.type === "income") income += t.amount
      else expenses += t.amount
    }
  }

  const buckets = Array.from({ length: 12 }, (_, month) => ({
    key: `${selectedYear}-${month}`,
    label: MONTH_LABELS[month],
    net: 0,
    income: 0,
    expense: 0,
  }))
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  for (const t of txs) {
    if (isInvestmentTx(t)) continue
    const date = new Date(t.occurredAt)
    if (date.getFullYear() !== selectedYear) continue

    const bucket = byKey.get(`${selectedYear}-${date.getMonth()}`)
    if (!bucket) continue

    if (t.type === "income") {
      bucket.income += t.amount
      bucket.net += t.amount
    } else {
      bucket.expense += t.amount
      bucket.net -= t.amount
    }
  }

  const round2 = (value: number) => Math.round(value * 100) / 100

  return {
    balance: round2(income - expenses),
    income: round2(income),
    expenses: round2(expenses),
    selectedYear,
    availableYears,
    monthly: buckets.map((bucket) => ({
      ...bucket,
      net: round2(bucket.net),
      income: round2(bucket.income),
      expense: round2(bucket.expense),
    })),
  }
}
