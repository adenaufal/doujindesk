import type { QueueRow } from '../database.types'
import { supabase, useList, useWrite } from './core'
import { queryKeys } from './keys'

/**
 * Live queue lengths. Pair with `useRealtimeTable('queues', eventId, key)` — this
 * is one of the six surfaces where realtime earns its keep, because an attendee
 * deciding whether to join a 40-minute line needs the number to be true now.
 */
export function useQueues(eventId: string | undefined) {
  return useList<QueueRow>(
    queryKeys.queues.list(eventId ?? ''),
    () =>
      supabase
        .from('queues')
        .select('*')
        .eq('event_id', eventId!)
        .order('name', { ascending: true }),
    { enabled: Boolean(eventId), staleTime: 10_000 },
  )
}

export function useUpdateQueue(eventId: string) {
  return useWrite(
    async (args: { id: string; patch: Partial<QueueRow> }) => {
      const { data, error } = await supabase
        .from('queues')
        .update(args.patch)
        .eq('id', args.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as QueueRow
    },
    () => [queryKeys.queues.list(eventId), queryKeys.dashboard.counters(eventId)],
  )
}
