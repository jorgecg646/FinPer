import { cookies } from "next/headers"
import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { YearSelector } from "@/components/finance/charts"
import { BudgetsAndGoalsManager } from "./budgets-goals"
import { CurrencySelector } from "@/components/finance/currency-pdf-exporter"
import { CURRENCY_SYMBOLS, DEFAULT_CURRENCY, DISPLAY_CURRENCY_KEY } from "@/lib/format"

export const dynamic = "force-dynamic"

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year } = await searchParams
  const selectedYear = year ? Number(year) : undefined

  const cookieStore = await cookies()
  const currencyCode = cookieStore.get(DISPLAY_CURRENCY_KEY)?.value || cookieStore.get("finflow-currency")?.value || DEFAULT_CURRENCY
  const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || "€"

  const [summary, transactions] = await Promise.all([
    getSummary(selectedYear),
    getTransactions(),
  ])

  return (
    <LayoutShell balance={summary.balance} currencySymbol={currencySymbol}>
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
            <YearSelector selectedYear={summary.selectedYear} availableYears={summary.availableYears} />
          </div>
        </header>

        <BudgetsAndGoalsManager transactions={transactions} currencySymbol={currencySymbol} />
      </div>
    </LayoutShell>
  )
}
