import { useQuery } from '@tanstack/react-query'

import type { EventCounterRow } from '../database.types'
import { supabase, useItem } from './core'
import { queryKeys } from './keys'

/**
 * Attendance and queue totals — ONE row per event, maintained by trigger.
 *
 * Never subscribe the dashboard to `ticket_scans`. At doors-open that is
 * O(scans × clients) of realtime traffic to every organizer phone on venue wifi;
 * this counter is O(clients). `admitted_count` counts entries only, because
 * counting reentry would inflate the headcount every lunch break.
 */
export function useEventCounters(eventId: string | undefined) {
  return useItem<EventCounterRow>(
    queryKeys.dashboard.counters(eventId ?? ''),
    () => supabase.from('event_counters').select('*').eq('event_id', eventId!).maybeSingle(),
    { enabled: Boolean(eventId), staleTime: 10_000 },
  )
}

export interface DashboardStats {
  circles: { total: number; pending: number }
  booths: { total: number; allocated: number }
  staff: { total: number; active: number }
  tickets: { sold: number; available: number }
}

/**
 * The organizer dashboard's five headline counts, in one hook.
 *
 * Every count is `head: true, count: 'exact'` — PostgREST answers with a
 * `Content-Range` and no rows, so "1,842 circles" costs one header rather than
 * 1,842 rows the browser then calls `.length` on. That matters on venue wifi and
 * it is also the difference between a number that is true and a number that is
 * true about whatever happened to be in the page.
 *
 * Money is NOT here. Revenue comes from `useFinancialSummary`, which reads the
 * `event_financial_summary` view — criterion 4 admits no client-side arithmetic
 * over amounts. See `transactions.ts`.
 *
 * ponytail: ticket tiers come back as rows because PostgREST cannot SUM, and a
 * `tickets` table has a handful of rows per event (four in the demo). Upgrade
 * path if a promoter ever ships 500 tiers: an `event_ticket_summary` view next
 * to the financial one.
 */
export function useEventDashboard(eventId: string | undefined) {
  const query = useQuery<DashboardStats, Error>({
    queryKey: [...queryKeys.dashboard.counters(eventId ?? ''), 'stats'],
    enabled: Boolean(eventId),
    staleTime: 30_000,
    queryFn: async () => {
      const scoped = (table: 'circles' | 'booths' | 'staff') =>
        supabase.from(table).select('*', { count: 'exact', head: true }).eq('event_id', eventId!)

      const [circles, pending, booths, allocated, staff, active, tiers] = await Promise.all([
        scoped('circles'),
        scoped('circles').in('status', ['submitted', 'pending', 'under_review']),
        scoped('booths'),
        scoped('booths').not('circle_id', 'is', null),
        scoped('staff'),
        scoped('staff').eq('status', 'active'),
        supabase.from('tickets').select('quantity_sold, quantity_available').eq('event_id', eventId!),
      ])

      const failed = [circles, pending, booths, allocated, staff, active, tiers].find(
        (r) => r.error,
      )
      if (failed?.error) throw new Error(failed.error.message)

      const rows = (tiers.data ?? []) as { quantity_sold: number; quantity_available: number }[]

      return {
        circles: { total: circles.count ?? 0, pending: pending.count ?? 0 },
        booths: { total: booths.count ?? 0, allocated: allocated.count ?? 0 },
        staff: { total: staff.count ?? 0, active: active.count ?? 0 },
        tickets: {
          sold: rows.reduce((n, r) => n + Number(r.quantity_sold ?? 0), 0),
          available: rows.reduce((n, r) => n + Number(r.quantity_available ?? 0), 0),
        },
      }
    },
  })

  return {
    data: query.data ?? null,
    isLoading: query.isPending,
    error: query.error ?? null,
    refetch: () => void query.refetch(),
  }
}
