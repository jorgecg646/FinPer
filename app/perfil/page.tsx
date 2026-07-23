import { getSummary, getProfileStats } from "@/app/actions"
import { LayoutShell } from "@/components/finance/navigation"
import { ProfileForm } from "@/components/finance/profile"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Perfil — FinFlow",
  description: "Tu perfil y resumen financiero personal.",
}

export default async function PerfilPage() {
  const [summary, stats] = await Promise.all([getSummary(), getProfileStats()])

  return (
    <LayoutShell balance={summary.balance}>
      <header>
        <p className="text-sm text-muted-foreground">Configuración</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Perfil</h1>
      </header>
      <div className="mt-8">
        <ProfileForm stats={stats} />
      </div>
    </LayoutShell>
  )
}
