import { cookies } from "next/headers"
import { getSummary, getTransactions, getStockPositions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { YearSelector, InvestmentMonthlyBarChart } from "@/components/finance/charts"
import { StockPricesPanel } from "./stock-prices"
import { RecentTransactions } from "@/components/finance/transactions"
import { MarketIndicesPanel } from "./market-indices"
import { isInvestmentTx } from "@/lib/finance"
import { CURRENCY_SYMBOLS, DEFAULT_CURRENCY, DISPLAY_CURRENCY_KEY, fmtSignedCurrency } from "@/lib/format"
import { TrendingUp } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Inversiones — BudgetNext",
  description: "Controla tu cartera de inversión, rentabilidad anual y acumulación de patrimonio.",
}

export default async function InversionesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year } = await searchParams
  const targetYear = year ? Number(year) : undefined

  const cookieStore = await cookies()
  const currencyCode = cookieStore.get(DISPLAY_CURRENCY_KEY)?.value || cookieStore.get("finflow-currency")?.value || DEFAULT_CURRENCY
  const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || "€"

  const [summary, transactions, stockPositions] = await Promise.all([
    getSummary(targetYear),
    getTransactions(),
    getStockPositions(),
  ])
  const selectedYear = summary.selectedYear

  const investmentTransactions = transactions.filter((t) => {
    const d = new Date(t.occurredAt)
    const isYearMatch = d.getFullYear() === selectedYear || d.getUTCFullYear() === selectedYear
    return isYearMatch && isInvestmentTx(t)
  })

  const totalInvested = investmentTransactions.reduce((s, t) => s + t.amount, 0)

  return (
    <LayoutShell balance={summary.balance} currencySymbol={currencySymbol}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <header className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-positive/10 text-positive">
            <TrendingUp className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Patrimonio Invertido en {selectedYear}</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {fmtSignedCurrency(totalInvested, currencySymbol)}
            </h1>
          </div>
        </header>

        <div className="self-end sm:self-auto">
          <YearSelector selectedYear={selectedYear} availableYears={summary.availableYears} />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {/* Global Market Indices — CNBC style */}
        <MarketIndicesPanel />

        {/* Real-time market prices & live portfolio summary */}
        <StockPricesPanel
          initialPositions={stockPositions}
        />

        <div className="grid grid-cols-1 gap-6">
          <InvestmentMonthlyBarChart transactions={transactions} selectedYear={selectedYear} currencySymbol={currencySymbol} />
        </div>

        <RecentTransactions
          transactions={transactions.filter(isInvestmentTx)}
          showAll
          selectedYear={selectedYear}
          defaultCategory="Inversiones"
          currencySymbol={currencySymbol}
        />
      </div>
    </LayoutShell>
  )
}
