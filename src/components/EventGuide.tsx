import { CalendarDays, FileText, Map as MapIcon, Ticket, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { useEvent } from '@/lib/queries'
import { useAuthStore } from '@/stores/authStore'

/**
 * `/e/:eventId` — the attendee landing page.
 *
 * This used to be the whole attendee app crammed into a seven-across `TabsList`
 * that could not render at 320px, backed by three local invented arrays that
 * duplicated the children it already rendered. The tabs were a workaround for
 * having no router; P8 gave the app one, so this is a light index that links to
 * the real routes and nothing else.
 */
export default function EventGuide() {
  const { eventId } = useParams()
  const { t, i18n } = useTranslation(['catalog', 'common', 'shell'])
  const role = useAuthStore((s) => s.role)
  const { data: event, isLoading, error, refetch } = useEvent(eventId)

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10" aria-busy="true">
        <div className="h-9 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <EmptyState
        className="py-20"
        icon={CalendarDays}
        title={error ? t('common:error.network') : t('common:error.notFound')}
        description={error?.message}
        action={
          <Button variant="outline" onClick={refetch}>
            {t('common:action.retry')}
          </Button>
        }
        secondaryAction={
          <Button asChild variant="ghost">
            <Link to="/">{t('common:app.name')}</Link>
          </Button>
        }
      />
    )
  }

  const dates = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const range =
    event.start_date === event.end_date
      ? dates.format(new Date(event.start_date))
      : `${dates.format(new Date(event.start_date))} – ${dates.format(new Date(event.end_date))}`

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          {event.status === 'ongoing' && (
            <Badge variant="info">{t('shell:home.events.ongoing')}</Badge>
          )}
          {event.status === 'registration_open' && (
            <Badge variant="success">{t('shell:home.events.registrationOpen')}</Badge>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground text-balance sm:text-3xl">
          {event.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">{t('guide.intro')}</p>

        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">{t('guide.dates')}</dt>
            <dd className="font-medium text-foreground tabular-nums">{range}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('guide.venue')}</dt>
            <dd className="font-medium text-foreground">{event.venue_name}</dd>
          </div>
        </dl>

        {event.description && (
          <p className="mt-4 max-w-prose text-sm text-muted-foreground text-pretty">
            {event.description}
          </p>
        )}
      </header>

      <nav className="mt-8 grid gap-3 sm:grid-cols-2">
        <GuideLink
          to={`/e/${event.id}/catalog`}
          icon={Users}
          title={t('common:nav.catalog')}
          body={t('guide.catalogBody')}
        />
        <GuideLink
          to={`/e/${event.id}/map`}
          icon={MapIcon}
          title={t('common:nav.map')}
          body={t('guide.mapBody')}
        />
        <GuideLink
          to={`/e/${event.id}/schedule`}
          icon={CalendarDays}
          title={t('common:nav.schedule')}
          body={t('guide.scheduleBody')}
        />
        <GuideLink
          to={`/e/${event.id}/tickets`}
          icon={Ticket}
          title={t('common:nav.tickets')}
          body={t('guide.ticketsBody')}
        />
        {role === 'attendee' && (
          <GuideLink
            to="/wallet"
            icon={Wallet}
            title={t('common:nav.myTickets')}
            body={t('guide.walletBody')}
          />
        )}
        {role === 'circle' && (
          <GuideLink
            to={`/e/${event.id}/apply`}
            icon={FileText}
            title={t('common:nav.myApplication')}
            body={t('guide.applyBody')}
          />
        )}
      </nav>
    </div>
  )
}

function GuideLink({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: string
  icon: LucideIcon
  title: string
  body: string
}) {
  return (
    <Link
      to={to}
      className="flex gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11"
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-card-foreground">{title}</span>
        <span className="block text-sm text-muted-foreground text-pretty">{body}</span>
      </span>
    </Link>
  )
}
