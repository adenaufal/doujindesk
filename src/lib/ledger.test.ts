import { describe, expect, it } from 'vitest'

import type { EventFinancialSummaryRow, FinancialTransactionRow } from './database.types'
import {
  cumulativeSeries,
  currenciesIn,
  netTotal,
  summariseByType,
  toLedgerCsv,
  withinPeriod,
} from './ledger'

/**
 * Criterion 4's client-side half. The database owns the arithmetic; these nine
 * assertions pin the two things the browser can still get wrong — folding the
 * view's groups, and exporting rows an accountant reconciles against.
 */

const summary = (over: Partial<EventFinancialSummaryRow>): EventFinancialSummaryRow => ({
  event_id: 'e1',
  currency: 'IDR',
  transaction_type: 'ticket_sale',
  direction: 'credit',
  transaction_count: 1,
  total_amount: 0,
  net_amount: 0,
  pending_amount: 0,
  last_transaction_at: null,
  ...over,
})

const ledger = (over: Partial<FinancialTransactionRow>): FinancialTransactionRow => ({
  id: 'x',
  event_id: 'e1',
  transaction_type: 'ticket_sale',
  direction: 'credit',
  reference_id: null,
  reference_table: null,
  amount: 0,
  currency: 'IDR',
  payment_method: null,
  payment_gateway: null,
  gateway_transaction_id: null,
  idempotency_key: null,
  status: 'completed',
  description: null,
  metadata: {},
  occurred_at: '2026-01-01T00:00:00.000Z',
  reverses_transaction_id: null,
  created_by: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('summariseByType', () => {
  it('folds credit and debit groups of one type into a signed net', () => {
    const totals = summariseByType(
      [
        summary({ transaction_type: 'circle_payment', net_amount: 4_075_000, transaction_count: 4 }),
        summary({
          transaction_type: 'circle_payment',
          direction: 'debit',
          net_amount: -2_500_000,
          transaction_count: 1,
        }),
      ],
      'IDR',
    )

    expect(totals.circle_payment?.net).toBe(1_575_000)
    expect(totals.circle_payment?.count).toBe(5)
  })

  it('never mixes currencies', () => {
    const rows = [
      summary({ net_amount: 1_000_000 }),
      summary({ currency: 'USD', net_amount: 500 }),
    ]

    expect(summariseByType(rows, 'IDR').ticket_sale?.net).toBe(1_000_000)
    expect(summariseByType(rows, 'USD').ticket_sale?.net).toBe(500)
    expect(currenciesIn(rows)).toEqual(['IDR', 'USD'])
  })

  it('keeps pending money out of net and reports the latest timestamp', () => {
    const totals = summariseByType(
      [
        summary({ net_amount: 900, pending_amount: 350, last_transaction_at: '2026-05-01T00:00:00Z' }),
        summary({ net_amount: 100, last_transaction_at: '2026-06-01T00:00:00Z' }),
      ],
      'IDR',
    )

    expect(totals.ticket_sale?.net).toBe(1_000)
    expect(totals.ticket_sale?.pending).toBe(350)
    expect(totals.ticket_sale?.lastAt).toBe('2026-06-01T00:00:00Z')
  })

  it('nets every group of one currency for the bottom line', () => {
    const rows = [
      summary({ transaction_type: 'ticket_sale', net_amount: 1_000_000 }),
      summary({ transaction_type: 'expense', direction: 'debit', net_amount: -250_000 }),
      summary({ currency: 'USD', net_amount: 999 }),
    ]

    expect(netTotal(rows, 'IDR')).toBe(750_000)
  })
})

describe('cumulativeSeries', () => {
  // Buckets are LOCAL days — an organizer reading a chart at the venue means the
  // day their own clock shows. Building the fixtures from local-time Date parts
  // keeps these assertions true in every TZ the suite runs in.
  const at = (day: number, hour: number) => new Date(2026, 2, day, hour).toISOString()

  it('accumulates per day, oldest first, ignoring other types and pending rows', () => {
    const series = cumulativeSeries(
      [
        ledger({ occurred_at: at(2, 9), amount: 30 }),
        ledger({ occurred_at: at(1, 9), amount: 10 }),
        ledger({ occurred_at: at(1, 18), amount: 5 }),
        ledger({ occurred_at: at(3, 9), amount: 99, status: 'pending' }),
        ledger({ occurred_at: at(3, 9), amount: 99, transaction_type: 'expense' }),
      ],
      'ticket_sale',
      'IDR',
    )

    expect(series.map((p) => p.v)).toEqual([15, 45])
  })

  it('subtracts debits so a refund bends the line down', () => {
    const series = cumulativeSeries(
      [
        ledger({ occurred_at: at(1, 9), amount: 100 }),
        ledger({ occurred_at: at(2, 9), amount: 40, direction: 'debit' }),
      ],
      'ticket_sale',
      'IDR',
    )

    expect(series.map((p) => p.v)).toEqual([100, 60])
  })
})

describe('withinPeriod', () => {
  const now = Date.parse('2026-06-30T12:00:00.000Z')

  it('bounds 7d and 30d and lets everything through on all', () => {
    expect(withinPeriod('2026-06-28T12:00:00.000Z', '7d', now)).toBe(true)
    expect(withinPeriod('2026-06-10T12:00:00.000Z', '7d', now)).toBe(false)
    expect(withinPeriod('2026-06-10T12:00:00.000Z', '30d', now)).toBe(true)
    expect(withinPeriod('2020-01-01T00:00:00.000Z', 'all', now)).toBe(true)
  })
})

describe('toLedgerCsv', () => {
  it('exports raw database values and quotes anything with a comma or quote', () => {
    const csv = toLedgerCsv([
      ledger({
        id: 't1',
        amount: 675000,
        description: '猫町堂, space 1 — 2 tables',
        payment_method: 'bank_transfer',
      }),
      ledger({ id: 't2', amount: 110000, description: 'said "refund me"' }),
    ])
    const lines = csv.split('\r\n')

    expect(lines[0]).toBe(
      'occurred_at,transaction_type,direction,amount,currency,status,payment_method,description,reference_id,reverses_transaction_id,id',
    )
    // Unformatted: no thousands separator, no currency symbol, no rounding.
    expect(lines[1]).toContain(',675000,IDR,')
    expect(lines[1]).toContain('"猫町堂, space 1 — 2 tables"')
    expect(lines[2]).toContain('"said ""refund me"""')
    expect(lines).toHaveLength(3)
  })
})
