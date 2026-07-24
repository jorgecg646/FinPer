import type { Tx } from "@/app/actions"

export function isInvestmentTx(t: Tx): boolean {
  const cat = (t.category || "").toLowerCase()
  const name = (t.name || "").toLowerCase()
  const pattern = /invers|trading|broker|myinvestor|trade|crypto|cripto|acciones|fondos|etf|bitcoin|binance|degiro|bolsa|patrimonio/i
  return pattern.test(cat) || pattern.test(name)
}
