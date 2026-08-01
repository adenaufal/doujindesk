import { useMemo, useState } from 'react'
import { CalendarDays, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { useSchedule } from '@/lib/queries'
import type { EventScheduleRow, LocalisedText } from '@/lib/database.types'

/**
 * The programme: `event_schedule` (migration 005), grouped by day and then track.
 *
 * `title` and `description` are jsonb keyed {en,ja,id}, not text — the row is
 * written once and rendered in the reader's language, so `pick()` is the only
 * place a locale touches this screen.
 */

const pick = (text: LocalisedText | null, locale: string): string =>
  (text?.[locale.split('-')[0] as keyof LocalisedText] ?? text?.en ?? '') as string

const dayKey = (iso: string) => new Date(iso).toDateString()

export default function EventSchedule() {
  const { eventId } = useParams()
  const { t, i18n } = useTranslation(['catalog', 'common'])
  const { data, isLoading, error, isEmpty, refetch } = useSchedule(eventId)
  const [day, setDay] = useState<string | null>(null)

  const days = useMemo(() => {
    const map = new Map<string, EventScheduleRow[]>()
    for (const row of data) {
      const key = dayKey(row.starts_at)
      map.set(key, [...(map.get(key) ?? []), row])
    }
    return [...map.entries()].sort(
      (a, b) => new Date(a[1][0].starts_at).getTime() - new Date(b[1][0].starts_at).getTime(),
    )
  }, [data])

  const activeDay = day && days.some(([key]) => key === day) ? day : (days[0]?.[0] ?? null)

  const tracks = useMemo(() => {
    const rows = days.find(([key]) => key === activeDay)?.[1] ?? []
    const map = new Map<string, EventScheduleRow[]>()
    for (const row of rows) {
      const key = row.track ?? ''
      map.set(key, [...(map.get(key) ?? []), row])
    }
    return [...map.entries()]
  }, [days, activeDay])

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })
  const timeFormat = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t('schedule.title')}
        </h1>
      </header>

      {isLoading && (
        <div className="mt-6 space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <EmptyState
          icon={CalendarDays}
          title={t('common:error.network')}
          description={error.message}
          action={
            <Button variant="outline" onClick={refetch}>
              {t('common:action.retry')}
            </Button>
          }
        />
      )}

      {!isLoading && !error && isEmpty && (
        <EmptyState
          icon={CalendarDays}
          title={t('common:empty.noData.title')}
          description={t('schedule.noEvents')}
        />
      )}

      {days.length > 1 && (
        <div
          className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1"
          role="tablist"
          aria-label={t('schedule.title')}
        >
          {days.map(([key, items]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === activeDay}
              onClick={() => setDay(key)}
              className={
                key === activeDay
                  ? 'shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground coarse:min-h-11'
                  : 'shrink-0 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11'
              }
            >
              {dateFormat.format(new Date(items[0].starts_at))}
            </button>
          ))}
        </div>
      )}

      {tracks.map(([track, items]) => (
        <section key={track || 'untracked'} className="mt-8">
          {track && (
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {track}
            </h2>
          )}
          <ol className="mt-3 space-y-3">
            {items.map((row) => (
              <li
                key={row.id}
                className="flex gap-4 rounded-lg border border-border bg-card p-4 sm:gap-6"
              >
                <div className="w-16 shrink-0 text-sm tabular-nums text-muted-foreground sm:w-20">
                  <div className="font-medium text-card-foreground">
                    {timeFormat.format(new Date(row.starts_at))}
                  </div>
                  {row.ends_at && <div>{timeFormat.format(new Date(row.ends_at))}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-card-foreground text-pretty">
                    {pick(row.title, i18n.language)}
                  </h3>
                  {pick(row.description, i18n.language) && (
                    <p className="mt-1 text-sm text-muted-foreground text-pretty">
                      {pick(row.description, i18n.language)}
                    </p>
                  )}
                  {row.location && (
                    <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {row.location}
                    </p>
                  )}
                </div>
                {row.location?.toLowerCase().includes('stage') && (
                  <Badge variant="secondary" className="self-start">
                    {t('schedule.stage')}
                  </Badge>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
