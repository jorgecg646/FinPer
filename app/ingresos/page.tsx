import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { IncomeChart } from "@/components/finance/charts"
import { RecentTransactions } from "@/components/finance/transactions"
import { TrendingUp } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Ingresos — FinFlow",
  description: "Visualiza y gestiona todos tus ingresos.",
}

export default async function IngresosPage() {
  const [summary, transactions] = await Promise.all([getSummary(), getTransactions()])
  const incomeTransactions = transactions.filter((t) => t.type === "income")

  return (
    <LayoutShell balance={summary.balance}>
      <header className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-positive/10 text-positive">
          <TrendingUp className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total acumulado</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            +${summary.income.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h1>
        </div>
      </header>
      <div className="mt-8 flex flex-col gap-6">
        <IncomeChart monthly={summary.monthly} />
        <RecentTransactions transactions={incomeTransactions} showAll typeFilter="income" />
      </div>
    </LayoutShell>
  )
}
