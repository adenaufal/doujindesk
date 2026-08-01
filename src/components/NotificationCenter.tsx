import { useState } from 'react'
import { Archive, Bell, Check, CheckCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { Async, Page, PageHeader } from '@/components/ops'
import { initials, useRelativeTime } from '@/lib/format'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  pick,
  queryKeys,
  useMarkNotification,
  useNotifications,
  useRealtimeTable,
} from '@/lib/queries'
import type { NotificationRow } from '@/lib/database.types'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

/**
 * The signed-in user's inbox, for every role.
 *
 * `/notifications` is not event-scoped, so this reads the whole inbox and RLS
 * limits it to `auth.uid()`. Marking read writes `read_at` and archiving writes
 * `archived_at` — the only two columns 005 grants a recipient, so there is no
 * delete button and no way to edit the text of a notification you received.
 *
 * The seven text-to-image placeholder avatars that used to be here are gone:
 * they pointed at a third-party IDE host baked into a component, which hangs
 * rather than fails fast on venue wifi, and which the criterion-1 grep never
 * catches because the URL says nothing about being fake. Initials rendered from
 * `ui/avatar` need no network at all.
 *
 * Foreground, in-app only. Web Push needs VAPID keys and a server route to hold
 * the private half — one line under Deferred in PROGRESS.md.
 */
export default function NotificationCenter() {
  const { t, i18n } = useTranslation(['organizer', 'common'])
  const { eventId } = useParams()
  const userId = useAuthStore((s) => s.user?.id)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const relative = useRelativeTime()

  const inbox = useNotifications(eventId, userId)
  const mark = useMarkNotification(eventId, userId ?? '')

  useRealtimeTable('notifications', queryKeys.notifications.mine(eventId ?? 'all', userId ?? ''), {
    filter: `user_id=eq.${userId}`,
    enabled: Boolean(userId),
  })

  const unread = inbox.data.filter((row) => !row.read_at)
  const rows = unreadOnly ? unread : inbox.data

  return (
    <Page className="max-w-3xl">
      <PageHeader
        title={t('notify.title')}
        description={t('notify.subtitle')}
        actions={
          <Button
            variant="outline"
            disabled={unread.length === 0 || mark.isPending}
            onClick={() => {
              for (const row of unread) mark.mutate({ id: row.id, read: true })
            }}
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            {t('notify.markAllRead')}
          </Button>
        }
      />

      <div
        role="group"
        aria-label={t('common:action.filter')}
        className="mt-6 inline-flex rounded-md border border-border p-0.5"
      >
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={unreadOnly === value}
            onClick={() => setUnreadOnly(value)}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors coarse:min-h-11',
              unreadOnly === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {value ? t('notify.unreadCount', { count: unread.length }) : t('notify.all')}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <Async
          state={{ ...inbox, isEmpty: !inbox.isLoading && !inbox.error && rows.length === 0 }}
          icon={Bell}
          emptyTitle={unreadOnly ? t('notify.emptyUnread') : t('notify.empty')}
          emptyDescription={unreadOnly ? t('notify.emptyUnreadBody') : t('notify.emptyBody')}
          emptyAction={
            unreadOnly ? (
              <Button variant="outline" onClick={() => setUnreadOnly(false)}>
                {t('common:action.clearFilters')}
              </Button>
            ) : undefined
          }
        >
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {rows.map((row) => (
              <NotificationItem
                key={row.id}
                row={row}
                locale={i18n.language}
                relative={relative}
                onRead={() => mark.mutate({ id: row.id, read: true })}
                onArchive={() => mark.mutate({ id: row.id, archived: true })}
              />
            ))}
          </ul>
        </Async>
      </div>
    </Page>
  )
}

function NotificationItem({
  row,
  locale,
  relative,
  onRead,
  onArchive,
}: {
  row: NotificationRow
  locale: string
  relative: (iso: string | null) => string
  onRead: () => void
  onArchive: () => void
}) {
  const { t } = useTranslation(['organizer', 'common'])
  const title = pick(row.title, locale)

  return (
    <li className={cn('flex items-start gap-3 p-4', row.read_at && 'opacity-70')}>
      <Avatar className="size-9 shrink-0">
        <AvatarFallback>{initials(title)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-card-foreground text-pretty">{title}</p>
          <Badge variant="outline">{t(`notify.category.${row.category}`)}</Badge>
          {!row.read_at && <Badge variant="info">{t('notify.unread')}</Badge>}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{pick(row.body, locale)}</p>
        <time className="mt-1 block text-xs text-muted-foreground" dateTime={row.created_at}>
          {relative(row.created_at)}
        </time>
      </div>

      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
        {!row.read_at && (
          <Button variant="ghost" size="icon" aria-label={t('notify.markRead')} onClick={onRead}>
            <Check className="size-4" aria-hidden="true" />
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label={t('notify.archive')} onClick={onArchive}>
          <Archive className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  )
}
