import type { EventRow } from '../database.types'
import { STALE, supabase, useItem, useList, useWrite } from './core'
import { queryKeys } from './keys'

/** Every event, newest first. The event switcher and the public home read this. */
export function useEvents() {
  return useList<EventRow>(
    queryKeys.events.all(),
    () => supabase.from('events').select('*').order('start_date', { ascending: false }),
    { staleTime: STALE.reference },
  )
}

/** One event. `:eventId` from the URL is the only source of scope — never a store. */
export function useEvent(eventId: string | undefined) {
  return useItem<EventRow>(
    queryKeys.events.one(eventId ?? ''),
    () => supabase.from('events').select('*').eq('id', eventId!).single(),
    { enabled: Boolean(eventId), staleTime: STALE.reference },
  )
}

export function useUpdateEvent(eventId: string) {
  return useWrite(
    async (patch: Partial<EventRow>) => {
      const { data, error } = await supabase
        .from('events')
        .update(patch)
        .eq('id', eventId)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as EventRow
    },
    () => [queryKeys.events.one(eventId), queryKeys.events.all()],
  )
}
