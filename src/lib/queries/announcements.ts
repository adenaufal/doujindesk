import type { AnnouncementRow, AnnouncementStatus, Locale, LocalisedText } from '../database.types'
import { supabase, useList, useWrite } from './core'
import { queryKeys } from './keys'

/**
 * `title` and `body` are jsonb keyed {en,ja,id}, not strings — the fan-out must
 * not freeze one language at write time. Render with `pick()`.
 */
export const pick = (text: LocalisedText | null | undefined, locale: string): string =>
  text?.[locale as Locale] ?? text?.en ?? ''

export function useAnnouncements(
  eventId: string | undefined,
  filters: { status?: AnnouncementStatus } = {},
) {
  return useList<AnnouncementRow>(
    queryKeys.announcements.list(eventId ?? '', filters),
    () => {
      let q = supabase.from('announcements').select('*').eq('event_id', eventId!)
      if (filters.status) q = q.eq('status', filters.status)
      return q.order('pinned', { ascending: false }).order('publish_at', { ascending: false })
    },
    { enabled: Boolean(eventId) },
  )
}

export function useSaveAnnouncement(eventId: string) {
  return useWrite(
    async (values: Partial<AnnouncementRow> & { id?: string }) => {
      const payload = { ...values, event_id: eventId }
      const query = values.id
        ? supabase.from('announcements').update(payload).eq('id', values.id)
        : supabase.from('announcements').insert(payload)
      const { data, error } = await query.select().single()
      if (error) throw new Error(error.message)
      return data as AnnouncementRow
    },
    () => [queryKeys.announcements.list(eventId)],
  )
}
