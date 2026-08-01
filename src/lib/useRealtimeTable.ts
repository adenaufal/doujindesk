import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect } from 'react'

import { supabase } from './supabase'

/**
 * Subscribe to `postgres_changes` on one table and invalidate one query key.
 *
 * One hook, reused, instead of per-screen subscription code. It deliberately does
 * not hand the payload to the caller: a screen that patches its own cache from a
 * realtime row and also refetches ends up with two sources of truth for the same
 * row, and they disagree the first time a policy filters something out.
 *
 * Where this earns its keep: QueueStatus (`queues`), NotificationCenter
 * (`notifications`, filtered to the user), Dashboard attendance
 * (`event_counters` — the single counter row, NEVER the raw `ticket_scans`
 * stream), the review queue (`circles`, concurrent organizers), BoothAllocation
 * (`booths`, concurrent editors) and the published announcement feed.
 *
 * Where it does not: the catalog (staleTime 5 min), schedule/map/guide (1 h) and
 * the financial dashboard, where numbers moving mid-reconciliation is harmful.
 *
 * ponytail: invalidate-only, so a burst of 40 inserts is 40 invalidations that
 * React Query coalesces into roughly one refetch. Upgrade path if a firehose ever
 * needs it: `setQueryData` for single-row UPDATEs on a known key.
 */
export function useRealtimeTable(
  table: string,
  queryKey: QueryKey,
  options: { eventId?: string; filter?: string; enabled?: boolean } = {},
) {
  const client = useQueryClient()
  const { eventId, filter, enabled = true } = options
  const scope = filter ?? (eventId ? `event_id=eq.${eventId}` : undefined)
  const key = JSON.stringify(queryKey)

  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel(`rt:${table}:${scope ?? 'all'}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js types this event name as a literal union it does not export
        'postgres_changes' as any,
        { event: '*', schema: 'public', table, ...(scope ? { filter: scope } : {}) },
        () => void client.invalidateQueries({ queryKey: JSON.parse(key) as QueryKey }),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [client, table, scope, key, enabled])
}

export default useRealtimeTable
