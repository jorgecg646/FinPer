"use client"

import { useState, useEffect } from "react"

export interface MacroEvent {
  id: string
  title: string
  variant: string
  dateStr: string
  timeStr: string
  country: string
  flag: string
  impact: "HIGH" | "MEDIUM"
  actual: string | null
  actualRaw: number | null
  forecast: string
  forecastRaw: number | null
  previous: string
  previousRaw: number | null
  isReleased: boolean
  unit?: string
}

export interface EarningsItem {
  symbol: string
  name: string
  nextEarningsDate: string
  daysUntil: number
  epsEstimate: string
  urgency: "TODAY" | "WEEK" | "MONTH" | "LATER"
}

export function PriceAlertsMacroCalendar({ symbols }: { symbols: string[] }) {
  const [macroEvents, setMacroEvents] = useState<MacroEvent[]>([])
  const [loadingMacro, setLoadingMacro] = useState(true)
  const [earnings, setEarnings] = useState<EarningsItem[]>([])
  const [loadingEarnings, setLoadingEarnings] = useState(true)

  useEffect(() => {
    fetch("/api/macro-calendar")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.events)) setMacroEvents(d.events) })
      .catch(() => {})
      .finally(() => setLoadingMacro(false))
  }, [])

  const symKey = symbols.join(",")
  useEffect(() => {
    if (!symKey) { setLoadingEarnings(false); return }
    fetch(`/api/earnings?symbols=${encodeURIComponent(symKey)}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.earnings)) setEarnings(d.earnings) })
      .catch(() => {})
      .finally(() => setLoadingEarnings(false))
  }, [symKey])

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-150">
      <div className="rounded-2xl bg-gradient-to-br from-card via-background to-amber-950/10 p-4 border border-amber-500/20 shadow-md">
        <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">📅</span>
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Calendario Macroeconómico Semanal & Eventos en Directo</h3>
              <p className="text-xs text-muted-foreground">Datos semanales en tiempo real de IPC, tipos Fed/BCE y mercado laboral</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">API EN DIRECTO 🟢</span>
        </div>

        {loadingMacro ? (
          <div className="flex items-center justify-center p-8 gap-3 text-xs text-muted-foreground animate-pulse">
            <span className="h-3 w-3 rounded-full bg-amber-500 animate-ping" /><span>Cargando eventos macroeconómicos…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {macroEvents.map((evt) => {
              const isReleased = evt.isReleased || !!evt.actual
              const isToday = evt.dateStr === "HOY"

              return (
                <div key={evt.id} className={`flex flex-col justify-between p-3 rounded-xl border transition-all gap-2 ${isReleased ? isToday ? "bg-gradient-to-br from-emerald-500/10 via-secondary/40 to-card border-emerald-500/50" : "bg-secondary/40 border-emerald-500/30" : "bg-secondary/30 border-border/40 hover:border-amber-500/40"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-black flex items-center gap-1.5 text-foreground">
                      <span>{evt.flag}</span><span className="truncate max-w-[130px]">{evt.country}</span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {evt.variant && <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30">{evt.variant}</span>}
                      {isReleased ? (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">{isToday ? "🟢 PUBLICADO HOY" : "🟢 PUBLICADO"}</span>
                      ) : (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${evt.impact === "HIGH" ? "bg-red-500/10 text-red-500 border-red-500/30" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"}`}>
                          {evt.impact === "HIGH" ? "🔴 ALTO" : "🟡 MEDIO"}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs font-bold text-foreground leading-snug line-clamp-2">{evt.title}</p>

                  {isReleased && evt.actual ? (
                    <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 mt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Dato Real:</span>
                        <span className="text-sm font-black text-emerald-400 tabular-nums">{evt.actual}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                        {evt.forecast && evt.forecast !== "Pendiente" && <span>Prev: <strong className="text-foreground">{evt.forecast}</strong></span>}
                        {evt.previous && evt.previous !== "N/D" && <span>· Ant: {evt.previous}</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/20 mt-1">
                      <span className="font-extrabold text-amber-400">⏱️ {evt.dateStr} · {evt.timeStr}</span>
                      <span className="text-muted-foreground font-semibold">Prev: <strong className="text-foreground">{evt.forecast}</strong></span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-card via-background to-emerald-950/10 p-4 border border-emerald-500/20 shadow-md">
        <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">📈</span>
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Próximos Resultados Trimestrales de tu Cartera</h3>
              <p className="text-xs text-muted-foreground">Fecha de publicación de resultados vía TradingView</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">API EN DIRECTO 🟢</span>
        </div>

        {loadingEarnings ? (
          <div className="flex items-center justify-center p-8 gap-3 text-xs text-muted-foreground animate-pulse">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" /><span>Consultando fechas de resultados…</span>
          </div>
        ) : earnings.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No se encontraron próximas fechas de resultados para tus acciones.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {earnings.map((item) => (
              <div key={item.symbol} className="p-3 rounded-xl border border-border/40 bg-secondary/20 transition-all flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-foreground">{item.symbol}</p>
                    <p className="text-[10px] text-muted-foreground font-medium truncate max-w-[150px]">{item.name}</p>
                  </div>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-background/60 border border-border/40 text-muted-foreground">
                    {item.urgency === "TODAY" ? "🔴 HOY" : item.urgency === "WEEK" ? "🟡 Esta semana" : "🟢 Próximamente"}
                  </span>
                </div>
                <div className="border-t border-border/20 pt-2 flex flex-col gap-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground font-semibold">📅 Fecha:</span><span className="font-extrabold text-foreground">{item.nextEarningsDate}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground font-semibold">⏳ Faltan:</span><span className="font-black text-emerald-400">{item.daysUntil === 0 ? "¡HOY!" : `${item.daysUntil} días`}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
