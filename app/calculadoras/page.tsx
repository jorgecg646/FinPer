import { getSummary, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { YearSelector } from "@/components/finance/charts"
import { CurrencySelector, PdfExporter } from "@/components/finance/currency-pdf-exporter"
import { MicroExpensesLongTermCalculator } from "@/components/finance/micro-expenses-calculator"
import { ScenarioSimulator } from "@/components/finance/scenario-simulator"
import { Rule503020Calculator } from "@/components/finance/financial-calculators"
import { Calculator } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Calculadoras & Simuladores — BudgetNext",
  description: "Herramientas interactivas de simulación financiera, impacto de gastos y salud presupuestaria.",
}

export default async function CalculadorasPage({
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
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Calculator className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Calculadoras & Simuladores
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Simula decisiones financieras, impacto de compras cotidianas y optimiza tu presupuesto
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <CurrencySelector />
            <PdfExporter summary={summary} transactions={transactions} />
            <YearSelector selectedYear={summary.selectedYear} availableYears={summary.availableYears} />
          </div>
        </header>

        {/* Stack of Calculators & Simulators */}
        <div className="flex flex-col gap-8">
          {/* 1. Micro-Expenses Long Term Calculator */}
          <MicroExpensesLongTermCalculator transactions={transactions} />

          {/* 2. What-If Financial Scenario Simulator */}
          <ScenarioSimulator summary={summary} transactions={transactions} />

          {/* 3. 50/30/20 Financial Health Diagnosis */}
          <Rule503020Calculator summary={summary} />
        </div>
      </div>
    </LayoutShell>
  )
}
