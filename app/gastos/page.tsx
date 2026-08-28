import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import {
  ExpenseChart,
  ExpenseMonthlyBarChart,
  ExpenseCategoryProgressChart,
  YearOverYearComparisonChart,
  YearSelector,
} from "@/components/finance/charts"
import { RecentTransactions } from "@/components/finance/transactions"
import { ExpenseCalendarHeatmap } from "./expense-calendar"
import { isInvestmentTx } from "@/lib/finance"
import { TrendingDown } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Gastos — BudgetNext",
  description: "Visualiza y controla todos tus gastos por categoría.",
}

export default async function GastosPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year } = await searchParams
  const targetYear = year ? Number(year) : undefined

  const [summary, transactions] = await Promise.all([getSummary(targetYear), getTransactions()])
  const selectedYear = summary.selectedYear

  // Real living expenses (excluding capital transfers to brokers / investments)
  const nonInvestmentTxs = transactions.filter((t) => !isInvestmentTx(t))
  const expenseTransactions = nonInvestmentTxs.filter((t) => {
    const d = new Date(t.occurredAt)
    return t.type === "expense" && d.getFullYear() === selectedYear
  })

  const totalLivingExpenses = expenseTransactions.reduce((s, t) => s + t.amount, 0)

  return (
    <LayoutShell balance={summary.balance}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <header className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TrendingDown className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total gastos de vida en {selectedYear}</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              -${totalLivingExpenses.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h1>
          </div>
        </header>

        <div className="self-end sm:self-auto">
          <YearSelector selectedYear={selectedYear} availableYears={summary.availableYears} />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {/* Top Grid: Gastos por Mes (2026) side-by-side with Gastos por Categoría */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ExpenseMonthlyBarChart transactions={nonInvestmentTxs} selectedYear={selectedYear} />
          <ExpenseChart transactions={expenseTransactions} />
        </div>

        {/* 2nd Section: Movimientos */}
        <RecentTransactions transactions={nonInvestmentTxs.filter(t => t.type === "expense")} showAll typeFilter="expense" selectedYear={selectedYear} />

        {/* 3rd Section: Restantes gráficas */}
        <ExpenseCategoryProgressChart transactions={expenseTransactions} />
        <YearOverYearComparisonChart transactions={nonInvestmentTxs} selectedYear={selectedYear} />

        {/* 4th Section: Interactive Expense Calendar & Subscriptions Heatmap (Minimizable) */}
        <ExpenseCalendarHeatmap transactions={transactions} initialYear={selectedYear} />
      </div>
    </LayoutShell>
  )
}
