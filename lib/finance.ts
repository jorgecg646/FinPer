import type { Tx } from "@/app/actions"

/**
 * Checks if a transaction represents an investment/broker/crypto transfer rather than day-to-day living expense
 */
export function isInvestmentTx(t: Tx): boolean {
  const cat = (t.category || "").toLowerCase()
  const name = (t.name || "").toLowerCase()
  const pattern = /invers|trading|broker|myinvestor|trade|crypto|cripto|acciones|fondos|etf|bitcoin|binance|degiro|bolsa|patrimonio/i
  return pattern.test(cat) || pattern.test(name)
}

/**
 * Filters only day-to-day living expenses (excludes investments & asset transfers)
 */
export function filterLivingExpenses(transactions: Tx[]): Tx[] {
  return transactions.filter((t) => t.type === "expense" && !isInvestmentTx(t))
}

/**
 * Filters only investments, trading, and crypto allocations
 */
export function filterInvestments(transactions: Tx[]): Tx[] {
  return transactions.filter(isInvestmentTx)
}
