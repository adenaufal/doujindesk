import { CalendarDays, ClipboardCheck, LayoutGrid, ScanLine, Ticket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { formatEventDates, splitEvents, useEvents } from '@/components/layout/useEvents'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuthStore } from '@/stores/authStore'
import type { EventSummary } from '@/components/layout/useEvents'

/**
 * The public landing page, and the event chooser.
 *
 * Every organizer, circle and staff screen is `/e/:eventId/…`, so "redirect by
 * role" cannot happen without first knowing which event — this page is where
 * that choice is made, for signed-in and signed-out visitors alike.
 *
 * The copy names the job. The old page claimed thousands of users the product
 * does not have, and put a social-proof headline over four figures that were
 * capacity ceilings rather than traction — both false claims, not styling
 * problems. The seven-pastel-chip feature grid went with them.
 */
export default function Home() {
  const { t, i18n } = useTranslation(['shell', 'common'])
  const session = useAuthStore((s) => s.session)
  const { events, loading, error, reload } = useEvents()
  const { upcoming, past } = splitEvents(events)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-16">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl">
          {t('home.hero.title')}
        </h1>
        <p className="mt-4 text-base text-muted-foreground text-pretty sm:text-lg">
          {t('home.hero.body')}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg">
            <a href="#events">
              <CalendarDays aria-hidden="true" />
              {t('home.hero.browse')}
            </a>
          </Button>
          {!session && (
            <Button asChild size="lg" variant="outline">
              <Link to="/login">{t('common:action.signIn')}</Link>
            </Button>
          )}
        </div>
      </section>

      <section id="events" className="mt-14 scroll-mt-20">
        <h2 className="text-lg font-semibold text-foreground">{t('home.events.title')}</h2>

        {loading && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
          </div>
        )}

        {!loading && error && (
          <EmptyState
            className="items-start text-left"
            icon={CalendarDays}
            title={t('common:error.network')}
            description={error}
            action={
              <Button variant="outline" onClick={() => void reload()}>
                {t('common:action.retry')}
              </Button>
            }
          />
        )}

        {!loading && !error && events.length === 0 && (
          <EmptyState
            className="items-start text-left"
            icon={CalendarDays}
            title={t('home.events.emptyTitle')}
            description={t('home.events.emptyBody')}
          />
        )}

        {!loading && !error && upcoming.length > 0 && (
          <EventGrid events={upcoming} locale={i18n.language} />
        )}

        {!loading && !error && past.length > 0 && (
          <>
            <h3 className="mt-8 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {t('common:event.past')}
            </h3>
            <EventGrid events={past} locale={i18n.language} />
          </>
        )}
      </section>

      <section className="mt-16">
        <h2 className="text-lg font-semibold text-foreground">{t('home.flow.title')}</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Step icon={ClipboardCheck} title={t('home.flow.apply')} body={t('home.flow.applyBody')} />
          <Step icon={LayoutGrid} title={t('home.flow.allocate')} body={t('home.flow.allocateBody')} />
          <Step icon={Ticket} title={t('home.flow.sell')} body={t('home.flow.sellBody')} />
          <Step icon={ScanLine} title={t('home.flow.scan')} body={t('home.flow.scanBody')} />
        </ol>
      </section>
    </div>
  )
}

function EventGrid({ events, locale }: { events: EventSummary[]; locale: string }) {
  const { t } = useTranslation(['shell', 'common'])

  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            to={`/e/${event.id}`}
            className="flex h-full flex-col gap-1 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="font-medium text-card-foreground text-pretty">{event.name}</span>
              {event.status === 'registration_open' && (
                <Badge variant="success">{t('home.events.registrationOpen')}</Badge>
              )}
              {event.status === 'ongoing' && (
                <Badge variant="info">{t('home.events.ongoing')}</Badge>
              )}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatEventDates(event, locale)}
            </span>
            {event.venue_name && (
              <span className="text-sm text-muted-foreground">{event.venue_name}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Step({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ScanLine
  title: string
  body: string
}) {
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      {/* One accent treatment for all four, not a different pastel per card. */}
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"
      >
        <Icon className="size-5" />
      </span>
      <h3 className="mt-3 font-medium text-card-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{body}</p>
    </li>
  )
}
