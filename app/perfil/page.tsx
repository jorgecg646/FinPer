import { getSummary, getProfileStats, getTransactions } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { ProfileForm } from "@/components/finance/profile"
import { FinancialOverviewRatioChart, ExpenseCategoryProgressChart, YearSelector } from "@/components/finance/charts"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Perfil — FinFlow",
  description: "Tu perfil y resumen financiero personal.",
}

export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const resolvedParams = await searchParams
  const targetYear = resolvedParams?.year ? parseInt(resolvedParams.year) : undefined

  const [summary, stats, transactions] = await Promise.all([getSummary(targetYear), getProfileStats(), getTransactions()])
  const selectedYear = summary.selectedYear

  const yearTransactions = transactions.filter((t) => new Date(t.occurredAt).getFullYear() === selectedYear)

  return (
    <LayoutShell balance={summary.balance}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <header>
          <p className="text-sm text-muted-foreground">Configuración</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Perfil y Análisis</h1>
        </header>

        <div className="self-end sm:self-auto">
          <YearSelector selectedYear={selectedYear} availableYears={summary.availableYears} />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FinancialOverviewRatioChart income={summary.income} expenses={summary.expenses} />
          <ExpenseCategoryProgressChart transactions={yearTransactions} />
        </div>
        
        <ProfileForm stats={stats} />
      </div>
    </LayoutShell>
  )
}
