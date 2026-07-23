import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { ExpenseChart, ExpenseMonthlyBarChart, ExpenseCategoryProgressChart, YearSelector } from "@/components/finance/charts"
import { RecentTransactions } from "@/components/finance/transactions"
import { TrendingDown } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Gastos — FinFlow",
  description: "Visualiza y controla todos tus gastos por categoría.",
}

export default async function GastosPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const resolvedParams = await searchParams
  const targetYear = resolvedParams?.year ? parseInt(resolvedParams.year) : undefined

  const [summary, transactions] = await Promise.all([getSummary(targetYear), getTransactions()])
  const selectedYear = summary.selectedYear

  const expenseTransactions = transactions.filter((t) => {
    const d = new Date(t.occurredAt)
    return t.type === "expense" && d.getFullYear() === selectedYear
  })

  return (
    <LayoutShell balance={summary.balance}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <header className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TrendingDown className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total gastado en {selectedYear}</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              -${summary.expenses.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h1>
          </div>
        </header>

        <div className="self-end sm:self-auto">
          <YearSelector selectedYear={selectedYear} availableYears={summary.availableYears} />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <ExpenseMonthlyBarChart transactions={transactions} selectedYear={selectedYear} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ExpenseChart transactions={expenseTransactions} />
          <ExpenseCategoryProgressChart transactions={expenseTransactions} />
        </div>

        <RecentTransactions transactions={transactions.filter(t => t.type === "expense")} showAll typeFilter="expense" />
      </div>
    </LayoutShell>
  )
}
