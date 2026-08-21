import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { Topbar, BalanceCard, StatCards } from "@/components/finance/dashboard"
import { RecentTransactions } from "@/components/finance/transactions"
import {
  MonthlyComparisonChart,
  NetSavingsTrendChart,
  FinancialOverviewRatioChart,
  MoneyFlowSankeyChart,
  YearSelector,
} from "@/components/finance/charts"
import { AnnualWrappedBanner } from "@/components/finance/annual-wrapped"
import { CurrencySelector, PdfExporter } from "@/components/finance/currency-pdf-exporter"

export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year } = await searchParams
  const targetYear = year ? Number(year) : undefined

  const [summary, transactions] = await Promise.all([getSummary(targetYear), getTransactions()])
  const selectedYear = summary.selectedYear

  return (
    <LayoutShell balance={summary.balance}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Topbar />
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <CurrencySelector />
          <PdfExporter summary={summary} transactions={transactions} />
          <YearSelector selectedYear={selectedYear} availableYears={summary.availableYears} />
        </div>
      </div>

      {/* Annual Wrapped Banner Highlight */}
      <div className="mt-6">
        <AnnualWrappedBanner summary={summary} transactions={transactions} />
      </div>

      {/* Main Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left/Main Column */}
        <div className="flex flex-col gap-6 xl:col-span-2">
          <BalanceCard balance={summary.balance} monthly={summary.monthly} year={selectedYear} />

          {/* 2nd position: Movimientos */}
          <RecentTransactions transactions={transactions} />

          {/* Charts */}
          <FinancialOverviewRatioChart income={summary.income} expenses={summary.expenses} />
          <MonthlyComparisonChart transactions={transactions} selectedYear={selectedYear} />
          <NetSavingsTrendChart transactions={transactions} selectedYear={selectedYear} />

          {/* Last chart: Diagrama de Flujo (Sankey) */}
          <MoneyFlowSankeyChart transactions={transactions} />
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          <StatCards income={summary.income} expenses={summary.expenses} year={selectedYear} />
        </div>
      </div>
    </LayoutShell>
  )
}
