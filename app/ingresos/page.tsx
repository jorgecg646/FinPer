import { cookies } from "next/headers"
import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { IncomeChart, IncomeCategoryChart, YearSelector } from "@/components/finance/charts"
import { RecentTransactions } from "@/components/finance/transactions"
import { TrendingUp } from "lucide-react"
import { CURRENCY_SYMBOLS, DEFAULT_CURRENCY, DISPLAY_CURRENCY_KEY, fmtSignedCurrency } from "@/lib/format"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Ingresos — BudgetNext",
  description: "Visualiza y gestiona todos tus ingresos.",
}

export default async function IngresosPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year } = await searchParams
  const targetYear = year ? Number(year) : undefined

  const cookieStore = await cookies()
  const currencyCode = cookieStore.get(DISPLAY_CURRENCY_KEY)?.value || cookieStore.get("finflow-currency")?.value || DEFAULT_CURRENCY
  const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || "€"

  const [summary, transactions] = await Promise.all([getSummary(targetYear), getTransactions()])
  const selectedYear = summary.selectedYear

  const incomeTransactions = transactions.filter((t) => {
    const d = new Date(t.occurredAt)
    return t.type === "income" && d.getFullYear() === selectedYear
  })

  return (
    <LayoutShell balance={summary.balance} currencySymbol={currencySymbol}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <header className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-positive/10 text-positive">
            <TrendingUp className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total ingresos en {selectedYear}</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {fmtSignedCurrency(summary.income, currencySymbol)}
            </h1>
          </div>
        </header>

        <div className="self-end sm:self-auto">
          <YearSelector selectedYear={selectedYear} availableYears={summary.availableYears} />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncomeChart monthly={summary.monthly} year={selectedYear} currencySymbol={currencySymbol} />
          <IncomeCategoryChart transactions={incomeTransactions} currencySymbol={currencySymbol} />
        </div>
        <RecentTransactions transactions={transactions.filter(t => t.type === "income")} showAll typeFilter="income" selectedYear={selectedYear} currencySymbol={currencySymbol} />
      </div>
    </LayoutShell>
  )
}
