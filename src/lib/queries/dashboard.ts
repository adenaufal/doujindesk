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
