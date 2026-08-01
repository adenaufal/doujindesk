import type { ApplicationStatus, CircleCatalogRow, CircleRow } from '../database.types'
import { STALE, supabase, useItem, useList, useWrite } from './core'
import { queryKeys } from './keys'

export interface CircleFilters {
  status?: ApplicationStatus | ApplicationStatus[]
  /** Matches circle name or pen name, case-insensitive. */
  search?: string
}

/**
 * The review queue. Organizer-scoped: RLS returns a circle owner only their own
 * rows from the same call, so there is no separate "my application" query — see
 * `useMyCircle` for the convenience wrapper.
 */
export function useCircles(eventId: string | undefined, filters: CircleFilters = {}) {
  return useList<CircleRow>(
    queryKeys.circles.list(eventId ?? '', filters),
    () => {
      let q = supabase.from('circles').select('*').eq('event_id', eventId!)
      if (filters.status) {
        q = Array.isArray(filters.status)
          ? q.in('application_status', filters.status)
          : q.eq('application_status', filters.status)
      }
      if (filters.search) {
        const term = `%${filters.search}%`
        q = q.or(`circle_name.ilike.${term},pen_name.ilike.${term}`)
      }
      return q.order('created_at', { ascending: false })
    },
    { enabled: Boolean(eventId) },
  )
}

export function useCircle(circleId: string | undefined) {
  return useItem<CircleRow>(
    queryKeys.circles.one(circleId ?? ''),
    () => supabase.from('circles').select('*').eq('id', circleId!).single(),
    { enabled: Boolean(circleId) },
  )
}

/** The signed-in circle owner's application for this event, or null. */
export function useMyCircle(eventId: string | undefined, userId: string | undefined) {
  return useItem<CircleRow>(
    queryKeys.circles.mine(eventId ?? '', userId ?? ''),
    () =>
      supabase
        .from('circles')
        .select('*')
        .eq('event_id', eventId!)
        .eq('user_id', userId!)
        .maybeSingle(),
    { enabled: Boolean(eventId && userId) },
  )
}

/**
 * The PUBLIC catalog. Reads the `circle_catalog` view, never `circles` — the
 * view's column list is the access control, and `circles` carries email, phone,
 * address and emergency contacts. Do not "optimise" this to the base table.
 */
export function useCircleCatalog(eventId: string | undefined, filters: CircleFilters = {}) {
  return useList<CircleCatalogRow>(
    queryKeys.circles.catalog(eventId ?? '', filters),
    () => {
      let q = supabase.from('circle_catalog').select('*').eq('event_id', eventId!)
      if (filters.search) {
        const term = `%${filters.search}%`
        q = q.or(
          `circle_name.ilike.${term},circle_name_furigana.ilike.${term},pen_name.ilike.${term}`,
        )
      }
      // Kana-folded sort key, maintained by trigger: Postgres orders kanji by
      // code point, which is not 五十音.
      return q.order('circle_name_sort_key', { ascending: true })
    },
    { enabled: Boolean(eventId), staleTime: STALE.catalog },
  )
}

/**
 * Accept / reject / waitlist. `'accepted'` — never `'approved'`, which the CHECK
 * constraint rejects. The trigger stamps `reviewed_at` / `reviewed_by`; do not
 * send them from here.
 */
export function useUpdateCircleStatus(eventId: string) {
  return useWrite(
    async (args: {
      circleId: string
      status: ApplicationStatus
      reviewNotes?: string
      waitlistPosition?: number | null
    }) => {
      const { data, error } = await supabase
        .from('circles')
        .update({
          application_status: args.status,
          review_notes: args.reviewNotes,
          waitlist_position: args.waitlistPosition ?? null,
        })
        .eq('id', args.circleId)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as CircleRow
    },
    (args) => [
      queryKeys.circles.list(eventId),
      queryKeys.circles.one(args.circleId),
      queryKeys.circles.catalog(eventId),
    ],
  )
}

/** Draft save and submit. `total_amount` is recomputed server-side; sending it is pointless. */
export function useSaveCircle(eventId: string) {
  return useWrite(
    async (values: Partial<CircleRow> & { id?: string }) => {
      const payload = { ...values, event_id: eventId }
      const query = values.id
        ? supabase.from('circles').update(payload).eq('id', values.id)
        : supabase.from('circles').insert(payload)
      const { data, error } = await query.select().single()
      if (error) throw new Error(error.message)
      return data as CircleRow
    },
    (values) => [
      queryKeys.circles.list(eventId),
      ...(values.id ? [queryKeys.circles.one(values.id)] : []),
    ],
  )
}
