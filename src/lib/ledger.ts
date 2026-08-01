import type {
  CurrencyCode,
  EventFinancialSummaryRow,
  FinancialTransactionRow,
  TransactionType,
} from './database.types'

/**
 * The pure half of the financial screen. No React, no Supabase — so the money
 * shaping can be tested without a DOM, the same way `scanContract.ts` is.
 *
 * CRITERION 4 BOUNDARY, read before adding anything here:
 *
 *   Every figure an organizer sees traces to a `financial_transactions` row.
 *   `event_financial_summary` already sums those rows in Postgres `numeric`,
 *   grouped by (currency, transaction_type, direction) with `net_amount` signed.
 *   What is left for the client is *folding groups*, not summing money: a
 *   headline "circle fees" is the credit group plus the debit group of one type,
 *   which is at most two numbers the database already computed.
 *
 *   Nothing here may compute a total out of raw ledger rows. `cumulativeSeries`
 *   walks raw rows on purpose — it draws a *shape over time*, which the view has
 *   no time dimension to give, and its endpoint is deliberately not printed as a
 *   total. If you need a new headline number, add it to the view in a migration.
 */

export interface TypeTotal {
  /** Signed: credits positive, debits negative. Straight from the view. */
  net: number
  /** How many ledger rows are behind this number. Shown so it is auditable. */
  count: number
  /** Money booked but not yet settled — never folded into `net`. */
  pending: number
  lastAt: string | null
}

const EMPTY: TypeTotal = { net: 0, count: 0, pending: 0, lastAt: null }

/**
 * Fold the view's (type, direction) rows into one entry per transaction type for
 * a single currency. Currencies are never added together — see `money.ts`.
 */
export function summariseByType(
  rows: readonly EventFinancialSummaryRow[],
  currency: CurrencyCode,
): Partial<Record<TransactionType, TypeTotal>> {
  const out: Partial<Record<TransactionType, TypeTotal>> = {}

  for (const row of rows) {
    if (row.currency !== currency) continue
    const prev = out[row.transaction_type] ?? EMPTY
    out[row.transaction_type] = {
      net: prev.net + Number(row.net_amount),
      count: prev.count + Number(row.transaction_count),
      pending: prev.pending + Number(row.pending_amount),
      lastAt: laterOf(prev.lastAt, row.last_transaction_at),
    }
  }

  return out
}

/** The bottom line: every group of one currency, added. */
export function netTotal(
  rows: readonly EventFinancialSummaryRow[],
  currency: CurrencyCode,
): number {
  let net = 0
  for (const row of rows) if (row.currency === currency) net += Number(row.net_amount)
  return net
}

/** Currencies present in the ledger, so a USD event never renders an IDR heading. */
export function currenciesIn(rows: readonly EventFinancialSummaryRow[]): CurrencyCode[] {
  return [...new Set(rows.map((r) => r.currency))]
}

function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

// ---------------------------------------------------------------------------
// Period filter — applies to the ledger table and the chart, never to the KPIs.
// ---------------------------------------------------------------------------

export const PERIODS = ['7d', '30d', 'all'] as const
export type Period = (typeof PERIODS)[number]

const PERIOD_DAYS: Record<Period, number | null> = { '7d': 7, '30d': 30, all: null }

export function withinPeriod(occurredAt: string, period: Period, now = Date.now()): boolean {
  const days = PERIOD_DAYS[period]
  if (days === null) return true
  return now - Date.parse(occurredAt) <= days * 86_400_000
}

// ---------------------------------------------------------------------------
// Chart data
// ---------------------------------------------------------------------------

export interface SeriesPoint {
  /** Epoch ms of the day bucket. */
  t: number
  /** Running total at the end of that day, signed. */
  v: number
}

/**
 * Cumulative signed amount per day for one transaction type, oldest first.
 *
 * Deliberately one type per call: circle fees and ticket sales differ by three
 * orders of magnitude, and putting them on one y-axis would draw circle fees as
 * a flat line on zero. Two charts, two scales, each labelled — never a dual axis.
 */
export function cumulativeSeries(
  rows: readonly FinancialTransactionRow[],
  type: TransactionType,
  currency: CurrencyCode,
): SeriesPoint[] {
  const byDay = new Map<number, number>()

  for (const row of rows) {
    if (row.transaction_type !== type || row.currency !== currency) continue
    if (row.status !== 'completed') continue
    const day = startOfDay(Date.parse(row.occurred_at))
    const signed = (row.direction === 'debit' ? -1 : 1) * Number(row.amount)
    byDay.set(day, (byDay.get(day) ?? 0) + signed)
  }

  let running = 0
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, delta]) => ({ t, v: (running += delta) }))
}

const startOfDay = (ms: number): number => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  'occurred_at',
  'transaction_type',
  'direction',
  'amount',
  'currency',
  'status',
  'payment_method',
  'description',
  'reference_id',
  'reverses_transaction_id',
  'id',
] as const

/**
 * RFC 4180 CSV of the ledger rows as fetched — no rounding, no reformatting, no
 * locale. An export an accountant reconciles against the database has to be the
 * database's own values; `formatMoney` is for screens.
 */
export function toLedgerCsv(rows: readonly FinancialTransactionRow[]): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((column) => csvCell(row[column])).join(','))
  }
  return lines.join('\r\n')
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * A UTF-8 BOM, because Excel on Windows reads a BOM-less CSV as the system
 * codepage and turns 猫町堂 into mojibake — which is most of this product's
 * circle names.
 */
const BOM = '﻿'

export function csvBlob(csv: string): Blob {
  return new Blob([BOM, csv], { type: 'text/csv;charset=utf-8' })
}
