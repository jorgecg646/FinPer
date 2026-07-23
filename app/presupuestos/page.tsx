import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { YearSelector } from "@/components/finance/charts"
import { BudgetsAndGoalsManager } from "@/components/finance/budgets-goals"
import { CurrencySelector, PdfExporter } from "@/components/finance/currency-pdf-exporter"

export const dynamic = "force-dynamic"

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year } = await searchParams
  const selectedYear = year ? Number(year) : undefined

  const [summary, transactions] = await Promise.all([
    getSummary(selectedYear),
    getTransactions(),
  ])

  return (
    <LayoutShell balance={summary.balance}>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Presupuestos y Metas
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Establece límites por categoría y haz seguimiento de tus metas de ahorro
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <CurrencySelector />
            <PdfExporter summary={summary} transactions={transactions} />
            <YearSelector selectedYear={summary.selectedYear} availableYears={summary.availableYears} />
          </div>
        </header>

        <BudgetsAndGoalsManager transactions={transactions} />
      </div>
    </LayoutShell>
  )
}
