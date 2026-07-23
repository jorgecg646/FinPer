import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { Topbar, BalanceCard, StatCards } from "@/components/finance/dashboard"
import { RecentTransactions } from "@/components/finance/transactions"
import { MonthlyComparisonChart, NetSavingsTrendChart, FinancialOverviewRatioChart, YearSelector } from "@/components/finance/charts"

import { CurrencySelector, PdfExporter } from "@/components/finance/currency-pdf-exporter"

export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const resolvedParams = await searchParams
  const targetYear = resolvedParams?.year ? parseInt(resolvedParams.year) : undefined

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

      {/* Main Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left/Main Column */}
        <div className="flex flex-col gap-6 xl:col-span-2">
          <BalanceCard balance={summary.balance} monthly={summary.monthly} />
          
          <FinancialOverviewRatioChart income={summary.income} expenses={summary.expenses} />
          <MonthlyComparisonChart transactions={transactions} selectedYear={selectedYear} />
          <NetSavingsTrendChart transactions={transactions} selectedYear={selectedYear} />

          <RecentTransactions transactions={transactions} />
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          <StatCards income={summary.income} expenses={summary.expenses} />
        </div>
      </div>
    </LayoutShell>
  )
}
