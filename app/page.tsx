import { cookies } from "next/headers"
import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { Topbar, BalanceCard, StatCards, InvestmentBalanceBanner } from "@/components/finance/dashboard"
import { YearSelector } from "@/components/finance/charts"
import { CurrencySelector } from "@/components/finance/currency-pdf-exporter"
import { CURRENCY_SYMBOLS, DEFAULT_CURRENCY, DISPLAY_CURRENCY_KEY } from "@/lib/format"
import {
  FinancialOverviewRatioChart,
  MonthlyComparisonChart,
  NetSavingsTrendChart,
  MoneyFlowSankeyChart,
  RecentTransactions,
  AnnualWrappedBanner,
} from "@/components/finance/lazy-home-charts"

export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year } = await searchParams
  const targetYear = year ? Number(year) : undefined

  const cookieStore = await cookies()
  const currencyCode = cookieStore.get(DISPLAY_CURRENCY_KEY)?.value || cookieStore.get("finflow-currency")?.value || DEFAULT_CURRENCY
  const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || "€"

  const [summary, transactions] = await Promise.all([getSummary(targetYear), getTransactions()])
  const selectedYear = summary.selectedYear

  return (
    <LayoutShell balance={summary.balance} currencySymbol={currencySymbol}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Topbar />
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <CurrencySelector />
          <YearSelector selectedYear={selectedYear} availableYears={summary.availableYears} />
        </div>
      </div>

      {/* Annual Wrapped Banner Highlight */}
      <div className="mt-6">
        <AnnualWrappedBanner summary={summary} transactions={transactions} currencySymbol={currencySymbol} />
      </div>

      {/* Main Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left/Main Column */}
        <div className="flex flex-col gap-6 xl:col-span-2">
          <BalanceCard balance={summary.balance} monthly={summary.monthly} year={selectedYear} currencySymbol={currencySymbol} />

          {/* Investment portfolio live snapshot */}
          <InvestmentBalanceBanner cashBalance={summary.balance} currencySymbol={currencySymbol} />

          {/* 2nd position: Movimientos */}
          <RecentTransactions transactions={transactions} selectedYear={selectedYear} currencySymbol={currencySymbol} />

          {/* Charts */}
          <FinancialOverviewRatioChart income={summary.income} expenses={summary.expenses} currencySymbol={currencySymbol} />
          <MonthlyComparisonChart transactions={transactions} selectedYear={selectedYear} currencySymbol={currencySymbol} />
          <NetSavingsTrendChart transactions={transactions} selectedYear={selectedYear} currencySymbol={currencySymbol} />

          {/* Last chart: Diagrama de Flujo (Sankey) */}
          <MoneyFlowSankeyChart transactions={transactions} currencySymbol={currencySymbol} />
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          <StatCards income={summary.income} expenses={summary.expenses} year={selectedYear} currencySymbol={currencySymbol} />
        </div>
      </div>
    </LayoutShell>
  )
}
