"use client"

import { useState, useEffect, useRef } from "react"
import type { Tx, Summary } from "@/app/actions"
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Ghost,
  Repeat,
  RefreshCw,
  PiggyBank,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ArrowUpRight,
  Loader2,
} from "lucide-react"
import { fmtCurrency } from "@/lib/format"
import { useCurrency } from "@/components/finance/use-currency"
import type { FinancialInsights } from "@/lib/gemini"
import { Turnstile, type TurnstileRef } from "@/components/security/turnstile"
export type { FinancialInsights }

const CACHE_KEY = "finper_ai_insights_cache"

export function FinancialAiInsights({
  transactions = [],
  summary,
  currencySymbol = "€",
}: {
  transactions: Tx[]
  summary?: Summary
  currencySymbol?: string
}) {
  const { symbol: resolvedSym } = useCurrency(currencySymbol)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [insights, setInsights] = useState<FinancialInsights | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileRef>(null)

  // Load from persistent local storage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        setInsights(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  async function handleAnalyze() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions,
          currencySymbol: resolvedSym,
          targetYear: summary?.selectedYear,
          turnstileToken,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "No se pudo generar el análisis")
      }

      setInsights(data)
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data))
      } catch {
        // ignore
      }

      turnstileRef.current?.reset()
      setTurnstileToken(null)
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al contactar con Gemini AI")
      turnstileRef.current?.reset()
      setTurnstileToken(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl bg-card p-5 sm:p-6 border border-border shadow-xs transition-colors hover:border-border/80">
      {/* Background subtle glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500 border border-violet-500/20 shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground tracking-tight">
                Insights Financieros con IA
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-950/60 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/40">
                Gemini
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {insights?.generatedAt
                ? `Análisis guardado · ${new Date(insights.generatedAt).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Resumen ejecutivo, comparativa mensual y detector de gastos fantasma"}
            </p>
          </div>
        </div>

        {insights && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(CACHE_KEY)
                setInsights(null)
              }}
              disabled={loading}
              title="Volver a analizar"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Contraer" : "Expandir"}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {!insights && !loading && (
        <div className="mt-5 rounded-2xl bg-secondary/40 border border-border/60 p-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500 mb-3">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Descubre en qué se te va el dinero y dónde puedes recortar
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            Gemini analizará tus ingresos y gastos para comparar con el mes anterior, sugerirte 2-3 consejos de ahorro y detectar cobros duplicados o microgastos fantasma.
          </p>

          {error && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-4 flex flex-col items-center">
            {/* Cloudflare Turnstile */}
            <Turnstile
              ref={turnstileRef}
              onSuccess={(token) => {
                setTurnstileToken(token)
                setError(null)
              }}
              onExpire={() => setTurnstileToken(null)}
              onError={(err) => setError("Cloudflare no pudo verificar tu navegador: " + err)}
              theme="auto"
            />

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={loading || (Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) && !turnstileToken)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:from-violet-500 hover:to-purple-500 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? "Analizando..." : "Analizar mi mes con IA"}
            </button>

            <p className="mt-2.5 text-[10px] text-muted-foreground/60 text-center tracking-tight">
              Protegido por{" "}
              <a
                href="https://www.cloudflare.com/products/turnstile/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                Cloudflare Turnstile
              </a>
              {" · "}
              <a
                href="https://www.cloudflare.com/turnstile-privacy-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                Privacidad
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="mt-5 flex flex-col items-center justify-center py-10 text-center">
          <div className="relative flex h-14 w-14 items-center justify-center mb-3">
            <div className="absolute inset-0 animate-ping rounded-full bg-violet-500/20" />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 text-violet-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          </div>
          <p className="text-sm font-bold text-foreground">Analizando tus movimientos con Gemini...</p>
          <p className="mt-1 text-xs text-muted-foreground animate-pulse">
            Comparando con el mes previo y rastreando suscripciones duplicadas
          </p>
        </div>
      )}

      {/* Render Insights */}
      {insights && expanded && !loading && (
        <div className="mt-5 space-y-4">
          {/* 1. Executive Summary */}
          <div className="rounded-xl bg-violet-500/5 dark:bg-violet-950/20 border border-violet-500/15 p-4 text-xs leading-relaxed text-foreground/90">
            <p className="font-semibold text-violet-600 dark:text-violet-400 mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Resumen Ejecutivo
            </p>
            {insights.executiveSummary}
          </div>

          {/* 2. Dónde se te ha ido más dinero */}
          {insights.topIncrease && (
            <div className="rounded-xl bg-secondary/50 border border-border p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ArrowUpRight className="h-4 w-4 text-rose-500 shrink-0" />
                  Mayor aumento vs mes anterior
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-500 tabular-nums whitespace-nowrap">
                  +{fmtCurrency(insights.topIncrease.difference, resolvedSym)}
                  {insights.topIncrease.percentage > 0 && ` (+${insights.topIncrease.percentage}%)`}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed break-words">
                <strong className="text-foreground">{insights.topIncrease.category}:</strong>{" "}
                {insights.topIncrease.explanation}
              </p>
            </div>
          )}

          {/* 3. Consejos de ahorro personalizados */}
          {insights.savingsTips?.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                Consejos de Ahorro Personalizados
              </span>
              <div className="flex flex-col gap-2.5">
                {insights.savingsTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col justify-between rounded-xl bg-card border border-border/80 p-3.5 shadow-2xs hover:border-violet-500/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-foreground leading-snug">
                          {tip.title}
                        </span>
                        {tip.estimatedMonthlySaving > 0 && (
                          <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-emerald-500 tabular-nums whitespace-nowrap">
                            ~{fmtCurrency(tip.estimatedMonthlySaving, resolvedSym)}/mes
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                        {tip.description}
                      </p>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[10px] font-semibold text-muted-foreground/80 uppercase">
                      <span className="px-2 py-0.5 rounded-md bg-secondary/80 border border-border/50 text-[10px] text-muted-foreground">
                        {tip.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Detector de suscripciones duplicadas y gastos fantasma */}
          {insights.subscriptionAndGhostAlerts?.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Ghost className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  Suscripciones Duplicadas y Gastos Fantasma
                </span>
                {insights.ghostExpensesTotal > 0 && (
                  <span className="text-[11px] font-bold text-rose-400 tabular-nums whitespace-nowrap">
                    Fuga potencial: ~{fmtCurrency(insights.ghostExpensesTotal, resolvedSym)}/mes
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {insights.subscriptionAndGhostAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-border bg-secondary/30 p-3 sm:p-3.5 transition-colors hover:border-rose-500/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {alert.type === "duplicado" ? (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 mt-0.5">
                            <Repeat className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 mt-0.5">
                            <Ghost className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-xs text-foreground">
                              {alert.title}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[9px] font-semibold uppercase ${alert.type === "duplicado"
                                  ? "bg-rose-500/15 text-rose-400"
                                  : "bg-amber-500/15 text-amber-400"
                                }`}
                            >
                              {alert.type === "duplicado" ? "Posible Duplicado" : "Gasto Fantasma"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-foreground tabular-nums shrink-0 whitespace-nowrap">
                        {fmtCurrency(alert.amount, resolvedSym)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground sm:ml-8.5 leading-relaxed break-words">
                      {alert.alert}.{" "}
                      <span className="text-foreground/90 font-medium">{alert.recommendation}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default FinancialAiInsights

