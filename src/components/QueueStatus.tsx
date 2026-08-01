import { AlertTriangle, Clock, ListChecks, Minus, Plus, UserCheck, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { Async, Page, PageHeader, Section, StatTile } from '@/components/ops'
import { useRelativeTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { queryKeys, useEventCounters, useQueues, useRealtimeTable, useUpdateQueue } from '@/lib/queries'
import type { QueueRow, QueueStatusCode } from '@/lib/database.types'

/**
 * Live queue lengths and the door counter, for whoever is making crowd decisions.
 *
 * Everything on this screen is a row: `queues` over realtime, and the single
 * `event_counters` row for the admitted total. The previous version was a
 * `useState([...])` with no setter and a `setInterval` that only advanced a
 * timestamp — it read as live to an operator and never changed a number. Alerts
 * are thresholds evaluated against those rows, not an array of pretend alerts.
 */
export default function QueueStatus() {
  const { t } = useTranslation(['organizer', 'common'])
  const { eventId } = useParams()
  const relative = useRelativeTime()

  const queues = useQueues(eventId)
  const counters = useEventCounters(eventId)
  const update = useUpdateQueue(eventId ?? '')

  useRealtimeTable('queues', queryKeys.queues.list(eventId ?? ''), { eventId })
  useRealtimeTable('event_counters', queryKeys.dashboard.counters(eventId ?? ''), { eventId })

  const alerts = queues.data.flatMap(alertsFor)

  return (
    <Page>
      <PageHeader
        title={t('queue.title')}
        description={t('queue.subtitle')}
        actions={
          counters.data ? (
            <p className="self-center text-xs text-muted-foreground">
              {t('queue.updated', { when: relative(counters.data.updated_at) })}
            </p>
          ) : null
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          accent
          icon={UserCheck}
          label={t('queue.insideVenue')}
          loading={counters.isLoading}
          value={(counters.data?.admitted_count ?? 0).toLocaleString()}
          hint={t('queue.insideVenueHint')}
        />
        <StatTile
          icon={Users}
          label={t('queue.waiting')}
          loading={counters.isLoading}
          value={(counters.data?.queue_total ?? 0).toLocaleString()}
          hint={t('queue.waitingHint')}
        />
        <StatTile
          icon={AlertTriangle}
          label={t('queue.alerts')}
          loading={queues.isLoading}
          value={alerts.length.toLocaleString()}
          hint={alerts.length === 0 ? t('queue.noAlerts') : t('queue.alertsHint')}
        />
      </div>

      {alerts.length > 0 && (
        <ul className="mt-4 space-y-2">
          {alerts.map((alert) => (
            <li
              key={`${alert.queue}-${alert.key}`}
              className="flex items-start gap-2 rounded-lg border border-border bg-warning-subtle p-3 text-sm text-warning"
              role="status"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="text-pretty">
                <strong className="font-semibold">{alert.queue}</strong> — {t(alert.key, alert.vars)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Section title={t('queue.lanes')}>
        <Async
          state={queues}
          icon={ListChecks}
          emptyTitle={t('queue.empty')}
          emptyDescription={t('queue.emptyBody')}
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {queues.data.map((queue) => (
              <QueueCard
                key={queue.id}
                queue={queue}
                onLength={(current_length) =>
                  update.mutate({ id: queue.id, patch: { current_length } })
                }
                onStatus={(status) => update.mutate({ id: queue.id, patch: { status } })}
              />
            ))}
          </ul>
        </Async>
      </Section>
    </Page>
  )
}

// ---------------------------------------------------------------------------

const STATUSES: QueueStatusCode[] = ['open', 'paused', 'closed']

const STATUS_VARIANT: Record<QueueStatusCode, 'success' | 'warning' | 'outline'> = {
  open: 'success',
  paused: 'warning',
  closed: 'outline',
}

/** Thresholds an operator would act on, evaluated against the row. */
function alertsFor(queue: QueueRow) {
  const out: { queue: string; key: string; vars?: Record<string, unknown> }[] = []
  const load = queue.capacity ? queue.current_length / queue.capacity : 0

  if (queue.status === 'open' && load >= 0.8) {
    out.push({ queue: queue.name, key: 'queue.alert.nearCapacity', vars: { percent: Math.round(load * 100) } })
  }
  if (queue.status === 'open' && queue.current_wait_minutes >= 30) {
    out.push({
      queue: queue.name,
      key: 'queue.alert.longWait',
      vars: { count: queue.current_wait_minutes },
    })
  }
  if (queue.status === 'paused' && queue.current_length > 0) {
    out.push({ queue: queue.name, key: 'queue.alert.pausedWithPeople', vars: { count: queue.current_length } })
  }
  return out
}

function QueueCard({
  queue,
  onLength,
  onStatus,
}: {
  queue: QueueRow
  onLength: (length: number) => void
  onStatus: (status: QueueStatusCode) => void
}) {
  const { t } = useTranslation(['organizer', 'common'])
  const load = queue.capacity ? Math.min(100, (queue.current_length / queue.capacity) * 100) : 0

  // ponytail: ±10 is a head-count estimate a marshal makes by eye, which is what
  // this column has always been — the authoritative admission number is the
  // scanner's. Upgrade path if a venue ever installs beam counters: a device that
  // writes `current_length` directly.
  const step = (delta: number) => onLength(Math.max(0, queue.current_length + delta))

  return (
    <li className="flex flex-col rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium text-card-foreground text-pretty">{queue.name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {queue.location ?? '—'} · {t(`queue.type.${queue.type}`)}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[queue.status]}>{t(`queue.status.${queue.status}`)}</Badge>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-card-foreground">
          {queue.current_length.toLocaleString()}
        </span>
        {queue.capacity ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            / {queue.capacity.toLocaleString()}
          </span>
        ) : null}
        <span className="flex-1" />
        <span className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
          <Clock className="size-3.5" aria-hidden="true" />
          {t('queue.waitMinutes', { count: queue.current_wait_minutes })}
        </span>
      </div>

      {queue.capacity ? (
        <Progress
          value={load}
          className="mt-2 h-2"
          aria-label={t('queue.capacityLabel', { name: queue.name })}
        />
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={t('queue.decrease', { name: queue.name })}
          onClick={() => step(-10)}
          disabled={queue.current_length === 0}
        >
          <Minus className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('queue.increase', { name: queue.name })}
          onClick={() => step(10)}
        >
          <Plus className="size-4" aria-hidden="true" />
        </Button>
        <span className="flex-1" />
        <Select value={queue.status} onValueChange={(value) => onStatus(value as QueueStatusCode)}>
          <SelectTrigger className="w-32 coarse:min-h-11" aria-label={t('queue.changeStatus')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`queue.status.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </li>
  )
}
