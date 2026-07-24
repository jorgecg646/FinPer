import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import {
  InvestmentCategoryChart,
  InvestmentMonthlyBarChart,
  YearSelector,
} from "@/components/finance/charts"
import { InvestmentReturnCard } from "@/components/finance/investment-return"
import { RecentTransactions } from "@/components/finance/transactions"
import { isInvestmentTx } from "@/lib/finance"
import { TrendingUp } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Inversiones — BudgetNext",
  description: "Controla tu cartera de inversión, rentabilidad anual y acumulación de patrimonio.",
}

export default async function InversionesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year } = await searchParams
  const targetYear = year ? Number(year) : undefined

  const [summary, transactions] = await Promise.all([getSummary(targetYear), getTransactions()])
  const selectedYear = summary.selectedYear

  const investmentTransactions = transactions.filter((t) => {
    const d = new Date(t.occurredAt)
    const isYearMatch = d.getFullYear() === selectedYear || d.getUTCFullYear() === selectedYear
    return isYearMatch && isInvestmentTx(t)
  })

  const totalInvested = investmentTransactions.reduce((s, t) => s + t.amount, 0)

  return (
    <LayoutShell balance={summary.balance}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <header className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-positive/10 text-positive">
            <TrendingUp className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Patrimonio Invertido en {selectedYear}</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              +${totalInvested.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h1>
          </div>
        </header>

        <div className="self-end sm:self-auto">
          <YearSelector selectedYear={selectedYear} availableYears={summary.availableYears} />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {/* Interactive Annual ROI / Return Card */}
        <InvestmentReturnCard selectedYear={selectedYear} totalInvested={totalInvested} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InvestmentMonthlyBarChart transactions={transactions} selectedYear={selectedYear} />
          <InvestmentCategoryChart transactions={transactions} selectedYear={selectedYear} />
        </div>

        <RecentTransactions
          transactions={transactions.filter(isInvestmentTx)}
          showAll
          selectedYear={selectedYear}
          defaultCategory="Inversiones"
        />
      </div>
    </LayoutShell>
  )
}
