import { useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, Download, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { EmptyState } from './ui/empty-state'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { Textarea } from './ui/textarea'
import type { ApplicationStatus, CircleRow, PaymentStatus } from '@/lib/database.types'
import { formatMoney } from '@/lib/money'
import { queryKeys, useCircles, useEvent, useWrite } from '@/lib/queries'
import { supabase } from '@/lib/supabase'

/**
 * The circle application review queue.
 *
 * Two bugs this file used to carry, both of which made the screen a decoration:
 *   - the Approve button wrote an application_status the CHECK constraint
 *     rejects — the domain is
 *     `draft|submitted|pending|under_review|accepted|rejected|waitlisted`, and
 *     the button sent a synonym of `accepted` that is not in it, so approving a
 *     circle had never once worked;
 *   - it fetched every circle of every event, because nothing scoped it to
 *     `:eventId`.
 *
 * `reviewed_at` / `reviewed_by` are stamped by `circles_stamp_lifecycle` (005)
 * and reverted by `circles_guard_privileged_columns` for anyone who is not the
 * event's organizer. They are displayed here and never written.
 */

const PAGE_SIZE = 25

const TABS = [
  { id: 'pending', labelKey: 'review.tab.pending', statuses: ['submitted', 'pending', 'under_review'] },
  { id: 'accepted', labelKey: 'review.tab.approved', statuses: ['accepted'] },
  { id: 'waitlist', labelKey: 'review.tab.waitlist', statuses: ['waitlisted'] },
  { id: 'rejected', labelKey: 'review.tab.rejected', statuses: ['rejected'] },
] as const

type TabId = (typeof TABS)[number]['id']

const SPACE_LABEL: Record<string, string> = {
  circle_space_1: '1 space',
  circle_space_2: '2 spaces',
  circle_space_4: '4 spaces',
  circle_booth_a: 'Booth A',
  circle_booth_b: 'Booth B',
}

const PAYMENT_VARIANT: Record<PaymentStatus, 'success' | 'warning' | 'info' | 'danger'> = {
  paid: 'success',
  pending: 'warning',
  refunded: 'info',
  cancelled: 'danger',
}

/**
 * Accept / waitlist / reject, one row or fifty, in a single `.in('id', ids)`
 * statement — bulk approving 200 circles must not be 200 round trips.
 *
 * ponytail: this lives here rather than in `src/lib/queries/circles.ts` because
 * that file belongs to P9 and this wave runs four packages in parallel. Move it
 * next to `useUpdateCircleStatus` the next time the seam is touched. It also
 * invalidates `['circles', eventId]` rather than `queryKeys.circles.list(eventId)`:
 * that helper returns a three-element key ending in `null`, which does not
 * prefix-match the list query's `['circles', eventId, {}]`, so the table would
 * not refresh after a write.
 */
function useReviewCircles(eventId: string) {
  return useWrite(
    async (args: { ids: string[]; status: ApplicationStatus; reviewNotes?: string | null }) => {
      const { error } = await supabase
        .from('circles')
        .update({
          application_status: args.status,
          review_notes: args.reviewNotes ?? null,
        })
        .in('id', args.ids)
      if (error) throw new Error(error.message)
      return args.ids.length
    },
    () => [['circles', eventId], queryKeys.circles.catalog(eventId)],
  )
}

export default function CircleManagement() {
  const { eventId } = useParams()
  const { t, i18n } = useTranslation(['organizer', 'circle', 'common'])

  const [tab, setTab] = useState<TabId>('pending')
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('all')
  const [payment, setPayment] = useState('all')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [openId, setOpenId] = useState<string | null>(null)

  const { data: circles, isLoading, error, refetch } = useCircles(eventId)
  const { data: event } = useEvent(eventId)
  const review = useReviewCircles(eventId ?? '')

  const currency = event?.currency ?? 'IDR'

  // A draft has not been submitted to anybody: it is the applicant's private
  // scratch row, and the UNIQUE(event_id, user_id) index means it becomes the
  // real application in place.
  const submitted = useMemo(
    () => circles.filter((c) => c.application_status !== 'draft'),
    [circles],
  )

  const counts = useMemo(() => {
    const byTab = {} as Record<TabId, number>
    for (const { id, statuses } of TABS) {
      byTab[id] = submitted.filter((c) =>
        (statuses as readonly string[]).includes(c.application_status),
      ).length
    }
    return byTab
  }, [submitted])

  const genres = useMemo(
    () => [...new Set(submitted.map((c) => c.genre).filter((g): g is string => Boolean(g)))].sort(),
    [submitted],
  )

  const filtered = useMemo(() => {
    const statuses = TABS.find((x) => x.id === tab)!.statuses as readonly string[]
    const term = search.trim().toLowerCase()
    return submitted.filter((c) => {
      if (!statuses.includes(c.application_status)) return false
      if (genre !== 'all' && c.genre !== genre) return false
      if (payment !== 'all' && c.payment_status !== payment) return false
      if (!term) return true
      return [c.circle_name, c.pen_name, c.circle_code, c.circle_name_furigana]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    })
  }, [submitted, tab, genre, payment, search])

  // ponytail: the event's circles are fetched once and paged in memory. One
  // convention is 500–1500 applications, which is a ~1 MB response and instant
  // filtering; rendering all of them at once is what actually hurts. Upgrade
  // path if an event ever passes ~5k: `.range()` in the query hook plus a count
  // request, at the cost of a round trip per tab and per keystroke.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageIndex = Math.min(page, pageCount - 1)
  const rows = filtered.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE)

  const openCircle = circles.find((c) => c.id === openId) ?? null
  const filtersActive = search !== '' || genre !== 'all' || payment !== 'all'

  function reset(next: Partial<{ tab: TabId }> = {}) {
    setPage(0)
    setSelected([])
    if (next.tab) setTab(next.tab)
  }

  async function apply(ids: string[], status: ApplicationStatus, reviewNotes?: string | null) {
    if (ids.length === 0) return
    try {
      await review.mutateAsync({ ids, status, reviewNotes })
      toast.success(t('common:status.saved'), { description: `${ids.length} × ${status}` })
      setSelected([])
      setOpenId(null)
    } catch (err) {
      toast.error(t('common:error.generic'), {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  function exportCsv(list: CircleRow[]) {
    const head = ['circle_code', 'circle_name', 'pen_name', 'genre', 'space_type', 'application_status', 'payment_status', 'total_amount', 'submitted_at']
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [
      head.join(','),
      ...list.map((c) => head.map((k) => cell(c[k as keyof CircleRow])).join(',')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `circles-${tab}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('review.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{event?.name ?? ''}</p>
        </div>
        <Button variant="outline" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
          <Download aria-hidden="true" />
          {t('common:action.export')}
        </Button>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => reset({ tab: v as TabId })}
        className="mt-6"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">
          {TABS.map((x) => (
            <TabsTrigger key={x.id} value={x.id} className="coarse:min-h-11">
              {t(x.labelKey)}
              <span className="ml-1.5 tabular-nums text-muted-foreground">{counts[x.id]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label={t('common:action.filter')}
            className="pl-9 coarse:min-h-11"
            placeholder={t('common:shell.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
          />
        </div>
        <Select
          value={genre}
          onValueChange={(v) => {
            setGenre(v)
            setPage(0)
          }}
        >
          <SelectTrigger className="w-full sm:w-52 coarse:min-h-11" aria-label={t('circle:field.genre')}>
            <SelectValue placeholder={t('circle:field.genre')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('circle:field.genre')}</SelectItem>
            {genres.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={payment}
          onValueChange={(v) => {
            setPayment(v)
            setPage(0)
          }}
        >
          <SelectTrigger className="w-full sm:w-40 coarse:min-h-11" aria-label={t('review.column.payment')}>
            <SelectValue placeholder={t('review.column.payment')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('review.column.payment')}</SelectItem>
            <SelectItem value="paid">{t('common:status.paid')}</SelectItem>
            <SelectItem value="pending">{t('common:status.pending')}</SelectItem>
            <SelectItem value="refunded">{t('common:status.refunded')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="mt-6 space-y-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && error && (
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
      )}

      {!isLoading && !error && (
        <>
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            {/* Headers stay mounted when the emptiness is filter-induced, so
                nobody concludes their applications are gone. */}
            <table className="hidden w-full table-fixed border-collapse text-sm lg:table">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="w-10 px-3 py-2">
                    <Checkbox
                      aria-label={t('common:action.selectAll')}
                      checked={rows.length > 0 && rows.every((r) => selected.includes(r.id))}
                      onCheckedChange={(v) =>
                        setSelected(v ? [...new Set([...selected, ...rows.map((r) => r.id)])] : [])
                      }
                    />
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('review.column.circle')}</th>
                  <th scope="col" className="w-40 px-3 py-2 font-medium">{t('review.column.genre')}</th>
                  <th scope="col" className="w-28 px-3 py-2 font-medium">{t('review.column.boothPreference')}</th>
                  <th scope="col" className="w-28 px-3 py-2 font-medium">{t('review.column.payment')}</th>
                  <th scope="col" className="w-28 px-3 py-2 font-medium">{t('review.column.submitted')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/60 data-[selected=true]:bg-accent"
                    data-selected={selected.includes(c.id)}
                    onClick={() => setOpenId(c.id)}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={c.circle_name}
                        checked={selected.includes(c.id)}
                        onCheckedChange={(v) =>
                          setSelected(v ? [...selected, c.id] : selected.filter((id) => id !== c.id))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-h-11 items-center gap-3">
                        <Thumb circle={c} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{c.circle_name}</div>
                          <div className="truncate text-xs text-muted-foreground">{c.pen_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="truncate px-3 py-2 text-muted-foreground">{c.genre ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {c.space_type ? SPACE_LABEL[c.space_type] : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <PaymentPill status={c.payment_status} />
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString(i18n.language) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Below lg the same rows are stacked cards — a six-column table at
                320px is a horizontal scrollbar with data in it. */}
            <ul className="divide-y divide-border lg:hidden">
              {rows.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center gap-3 p-3">
                    <Checkbox
                      aria-label={c.circle_name}
                      className="coarse:size-5"
                      checked={selected.includes(c.id)}
                      onCheckedChange={(v) =>
                        setSelected(v ? [...selected, c.id] : selected.filter((id) => id !== c.id))
                      }
                    />
                    <button
                      type="button"
                      className="flex min-h-11 flex-1 items-center gap-3 text-left"
                      onClick={() => setOpenId(c.id)}
                    >
                      <Thumb circle={c} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {c.circle_name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.pen_name} · {c.genre ?? '—'}
                        </span>
                      </span>
                      <PaymentPill status={c.payment_status} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {rows.length === 0 && (
              <EmptyState
                icon={ClipboardList}
                title={
                  filtersActive ? t('common:empty.noResults.title') : t('common:empty.noData.title')
                }
                description={
                  filtersActive
                    ? t('common:empty.noResults.description')
                    : t('common:empty.noData.description')
                }
                secondaryAction={
                  filtersActive ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch('')
                        setGenre('all')
                        setPayment('all')
                      }}
                    >
                      {t('common:action.clearFilters')}
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span className="tabular-nums">
                {pageIndex * PAGE_SIZE + 1}–{pageIndex * PAGE_SIZE + rows.length} / {filtered.length}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageIndex === 0}
                  onClick={() => setPage(pageIndex - 1)}
                >
                  {t('common:action.back')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageIndex >= pageCount - 1}
                  onClick={() => setPage(pageIndex + 1)}
                >
                  {t('common:action.next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {selected.length > 0 && (
        <BulkBar
          count={selected.length}
          busy={review.isPending}
          onApprove={() => void apply(selected, 'accepted')}
          onWaitlist={() => void apply(selected, 'waitlisted')}
          onExport={() => exportCsv(filtered.filter((c) => selected.includes(c.id)))}
          onClear={() => setSelected([])}
        />
      )}

      <Inspector
        circle={openCircle}
        currency={currency}
        busy={review.isPending}
        onClose={() => setOpenId(null)}
        onDecide={apply}
      />
    </div>
  )
}

function Thumb({ circle }: { circle: CircleRow }) {
  if (circle.circle_cut_file_url) {
    return (
      <img
        src={circle.circle_cut_file_url}
        alt=""
        className="size-8 shrink-0 rounded object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-medium text-primary"
    >
      {circle.circle_name.slice(0, 2)}
    </span>
  )
}

function PaymentPill({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation('common')
  return (
    <Badge variant={PAYMENT_VARIANT[status]}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {t(`status.${status}`)}
    </Badge>
  )
}

function BulkBar({
  count,
  busy,
  onApprove,
  onWaitlist,
  onExport,
  onClear,
}: {
  count: number
  busy: boolean
  onApprove: () => void
  onWaitlist: () => void
  onExport: () => void
  onClear: () => void
}) {
  const { t } = useTranslation(['organizer', 'common'])
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      {/* Anchored over the table, not a toolbar that pushes the rows down. */}
      <div
        role="status"
        className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-2xl flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-md"
      >
        <span className="px-2 text-sm font-medium tabular-nums">
          {t('common:count.selected', { count })}
        </span>
        <Button size="sm" disabled={busy} onClick={() => setConfirming(true)}>
          {t('review.approve')}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onWaitlist}>
          {t('review.waitlist')}
        </Button>
        <Button size="sm" variant="outline" onClick={onExport}>
          {t('common:action.export')}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto coarse:size-11"
          aria-label={t('common:action.close')}
          onClick={onClear}
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('review.bulkConfirm', { count })}</DialogTitle>
            <DialogDescription>{t('review.bulkConfirmBody')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t('common:action.cancel')}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                setConfirming(false)
                onApprove()
              }}
            >
              <CheckCircle2 aria-hidden="true" />
              {t('review.approve')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Inspector({
  circle,
  currency,
  busy,
  onClose,
  onDecide,
}: {
  circle: CircleRow | null
  currency: 'IDR' | 'USD'
  busy: boolean
  onClose: () => void
  onDecide: (ids: string[], status: ApplicationStatus, notes?: string | null) => void
}) {
  const { t, i18n } = useTranslation(['organizer', 'circle', 'common'])
  const [notes, setNotes] = useState('')
  const [rejecting, setRejecting] = useState(false)

  if (!circle) return null

  const rows: [string, string][] = [
    [t('circle:field.penName'), circle.pen_name],
    [t('circle:field.email'), circle.email],
    [t('circle:field.phone'), circle.phone ?? '—'],
    [t('circle:field.genre'), circle.genre ?? '—'],
    [t('circle:field.fandom'), circle.fandom ?? '—'],
    [t('circle:field.rating'), circle.rating ?? '—'],
    [t('circle:field.spacePreference'), circle.space_type ? SPACE_LABEL[circle.space_type] : '—'],
    [t('circle:field.exhibitorPasses'), String(circle.exhibitor_passes)],
    [t('finance.circleFees'), formatMoney(Number(circle.total_amount), currency, i18n.language)],
  ]

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setNotes('')
          setRejecting(false)
          onClose()
        }
      }}
    >
      {/* Right-anchored at every width: a side panel on a laptop, a full-height
          sheet on a phone. One implementation, two readings. */}
      <DialogContent className="inset-y-0 left-auto right-0 top-0 flex h-full max-w-md translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none p-0 sm:rounded-none">
        <DialogHeader className="border-b border-border p-4 text-left">
          <DialogTitle className="pr-8 text-pretty">{circle.circle_name}</DialogTitle>
          <DialogDescription>
            {circle.circle_name_furigana ?? t('review.inspector')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 p-4">
          {circle.circle_cut_file_url && (
            <img
              src={circle.circle_cut_file_url}
              alt={t('circle:field.circleCut')}
              className="w-full rounded-md border border-border object-contain"
            />
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right text-foreground">{value}</dd>
              </div>
            ))}
          </dl>

          {circle.description && (
            <section>
              <h3 className="text-sm font-medium">{t('circle:field.description')}</h3>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">{circle.description}</p>
            </section>
          )}

          {circle.works_description && (
            <section>
              <h3 className="text-sm font-medium">{t('circle:field.worksDescription')}</h3>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {circle.works_description}
              </p>
            </section>
          )}

          {circle.special_requests && (
            <section>
              <h3 className="text-sm font-medium">{t('circle:field.specialRequests')}</h3>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {circle.special_requests}
              </p>
            </section>
          )}

          {circle.sample_works_images && circle.sample_works_images.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {circle.sample_works_images.map((url) => (
                <li key={url}>
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    className="h-20 w-full rounded border border-border object-cover"
                  />
                </li>
              ))}
            </ul>
          )}

          {circle.reviewed_at && (
            <p className="text-xs text-muted-foreground">
              {t('common:status.underReview')} ·{' '}
              {new Date(circle.reviewed_at).toLocaleString(i18n.language)}
            </p>
          )}

          {circle.review_notes && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {circle.review_notes}
            </p>
          )}

          {rejecting && (
            <div>
              <Label htmlFor="reject-reason">{t('review.rejectReason')}</Label>
              <Textarea
                id="reject-reason"
                className="mt-1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('review.rejectReasonRequired')}
              />
              {notes.trim() === '' && (
                <p className="mt-1 text-sm text-destructive">{t('review.rejectReasonRequired')}</p>
              )}
            </div>
          )}
        </div>

        {/* Pinned to the bottom edge: the decision is why the panel is open. */}
        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card p-4">
          <Button
            className="flex-1 coarse:min-h-11"
            disabled={busy}
            onClick={() => onDecide([circle.id], 'accepted', notes.trim() || null)}
          >
            {t('review.approve')}
          </Button>
          <Button
            variant="outline"
            className="coarse:min-h-11"
            disabled={busy}
            onClick={() => onDecide([circle.id], 'waitlisted', notes.trim() || null)}
          >
            {t('review.waitlist')}
          </Button>
          <Button
            variant="destructive"
            className="coarse:min-h-11"
            disabled={busy || (rejecting && notes.trim() === '')}
            onClick={() => {
              if (!rejecting) {
                setRejecting(true)
                return
              }
              onDecide([circle.id], 'rejected', notes.trim())
            }}
          >
            {t('review.reject')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
