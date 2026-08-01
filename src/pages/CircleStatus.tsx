import { useMemo } from 'react'
import { Check, ClipboardList, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import PaymentProcessor from '@/components/PaymentProcessor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import type { ApplicationStatus, CircleRow } from '@/lib/database.types'
import { formatMoney } from '@/lib/money'
import { useBooths, useCircles, useEvent } from '@/lib/queries'
import { useAuthStore } from '@/stores/authStore'

/**
 * The circle's own view of its application: where it is in the review, what it
 * owes, and which booth it got.
 *
 * Rendered by `CircleApplicationForm` once an application exists — a submitted
 * applicant should not be shown an empty form. It takes `eventId` as a prop so
 * it also works as the `/e/:eventId/status` route element, where it falls back
 * to `useParams()`.
 */

const STEPS: ApplicationStatus[] = ['draft', 'submitted', 'under_review']

const DECISION: Record<string, { key: string; variant: 'success' | 'warning' | 'danger' }> = {
  accepted: { key: 'status.accepted', variant: 'success' },
  waitlisted: { key: 'status.waitlisted', variant: 'warning' },
  rejected: { key: 'status.rejected', variant: 'danger' },
}

export default function CircleStatus({ eventId: eventIdProp }: { eventId?: string } = {}) {
  const params = useParams()
  const eventId = eventIdProp ?? params.eventId
  const { t, i18n } = useTranslation(['circle', 'common'])

  const userId = useAuthStore((s) => s.user?.id ?? null)
  const { data: circles, isLoading, error, refetch } = useCircles(eventId)
  const { data: event } = useEvent(eventId)
  const { data: booths } = useBooths(eventId)

  const circle = useMemo(
    () =>
      [...circles]
        .filter((c) => c.user_id === userId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null,
    [circles, userId],
  )

  const booth = booths.find((b) => b.circle_id === circle?.id) ?? null
  const currency = event?.currency ?? 'IDR'

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-10" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t('common:error.network')}
        description={error.message}
        action={
          <Button variant="outline" onClick={refetch}>
            {t('common:action.retry')}
          </Button>
        }
      />
    )
  }

  if (!circle) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t('status.title')}
        description={t('application.subtitle')}
      />
    )
  }

  const decision = DECISION[circle.application_status]

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-pretty">
            {circle.circle_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{event?.name}</p>
        </div>
        {decision ? (
          <Badge variant={decision.variant}>{t(decision.key)}</Badge>
        ) : (
          <Badge variant="info">{t('status.pending')}</Badge>
        )}
      </header>

      <Timeline circle={circle} />

      {circle.application_status === 'rejected' && circle.review_notes && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive-subtle p-4 text-sm text-destructive">
          {t('status.rejectedReason', { reason: circle.review_notes })}
        </p>
      )}

      {circle.application_status === 'waitlisted' && (
        <p className="mt-4 rounded-lg border border-border bg-warning-subtle p-4 text-sm text-warning">
          {t('status.waitlisted')}
          {circle.waitlist_position ? ` · #${circle.waitlist_position}` : ''}
        </p>
      )}

      <section className="mt-8 rounded-lg border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-medium text-foreground">{t('section.payment')}</h2>
            <p className="text-sm text-muted-foreground">
              {circle.payment_status === 'paid'
                ? t('common:status.paid')
                : t('common:status.unpaid')}
            </p>
          </div>
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {formatMoney(Number(circle.total_amount), currency, i18n.language)}
          </span>
        </div>

        {circle.payment_status === 'paid' ? (
          <p className="flex items-center gap-2 p-4 text-sm text-success">
            <Check className="size-4" aria-hidden="true" />
            {t('common:status.paid')}
          </p>
        ) : circle.application_status === 'accepted' ? (
          <div className="p-4">
            <PaymentProcessor circleId={circle.id} />
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {t('status.pending')} — {t('application.subtitle')}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-border p-4">
        <h2 className="font-medium text-foreground">{t('booth.title')}</h2>
        {booth ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
            <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-mono text-base">{booth.booth_number}</span>
            {booth.zone && <span className="text-muted-foreground">· {booth.zone}</span>}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t('booth.notAllocatedBody')}</p>
        )}
      </section>
    </div>
  )
}

function Timeline({ circle }: { circle: CircleRow }) {
  const { t, i18n } = useTranslation(['circle', 'common'])
  const reached = (step: ApplicationStatus) => {
    if (step === 'draft') return true
    if (step === 'submitted') return circle.application_status !== 'draft'
    return Boolean(circle.reviewed_at) || circle.application_status === 'under_review'
  }

  const stamp = (step: ApplicationStatus) => {
    const value =
      step === 'draft' ? circle.created_at : step === 'submitted' ? circle.submitted_at : circle.reviewed_at
    return value ? new Date(value).toLocaleString(i18n.language) : ''
  }

  const labels: Record<string, string> = {
    draft: t('common:status.draft'),
    submitted: t('common:action.submit'),
    under_review: t('status.underReview'),
  }

  return (
    <ol className="mt-6 space-y-0">
      {STEPS.map((step, index) => (
        <li key={step} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              aria-hidden="true"
              className={
                reached(step)
                  ? 'flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground'
                  : 'flex size-6 items-center justify-center rounded-full border border-border bg-muted'
              }
            >
              {reached(step) && <Check className="size-3.5" />}
            </span>
            {index < STEPS.length - 1 && <span className="h-8 w-px flex-1 bg-border" />}
          </div>
          <div className="pb-6">
            <p className={reached(step) ? 'text-sm font-medium' : 'text-sm text-muted-foreground'}>
              {labels[step]}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">{stamp(step)}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
