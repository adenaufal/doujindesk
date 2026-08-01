import type { TicketPassRow, TicketPurchaseRow } from '../database.types'
import { supabase, useList, useWrite } from './core'
import { queryKeys } from './keys'

/** The wallet: this user's orders for this event. */
export function useMyPurchases(eventId: string | undefined, userId: string | undefined) {
  return useList<TicketPurchaseRow>(
    queryKeys.purchases.mine(eventId ?? '', userId ?? ''),
    () =>
      supabase
        .from('ticket_purchases')
        .select('*')
        .eq('event_id', eventId!)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false }),
    { enabled: Boolean(eventId && userId) },
  )
}

/**
 * One QR per admitted head. An order for five renders five passes — that is why
 * `ticket_passes` exists, and why the wallet must not render one code per order.
 */
export function usePasses(purchaseId: string | undefined) {
  return useList<TicketPassRow>(
    queryKeys.purchases.passes(purchaseId ?? ''),
    () =>
      supabase
        .from('ticket_passes')
        .select('*')
        .eq('purchase_id', purchaseId!)
        .order('created_at', { ascending: true }),
    { enabled: Boolean(purchaseId) },
  )
}

export interface PurchaseResult {
  order_id: string
  order_reference: string | null
  quantity: number
  unit_price: number
  total_amount: number
  currency: string
  passes: { id: string; qr_token: string; holder_name: string | null }[]
}

/**
 * The ONLY write path into `ticket_purchases` — `authenticated` has no INSERT
 * grant. The RPC reads the price out of `tickets` server-side and does its
 * oversell guard in one UPDATE … RETURNING, so a client-sent price is ignored
 * and two buyers for the last seat serialise on the row lock.
 */
export function usePurchaseTickets(eventId: string, userId: string | undefined) {
  return useWrite(
    async (args: { ticketId: string; quantity: number; holderNames?: string[] }) => {
      const { data, error } = await supabase.rpc('purchase_tickets', {
        p_ticket_id: args.ticketId,
        p_quantity: args.quantity,
        p_holder_names: args.holderNames ?? null,
      })
      if (error) throw new Error(error.message)
      return data as unknown as PurchaseResult
    },
    () => [
      queryKeys.tickets.list(eventId),
      queryKeys.purchases.mine(eventId, userId ?? ''),
      queryKeys.transactions.summary(eventId),
    ],
  )
}
