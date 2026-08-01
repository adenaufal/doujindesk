import type { TicketRow } from '../database.types'
import { supabase, useList, useWrite } from './core'
import { queryKeys } from './keys'

/** Ticket tiers for an event, in the organizer's display order. */
export function useTickets(eventId: string | undefined) {
  return useList<TicketRow>(
    queryKeys.tickets.list(eventId ?? ''),
    () =>
      supabase
        .from('tickets')
        .select('*')
        .eq('event_id', eventId!)
        .order('sort_order', { ascending: true }),
    { enabled: Boolean(eventId) },
  )
}

/** Organizer-only; `tickets_write_organizer` is what actually enforces it. */
export function useSaveTicket(eventId: string) {
  return useWrite(
    async (values: Partial<TicketRow> & { id?: string }) => {
      const payload = { ...values, event_id: eventId }
      const query = values.id
        ? supabase.from('tickets').update(payload).eq('id', values.id)
        : supabase.from('tickets').insert(payload)
      const { data, error } = await query.select().single()
      if (error) throw new Error(error.message)
      return data as TicketRow
    },
    () => [queryKeys.tickets.list(eventId)],
  )
}
