"use client"

/**
 * Lazy-loaded client components for the home page.
 * Must live in a Client Component file because `ssr: false` is not
 * allowed inside Server Components (app/page.tsx).
 */

import nextDynamic from "next/dynamic"
import type { Summary, Tx } from "@/app/actions"

const ChartSkeleton = () => (
  <div className="h-72 w-full rounded-2xl bg-secondary/40 animate-pulse" />
)
const TransactionSkeleton = () => (
  <div className="h-48 w-full rounded-2xl bg-secondary/40 animate-pulse" />
)

export const FinancialOverviewRatioChart = nextDynamic(
  () => import("@/components/finance/charts").then((m) => m.FinancialOverviewRatioChart),
  { ssr: false, loading: ChartSkeleton }
)

export const MonthlyComparisonChart = nextDynamic(
  () => import("@/components/finance/charts").then((m) => m.MonthlyComparisonChart),
  { ssr: false, loading: ChartSkeleton }
)

export const NetSavingsTrendChart = nextDynamic(
  () => import("@/components/finance/charts").then((m) => m.NetSavingsTrendChart),
  { ssr: false, loading: ChartSkeleton }
)

export const MoneyFlowSankeyChart = nextDynamic(
  () => import("@/components/finance/charts").then((m) => m.MoneyFlowSankeyChart),
  { ssr: false, loading: ChartSkeleton }
)

export const RecentTransactions = nextDynamic(
  () => import("@/components/finance/transactions").then((m) => m.RecentTransactions),
  { ssr: false, loading: TransactionSkeleton }
)

export const AnnualWrappedBanner = nextDynamic(
  () => import("@/components/finance/annual-wrapped").then((m) => m.AnnualWrappedBanner),
  { ssr: false, loading: () => null }
)

export const FinancialAiInsights = nextDynamic(
  () => import("@/components/finance/ai-insights").then((m) => m.FinancialAiInsights ?? m.default),
  { ssr: false, loading: () => <div className="h-44 w-full rounded-2xl bg-secondary/40 animate-pulse" /> }
)

