import type { BoothRow } from '../database.types'
import { supabase, useList, useWrite } from './core'
import { queryKeys } from './keys'

/** SQLSTATE for an EXCLUDE violation — `booths_no_overlap` refusing a placement. */
export const BOOTH_OVERLAP = '23P01'
/** SQLSTATE for a unique violation — `one_booth_per_circle`, or a duplicate number. */
export const BOOTH_DUPLICATE = '23505'

export function useBooths(eventId: string | undefined) {
  return useList<BoothRow>(
    queryKeys.booths.list(eventId ?? ''),
    () =>
      supabase
        .from('booths')
        .select('*')
        .eq('event_id', eventId!)
        .order('booth_number', { ascending: true }),
    { enabled: Boolean(eventId) },
  )
}

/**
 * Move, resize or allocate a booth.
 *
 * Collision is arbitrated by the DATABASE: `booths_no_overlap` raises 23P01 and
 * `one_booth_per_circle` raises 23505. Catch them and show the message — a
 * client-side overlap check is advisory, and two organizers on two laptops both
 * pass it.
 */
export function useUpdateBooth(eventId: string) {
  return useWrite(
    async (args: { id: string; patch: Partial<BoothRow> }) => {
      const { data, error } = await supabase
        .from('booths')
        .update(args.patch)
        .eq('id', args.id)
        .select()
        .single()
      if (error) throw Object.assign(new Error(error.message), { code: error.code })
      return data as BoothRow
    },
    () => [queryKeys.booths.list(eventId), queryKeys.circles.catalog(eventId)],
  )
}

export function useCreateBooth(eventId: string) {
  return useWrite(
    async (values: Partial<BoothRow>) => {
      const { data, error } = await supabase
        .from('booths')
        .insert({ ...values, event_id: eventId })
        .select()
        .single()
      if (error) throw Object.assign(new Error(error.message), { code: error.code })
      return data as BoothRow
    },
    () => [queryKeys.booths.list(eventId)],
  )
}

export function useDeleteBooth(eventId: string) {
  return useWrite(
    async (id: string) => {
      const { error } = await supabase.from('booths').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return id
    },
    () => [queryKeys.booths.list(eventId)],
  )
}
