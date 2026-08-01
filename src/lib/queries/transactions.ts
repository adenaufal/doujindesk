import type { EventFinancialSummaryRow, FinancialTransactionRow } from '../database.types'
import { supabase, useList } from './core'
import { queryKeys } from './keys'

/**
 * Criterion 4 lives here. `event_financial_summary` is a `security_invoker` view
 * that groups the ledger by (currency, type, direction) with `net_amount` already
 * signed — so a dashboard reads totals, it never reduces rows in a component.
 *
 * No realtime and no auto-refetch: numbers moving under an organizer who is
 * reconciling is actively harmful. Give them an explicit refresh button wired to
 * `refetch`.
 */
export function useFinancialSummary(eventId: string | undefined) {
  return useList<EventFinancialSummaryRow>(
    queryKeys.transactions.summary(eventId ?? ''),
    () => supabase.from('event_financial_summary').select('*').eq('event_id', eventId!),
    { enabled: Boolean(eventId), staleTime: Infinity },
  )
}

/**
 * The ledger itself, for the transaction table and CSV export. Append-only: there
 * is no update hook and there will not be one — a correction is a reversing row
 * carrying `reverses_transaction_id`, written by the same trigger that wrote the
 * original.
 */
export function useTransactions(eventId: string | undefined, limit = 200) {
  return useList<FinancialTransactionRow>(
    queryKeys.transactions.list(eventId ?? ''),
    () =>
      supabase
        .from('financial_transactions')
        .select('*')
        .eq('event_id', eventId!)
        .order('occurred_at', { ascending: false })
        .limit(limit),
    { enabled: Boolean(eventId), staleTime: Infinity },
  )
}
