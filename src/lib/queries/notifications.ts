import type { NotificationRow } from '../database.types'
import { supabase, useList, useWrite } from './core'
import { queryKeys } from './keys'

/**
 * The signed-in user's inbox for this event. RLS restricts it to the recipient;
 * the `.eq('user_id')` here is so the cache key and the rows agree, not security.
 *
 * Realtime surface — subscribe filtered to `user_id`, not to the whole table.
 */
export function useNotifications(eventId: string | undefined, userId: string | undefined) {
  return useList<NotificationRow>(
    queryKeys.notifications.mine(eventId ?? '', userId ?? ''),
    () =>
      supabase
        .from('notifications')
        .select('*')
        .eq('event_id', eventId!)
        .eq('user_id', userId!)
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
    { enabled: Boolean(eventId && userId) },
  )
}

/** The recipient may set `read_at` / `archived_at` and nothing else — 005's policy. */
export function useMarkNotification(eventId: string, userId: string) {
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
    () => [queryKeys.notifications.mine(eventId, userId)],
  )
}
