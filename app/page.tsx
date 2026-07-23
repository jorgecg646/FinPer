import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { Topbar, BalanceCard, StatCards } from "@/components/finance/dashboard"
import { RecentTransactions } from "@/components/finance/transactions"
import { MonthlyComparisonChart, NetSavingsTrendChart } from "@/components/finance/charts"

export const dynamic = "force-dynamic"

export default async function Page() {
  const [summary, transactions] = await Promise.all([getSummary(), getTransactions()])

  return (
    <LayoutShell balance={summary.balance}>
      <Topbar />

      {/* Main Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left/Main Column */}
        <div className="flex flex-col gap-6 xl:col-span-2">
          <BalanceCard balance={summary.balance} monthly={summary.monthly} />
          
          {/* Visualizaciones avanzadas */}
          <MonthlyComparisonChart transactions={transactions} />
          <NetSavingsTrendChart transactions={transactions} />

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
