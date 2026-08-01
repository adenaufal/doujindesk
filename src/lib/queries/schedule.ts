import type { EventScheduleRow } from '../database.types'
import { STALE, supabase, useList } from './core'
import { queryKeys } from './keys'

/** Fixed before doors open, so it caches for an hour. `title` is jsonb — use `pick()`. */
export function useSchedule(eventId: string | undefined) {
  return useList<EventScheduleRow>(
    queryKeys.schedule.list(eventId ?? ''),
    () =>
      supabase
        .from('event_schedule')
        .select('*')
        .eq('event_id', eventId!)
        .order('starts_at', { ascending: true }),
    { enabled: Boolean(eventId), staleTime: STALE.reference },
  )
}
