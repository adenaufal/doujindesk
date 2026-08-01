import type { FinancialTransactionRow } from '../database.types'
import { EVENT_ID, USER, iso, uid } from './ids'

/**
 * The ledger. Append-only in Postgres (a BEFORE UPDATE OR DELETE trigger raises),
 * written only by trigger — so nothing here is ever edited in place and a refund
 * is a reversing `debit` carrying `reverses_transaction_id`, never an edit.
 *
 * `event_financial_summary` is derived from these rows at read time by the demo
 * client, exactly as the SQL view derives it. Never total these in a component.
 */
type Seed = [
  n: number,
  type: FinancialTransactionRow['transaction_type'],
  direction: FinancialTransactionRow['direction'],
  amount: number,
  status: FinancialTransactionRow['status'],
  days: number,
  description: string,
  method: string,
]

const seeds: Seed[] = [
  [1, 'circle_payment', 'credit', 675_000, 'completed', -10, 'Kopi Susu Studio — space 2 + table', 'bank_transfer'],
  [2, 'circle_payment', 'credit', 450_000, 'completed', -10, '猫町堂 — space 1', 'bank_transfer'],
  [3, 'circle_payment', 'credit', 450_000, 'completed', -9, 'Hujan Tinta — space 1', 'e_wallet'],
  [4, 'circle_payment', 'credit', 2_500_000, 'completed', -14, 'Warung Doujin — booth A', 'bank_transfer'],
  [5, 'refund', 'debit', 2_500_000, 'completed', -12, 'Warung Doujin — application rejected', 'bank_transfer'],
  [6, 'ticket_sale', 'credit', 260_000_000, 'completed', -20, 'Early Bird Day 1 — 4,000 × Rp 65.000', 'gateway_batch'],
  [7, 'ticket_sale', 'credit', 950_400_000, 'completed', -5, 'Regular Day 1 — 8,640 × Rp 110.000', 'gateway_batch'],
  [8, 'ticket_sale', 'credit', 608_400_000, 'completed', -5, 'Two-Day Pass — 3,120 × Rp 195.000', 'gateway_batch'],
  [9, 'ticket_sale', 'credit', 163_800_000, 'completed', -3, 'Priority Entry — 468 × Rp 350.000', 'gateway_batch'],
  [10, 'ticket_sale', 'credit', 350_000, 'pending', -1, 'Order CF19-3JD90P — awaiting payment', 'va_bca'],
  [11, 'refund', 'debit', 110_000, 'completed', -4, 'Order CF19-QQ4471 — refunded on request', 'e_wallet'],
  [12, 'expense', 'debit', 185_000_000, 'completed', -6, 'Venue rental — ICE Hall 5-6, 2 days', 'bank_transfer'],
  [13, 'expense', 'debit', 42_500_000, 'completed', -6, 'Security and crowd control', 'bank_transfer'],
  [14, 'expense', 'debit', 28_000_000, 'completed', -8, 'Print: event guide, signage, wristbands', 'bank_transfer'],
  [15, 'commission', 'credit', 1_240_000, 'completed', -2, 'Commission — 猫町堂 online orders (10%)', 'e_wallet'],
]

export const financial_transactions: FinancialTransactionRow[] = seeds.map(
  ([n, transaction_type, direction, amount, status, days, description, payment_method]) => ({
    id: uid('5', 100 + n),
    event_id: EVENT_ID,
    transaction_type,
    direction,
    reference_id: null,
    reference_table: transaction_type === 'circle_payment' ? 'circles' : 'ticket_purchases',
    amount,
    currency: 'IDR' as const,
    payment_method,
    payment_gateway: payment_method === 'gateway_batch' ? 'midtrans' : null,
    gateway_transaction_id: null,
    idempotency_key: null,
    status,
    description,
    metadata: {},
    occurred_at: iso(days, 12),
    // The Warung Doujin refund reverses its circle payment; the ticket refund
    // reverses nothing on file (the original is inside a gateway batch row).
    reverses_transaction_id: n === 5 ? uid('5', 104) : null,
    created_by: USER.organizer,
    created_at: iso(days, 12),
    updated_at: iso(days, 12),
  }),
)
