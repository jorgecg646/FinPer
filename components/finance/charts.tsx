import type { Summary, Tx } from "@/app/actions"

const PALETTE = ["#c4e538","#2fa971","#16362a","#6f7d72","#e5484d","#60a5fa","#f97316","#a78bfa","#34d399","#fbbf24","#f43f5e","#0ea5e9"]

// ─────────────────────────────────────────────────────────────────────────────
// IncomeChart — SVG bar chart showing net income per month
// ─────────────────────────────────────────────────────────────────────────────

export function IncomeChart({ monthly }: { monthly: Summary["monthly"] }) {
  const maxIncome = Math.max(1, ...monthly.map((m) => Math.max(0, m.net)))
  const barW = 100 / (monthly.length * 2)

  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm">
      <h2 className="text-base font-bold text-foreground">Ingresos por mes</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Últimos 6 meses</p>

      <svg viewBox="0 0 100 60" className="mt-5 w-full" aria-label="Gráfico de ingresos por mes" role="img">
        {monthly.map((m, i) => {
          const x = i * (100 / monthly.length) + barW * 0.5
          const netIncome = Math.max(0, m.net)
          const barHeight = (netIncome / maxIncome) * 44
          return (
            <g key={m.key}>
              <rect x={x} y={50 - barHeight} width={barW} height={barHeight} rx="2" fill="var(--positive)" opacity="0.85" />
              <text x={x + barW / 2} y="58" textAnchor="middle" fontSize="4" fill="var(--muted-foreground)">{m.label}</text>
            </g>
          )
        })}
        <line x1="0" y1="50" x2="100" y2="50" stroke="var(--border)" strokeWidth="0.5" />
      </svg>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {monthly.map((m) => (
          <div key={m.key} className="text-center">
            <p className="text-xs font-semibold text-positive">
              +${Math.max(0, m.net).toLocaleString("es-ES", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ExpenseChart — SVG donut chart showing expense breakdown by category
// ─────────────────────────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCartesian(cx, cy, r, start)
  const e = polarToCartesian(cx, cy, r, end)
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${e.x} ${e.y} Z`
}

export function ExpenseChart({ transactions }: { transactions: Tx[] }) {
  const byCategory = new Map<string, number>()
  for (const t of transactions.filter((t) => t.type === "expense")) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
  }

  const entries = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const total = entries.reduce((s, [, v]) => s + v, 0)

  if (total === 0) {
    return (
      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <h2 className="text-base font-bold text-foreground">Gastos por categoría</h2>
        <p className="mt-6 mb-4 text-center text-sm text-muted-foreground">Sin datos de gastos aún.</p>
      </section>
    )
  }

  let currentAngle = 0
  const slices = entries.map(([cat, amount], i) => {
    const deg = (amount / total) * 360
    const path = arcPath(50, 50, 40, currentAngle, currentAngle + deg - 0.5)
    currentAngle += deg
    return { cat, amount, path, color: PALETTE[i % PALETTE.length] }
  })

  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm">
      <h2 className="text-base font-bold text-foreground">Gastos por categoría</h2>
      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
        <svg viewBox="0 0 100 100" className="h-40 w-40 shrink-0" aria-label="Gráfico de gastos por categoría" role="img">
          {slices.map((s) => <path key={s.cat} d={s.path} fill={s.color} opacity="0.9" />)}
          <circle cx="50" cy="50" r="22" fill="var(--card)" />
          <text x="50" y="47" textAnchor="middle" fontSize="6" fill="var(--muted-foreground)">Total</text>
          <text x="50" y="56" textAnchor="middle" fontSize="7" fontWeight="bold" fill="var(--foreground)">
            ${total.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
          </text>
        </svg>
        <ul className="flex w-full flex-col gap-2">
          {slices.map((s) => (
            <li key={s.cat} className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{s.cat}</span>
              <span className="text-sm font-semibold text-foreground">
                ${s.amount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="w-10 text-right text-xs text-muted-foreground">{((s.amount / total) * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MonthlyComparisonChart — Comparative Bar Chart (Ingresos vs Gastos)
// ─────────────────────────────────────────────────────────────────────────────

export function MonthlyComparisonChart({ transactions }: { transactions: Tx[] }) {
  const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  const now = new Date()
  const months: { label: string; income: number; expense: number }[] = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth()

    let inc = 0
    let exp = 0

    for (const t of transactions) {
      const td = new Date(t.occurredAt)
      if (td.getFullYear() === year && td.getMonth() === month) {
        if (t.type === "income") inc += t.amount
        else exp += t.amount
      }
    }

    months.push({ label: MONTH_LABELS[month], income: inc, expense: exp })
  }

  const maxVal = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]))

  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Comparativa Ingresos vs Gastos</h2>
          <p className="text-xs text-muted-foreground">Evolución mensual en los últimos 6 meses</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-positive" />
            <span>Ingresos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
            <span>Gastos</span>
          </div>
        </div>
      </div>

      <svg viewBox="0 0 100 50" className="mt-5 w-full overflow-visible" aria-label="Comparativa de ingresos y gastos" role="img">
        {months.map((m, i) => {
          const groupW = 100 / months.length
          const barW = groupW * 0.3
          const xInc = i * groupW + groupW * 0.15
          const xExp = xInc + barW + 1

          const hInc = (m.income / maxVal) * 38
          const hExp = (m.expense / maxVal) * 38

          return (
            <g key={m.label}>
              {/* Income bar */}
              <rect x={xInc} y={40 - hInc} width={barW} height={hInc} rx="1" fill="var(--positive)" opacity="0.9" />
              {/* Expense bar */}
              <rect x={xExp} y={40 - hExp} width={barW} height={hExp} rx="1" fill="var(--destructive)" opacity="0.9" />
              {/* Label */}
              <text x={xInc + barW + 0.5} y="47" textAnchor="middle" fontSize="3.5" fill="var(--muted-foreground)">
                {m.label}
              </text>
            </g>
          )
        })}
        <line x1="0" y1="40" x2="100" y2="40" stroke="var(--border)" strokeWidth="0.5" />
      </svg>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NetSavingsTrendChart — Line & Area Chart for Net Savings Trend
// ─────────────────────────────────────────────────────────────────────────────

export function NetSavingsTrendChart({ transactions }: { transactions: Tx[] }) {
  const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  const now = new Date()
  const data: { label: string; net: number }[] = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth()

    let net = 0
    for (const t of transactions) {
      const td = new Date(t.occurredAt)
      if (td.getFullYear() === year && td.getMonth() === month) {
        net += t.type === "income" ? t.amount : -t.amount
      }
    }
    data.push({ label: MONTH_LABELS[month], net })
  }

  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.net)))
  const stepX = 100 / (data.length - 1 || 1)

  const points = data.map((d, i) => {
    const x = i * stepX
    // Map net to y range [5, 45] where y=25 is 0
    const y = 25 - (d.net / maxAbs) * 20
    return { x, y, ...d }
  })

  const pathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "")
  const areaD = `${pathD} L 100 25 L 0 25 Z`

  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Tendencia de Ahorro Neto</h2>
          <p className="text-xs text-muted-foreground">Flujo de caja mensual (Ingresos - Gastos)</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">
          {data[data.length - 1]?.net >= 0 ? "+" : ""}${data[data.length - 1]?.net.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} este mes
        </span>
      </div>

      <svg viewBox="0 0 100 55" className="mt-5 w-full overflow-visible" aria-label="Tendencia de ahorro neto" role="img">
        {/* Zero baseline */}
        <line x1="0" y1="25" x2="100" y2="25" stroke="var(--border)" strokeDasharray="1.5,1.5" strokeWidth="0.5" />

        {/* Filled area */}
        <path d={areaD} fill="var(--primary)" opacity="0.15" />

        {/* Trend line */}
        <path d={pathD} fill="none" stroke="var(--positive)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="1.8" fill="var(--card)" stroke="var(--positive)" strokeWidth="1" />
            <text x={p.x} y="52" textAnchor="middle" fontSize="3.5" fill="var(--muted-foreground)">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </section>
  )
}
