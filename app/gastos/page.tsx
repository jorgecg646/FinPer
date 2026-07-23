import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { ExpenseChart } from "@/components/finance/charts"
import { RecentTransactions } from "@/components/finance/transactions"
import { TrendingDown } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Gastos — FinFlow",
  description: "Visualiza y controla todos tus gastos por categoría.",
}

export default async function GastosPage() {
  const [summary, transactions] = await Promise.all([getSummary(), getTransactions()])
  const expenseTransactions = transactions.filter((t) => t.type === "expense")

  return (
    <LayoutShell balance={summary.balance}>
      <header className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TrendingDown className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total gastado</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            -${summary.expenses.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h1>
        </div>
      </header>
      <div className="mt-8 flex flex-col gap-6">
        <ExpenseChart transactions={expenseTransactions} />
        <RecentTransactions transactions={expenseTransactions} showAll typeFilter="expense" />
      </div>
    </LayoutShell>
  )
}
