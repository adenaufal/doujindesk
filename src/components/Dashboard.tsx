import {
  Banknote,
  Bell,
  LayoutGrid,
  Megaphone,
  ScanLine,
  Ticket,
  UserCheck,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { Async, Page, PageHeader, Section, StatTile } from '@/components/ops'
import { useRelativeTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  pick,
  queryKeys,
  useEvent,
  useEventCounters,
  useEventDashboard,
  useFinancialSummary,
  useNotifications,
  useRealtimeTable,
} from '@/lib/queries'
import { formatMoney } from '@/lib/money'
import { netTotal } from '@/lib/ledger'
import { useAuthStore } from '@/stores/authStore'

/**
 * The screen an organizer looks at most.
 *
 * Every number here comes from the server:
 *   - the four counts are `count: 'exact', head: true` queries (`useEventDashboard`)
 *   - revenue is `event_financial_summary`, the view that sums the ledger in
 *     Postgres — criterion 4 forbids reducing amounts in a component
 *   - the live attendance figure is the single `event_counters` row over
 *     realtime, NEVER the raw `ticket_scans` stream: at doors-open that stream
 *     is O(scans × clients) of traffic to every organizer phone on venue wifi.
 *
 * The online/offline + last-sync indicator that used to live here is rendered
 * once by the shell topbar.
 */
export default function Dashboard() {
  const { t, i18n } = useTranslation(['organizer', 'common', 'shell'])
  const { eventId } = useParams()
  const userId = useAuthStore((s) => s.user?.id)
  const relative = useRelativeTime()

  const event = useEvent(eventId)
  const stats = useEventDashboard(eventId)
  const counters = useEventCounters(eventId)
  const summary = useFinancialSummary(eventId)
  const notifications = useNotifications(eventId, userId)

  useRealtimeTable('event_counters', queryKeys.dashboard.counters(eventId ?? ''), { eventId })

  const currency = event.data?.currency ?? 'IDR'
  const money = (amount: number) => formatMoney(amount, currency, i18n.language)
  const number = (value: number) => value.toLocaleString(i18n.language)

  const recent = notifications.data.slice(0, 4)

  return (
    <Page>
      <PageHeader
        title={t('dashboard.title')}
        description={
          event.data
            ? t('dashboard.forEvent', { event: event.data.name })
            : t('common:status.loading')
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* The live number is the one an organizer walks the floor with, so it is
            the only tile wearing the accent. */}
        <StatTile
          accent
          icon={UserCheck}
          label={t('dashboard.checkedIn')}
          loading={counters.isLoading}
          value={number(counters.data?.admitted_count ?? 0)}
          hint={t('dashboard.checkedInHint')}
        />
        <StatTile
          icon={Users}
          label={t('dashboard.applications')}
          loading={stats.isLoading}
          value={number(stats.data?.circles.total ?? 0)}
          hint={t('dashboard.applicationsHint', { count: stats.data?.circles.pending ?? 0 })}
        />
        <StatTile
          icon={LayoutGrid}
          label={t('dashboard.boothsAllocated')}
          loading={stats.isLoading}
          value={`${number(stats.data?.booths.allocated ?? 0)} / ${number(stats.data?.booths.total ?? 0)}`}
          hint={t('dashboard.boothsHint', {
            count: Math.max(0, (stats.data?.booths.total ?? 0) - (stats.data?.booths.allocated ?? 0)),
          })}
        />
        <StatTile
          icon={Ticket}
          label={t('dashboard.ticketsSold')}
          loading={stats.isLoading}
          value={number(stats.data?.tickets.sold ?? 0)}
          hint={t('dashboard.ticketsHint', { count: stats.data?.tickets.available ?? 0 })}
        />
        <StatTile
          icon={Banknote}
          label={t('dashboard.revenue')}
          loading={summary.isLoading}
          value={money(netTotal(summary.data, currency))}
          hint={t('dashboard.revenueHint')}
        />
      </div>

      {(stats.error || summary.error) && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {t('common:error.network')}{' '}
          <Button
            variant="link"
            className="h-auto p-0 align-baseline"
            onClick={() => {
              stats.refetch()
              summary.refetch()
            }}
          >
            {t('common:action.retry')}
          </Button>
        </p>
      )}

      <Section title={t('dashboard.quickActions')}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            to={`/e/${eventId}/circles`}
            icon={Users}
            title={t('dashboard.action.review')}
            body={t('dashboard.action.reviewBody')}
          />
          <QuickAction
            to={`/e/${eventId}/booths`}
            icon={LayoutGrid}
            title={t('dashboard.action.allocate')}
            body={t('dashboard.action.allocateBody')}
          />
          <QuickAction
            to={`/e/${eventId}/announcements`}
            icon={Megaphone}
            title={t('dashboard.action.announce')}
            body={t('dashboard.action.announceBody')}
          />
          <QuickAction
            to={`/e/${eventId}/scan`}
            icon={ScanLine}
            title={t('dashboard.action.scan')}
            body={t('dashboard.action.scanBody')}
          />
        </ul>
      </Section>

      <Section
        title={t('dashboard.recent')}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/notifications">{t('common:action.viewAll')}</Link>
          </Button>
        }
      >
        <Async
          state={notifications}
          icon={Bell}
          emptyTitle={t('dashboard.recentEmpty')}
          emptyDescription={t('dashboard.recentEmptyBody')}
          skeleton={<div className="h-32 animate-pulse rounded-lg bg-muted" />}
        >
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {recent.map((item) => (
              <li key={item.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Bell className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-card-foreground text-pretty">
                    {pick(item.title, i18n.language)}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
                    {pick(item.body, i18n.language)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <time className="text-xs text-muted-foreground" dateTime={item.created_at}>
                    {relative(item.created_at)}
                  </time>
                  {!item.read_at && <Badge variant="info">{t('notify.unread')}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Async>
      </Section>
    </Page>
  )
}

function QuickAction({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: string
  icon: typeof Users
  title: string
  body: string
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex h-full items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-card-foreground">{title}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground text-pretty">{body}</span>
        </span>
      </Link>
    </li>
  )
}
