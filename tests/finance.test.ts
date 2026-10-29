import assert from "node:assert/strict"
import test from "node:test"
import { calculateSummary } from "../lib/finance-summary"
import { filterInvestments, filterLivingExpenses, isInvestmentTx } from "../lib/finance"
import { fmtCurrency, getFallbackFxRate } from "../lib/format"
import {
  validateTransactionDate,
  validateTransactionImport,
  validateTransactionInput,
} from "../lib/transaction-validation"

test("validates and normalizes a transaction", () => {
  assert.deepEqual(
    validateTransactionInput({
      name: "  Nómina  ",
      category: "  Sueldo  ",
      type: "income",
      amount: 1250.5,
    }),
    { name: "Nómina", category: "Sueldo", type: "income", amount: 1250.5 }
  )

  assert.deepEqual(
    validateTransactionInput({
      name: "Devolución",
      category: "Reembolso varios",
      type: "expense",
      amount: 32,
    }),
    { name: "Devolución", category: "Reembolso", type: "expense", amount: 32 }
  )
})

test("rejects blank names, unknown types and non-positive or non-finite amounts", () => {
  assert.throws(
    () => validateTransactionInput({ name: "  ", category: "General", type: "expense", amount: 1 }),
    /nombre es obligatorio/
  )
  assert.throws(
    () => validateTransactionInput({ name: "Compra", category: "Hogar", type: "transfer", amount: 1 }),
    /tipo de transacci[oó]n.*income.*expense/i
  )
  for (const amount of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => validateTransactionInput({ name: "Compra", category: "Hogar", type: "expense", amount }),
      /importe debe ser mayor que 0/
    )
  }
})

test("validates optional transaction dates and rejects invalid calendar days", () => {
  assert.equal(validateTransactionDate(undefined, new Date("2025-01-02T00:00:00Z")).toISOString(), "2025-01-02T00:00:00.000Z")
  assert.equal(validateTransactionDate("2024-02-29").toISOString(), "2024-02-29T00:00:00.000Z")
  for (const date of ["2025-02-29", "2024-13-01", "not-a-date", ""]) {
    assert.throws(() => validateTransactionDate(date), /fecha.*(obligatoria|válida)/i)
  }
})

test("reports invalid import rows while preserving valid transactions and source row numbers", () => {
  const result = validateTransactionImport([
    {
      rowNumber: 4,
      name: "Compra",
      category: "Hogar",
      type: "expense",
      amount: 25,
      occurredAt: "2025-02-28",
    },
    {
      rowNumber: 9,
      name: "Nómina",
      category: "Sueldo",
      type: "income",
      amount: 1200,
      occurredAt: "2025-02-30",
    },
  ])

  assert.equal(result.accepted.length, 1)
  assert.equal(result.accepted[0].row, 4)
  assert.equal(result.accepted[0].occurredAt.toISOString(), "2025-02-28T00:00:00.000Z")
  assert.deepEqual(result.rejected, [
    { row: 9, name: "Nómina", reason: "La fecha de la transacción no es válida" },
  ])
})

test("classifies investment transactions and separates living expenses", () => {
  const transactions = [
    { id: 1, name: "Compra supermercado", category: "Alimentación", type: "expense" as const, amount: 40, occurredAt: "2025-01-10" },
    { id: 2, name: "Aportación", category: "ETF", type: "expense" as const, amount: 100, occurredAt: "2025-01-11" },
    { id: 3, name: "Venta de acciones", category: "Otros", type: "income" as const, amount: 200, occurredAt: "2025-01-12" },
  ]

  assert.equal(isInvestmentTx(transactions[1]), true)
  assert.deepEqual(filterLivingExpenses(transactions).map((transaction) => transaction.id), [1])
  assert.deepEqual(filterInvestments(transactions).map((transaction) => transaction.id), [2, 3])
})

test("calculates yearly and monthly summaries while excluding investment transfers", () => {
  const summary = calculateSummary(
    [
      { name: "Nómina", category: "Sueldo", type: "income", amount: 2000, occurredAt: "2024-01-15T12:00:00Z" },
      { name: "Compra", category: "Hogar", type: "expense", amount: 400.25, occurredAt: "2024-01-20T12:00:00Z" },
      { name: "Aportación", category: "Broker", type: "expense", amount: 500, occurredAt: "2024-02-02T12:00:00Z" },
      { name: "Nómina", category: "Sueldo", type: "income", amount: 1000, occurredAt: "2025-02-01T12:00:00Z" },
    ],
    2024,
    undefined,
    2025
  )

  assert.equal(summary.selectedYear, 2024)
  assert.deepEqual(summary.availableYears, [2025, 2024])
  assert.equal(summary.income, 2000)
  assert.equal(summary.expenses, 400.25)
  assert.equal(summary.balance, 1599.75)
  assert.equal(summary.monthly.length, 12)
  assert.deepEqual(summary.monthly[0], {
    key: "2024-0",
    label: "Ene",
    net: 1599.75,
    income: 2000,
    expense: 400.25,
  })
  assert.equal(summary.monthly[1].expense, 0)
})

test("uses a valid saved year, otherwise chooses the newest available data year", () => {
  const transactions = [
    { name: "Ingreso antiguo", category: "Sueldo", type: "income" as const, amount: 100, occurredAt: "2023-06-01T12:00:00Z" },
    { name: "Ingreso reciente", category: "Sueldo", type: "income" as const, amount: 200, occurredAt: "2024-06-01T12:00:00Z" },
  ]

  assert.equal(calculateSummary(transactions, undefined, 2023, 2025).selectedYear, 2023)
  assert.equal(calculateSummary(transactions, undefined, undefined, 2025).selectedYear, 2024)
  assert.equal(calculateSummary([], undefined, undefined, 2025).monthly.length, 12)
})

test("formats currencies and converts between supported fallback rates", () => {
  assert.equal(fmtCurrency(1234.5, "€"), "1234,50 €")
  assert.equal(getFallbackFxRate("EUR", "USD"), 1.085)
  assert.equal(getFallbackFxRate("USD", "EUR"), 1 / 1.085)
  assert.equal(getFallbackFxRate("EUR", "EUR"), 1)
})
