import type { NotificationRow } from '../database.types'
import { supabase, useList, useWrite } from './core'
import { queryKeys } from './keys'

/**
 * The signed-in user's inbox. RLS restricts it to the recipient; the
 * `.eq('user_id')` here is so the cache key and the rows agree, not security.
 *
 * `eventId` is optional: `/notifications` is not an event-scoped route, and an
 * inbox that hides everything from the event you are not currently looking at is
 * how a circle misses their acceptance mail. Pass an id to scope it.
 *
 * Realtime surface — subscribe filtered to `user_id`, not to the whole table.
 */
export function useNotifications(eventId: string | undefined, userId: string | undefined) {
  return useList<NotificationRow>(
    queryKeys.notifications.mine(eventId ?? 'all', userId ?? ''),
    () => {
      let q = supabase.from('notifications').select('*').eq('user_id', userId!)
      if (eventId) q = q.eq('event_id', eventId)
      return q.is('archived_at', null).order('created_at', { ascending: false })
    },
    { enabled: Boolean(userId) },
  )
}

/** The recipient may set `read_at` / `archived_at` and nothing else — 005's policy. */
export function useMarkNotification(eventId: string | undefined, userId: string) {
  return useWrite(
    async (args: { id: string; read?: boolean; archived?: boolean }) => {
      const now = new Date().toISOString()
      const patch: Partial<NotificationRow> = {}
      if (args.read !== undefined) patch.read_at = args.read ? now : null
      if (args.archived !== undefined) patch.archived_at = args.archived ? now : null
      const { error } = await supabase.from('notifications').update(patch).eq('id', args.id)
      if (error) throw new Error(error.message)
      return args.id
    },
    () => [queryKeys.notifications.mine(eventId ?? 'all', userId)],
  )
}
