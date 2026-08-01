import { useMemo, useState } from 'react'
import { Minus, Plus, Ticket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { EmptyState } from './ui/empty-state'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Progress } from './ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Textarea } from './ui/textarea'
import { formatMoney, type Currency } from '@/lib/money'
import {
  useEvent,
  useFinancialSummary,
  usePurchaseTickets,
  useSaveTicket,
  useTickets,
} from '@/lib/queries'
import type { TicketRow } from '@/lib/database.types'
import { useAuthStore } from '@/stores/authStore'

/**
 * `/e/:eventId/tickets` — ONE ticket catalog, two audiences.
 *
 * The route is in both nav tables (organizer sidebar and the public topbar), so
 * the screen branches on role rather than duplicating the tier list: an organizer
 * administers the tiers, everyone else buys from them. Before this, an attendee
 * checkout kept its own hardcoded `{general, premium, vip}` array that
 * contradicted the four tiers the organizer edits — the list you buy from was not
 * the list being sold.
 *
 * There is no scanner tab here any more. The scanner is `/e/:eventId/scan` in the
 * Focus layout, with a real gate id and the signed-in staffer, not the literals
 * `GATE_SCAN_01` / `STAFF_001`.
 */
export default function TicketingSystem() {
  const { eventId } = useParams()
  const role = useAuthStore((s) => s.role)
  return role === 'organizer' ? <TierAdmin eventId={eventId} /> : <Checkout eventId={eventId} />
}

/** `purchase_tickets` reads the price out of `tickets`; this only has to agree. */
function effectivePrice(tier: TicketRow): number {
  const early =
    tier.early_bird_price != null &&
    tier.early_bird_end != null &&
    new Date().toISOString() < tier.early_bird_end
  return Number(early ? tier.early_bird_price : tier.price)
}

const remainingOf = (tier: TicketRow) => Math.max(0, tier.quantity_available - tier.quantity_sold)
const onSale = (tier: TicketRow) => tier.status === 'active' && remainingOf(tier) > 0

// ---------------------------------------------------------------------------
// Attendee checkout
// ---------------------------------------------------------------------------

function Checkout({ eventId }: { eventId: string | undefined }) {
  const { t, i18n } = useTranslation(['catalog', 'common'])
  const user = useAuthStore((s) => s.user)
  const { data: event } = useEvent(eventId)
  const { data: tiers, isLoading, error, isEmpty, refetch } = useTickets(eventId)
  const purchase = usePurchaseTickets(eventId ?? '', user?.id)

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<{ reference: string } | null>(null)

  const currency = (event?.currency ?? tiers[0]?.currency ?? 'IDR') as Currency
  const lines = tiers
    .map((tier) => ({ tier, quantity: quantities[tier.id] ?? 0 }))
    .filter((line) => line.quantity > 0)
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = lines.reduce((sum, line) => sum + effectivePrice(line.tier) * line.quantity, 0)

  function setQuantity(tier: TicketRow, next: number) {
    setFormError(null)
    setQuantities((prev) => ({ ...prev, [tier.id]: Math.max(0, Math.min(next, remainingOf(tier))) }))
  }

  async function submit() {
    if (totalQuantity === 0) return setFormError(t('checkout.selectOne'))
    if (totalQuantity > 20) return setFormError(t('checkout.maxPerOrder'))
    setFormError(null)

    // One RPC per tier: `purchase_tickets` takes a single tier and does its
    // oversell guard in one UPDATE … RETURNING, which is what makes two buyers
    // for the last seat serialise. The client never sends a price.
    try {
      let reference = ''
      for (const line of lines) {
        const result = await purchase.mutateAsync({
          ticketId: line.tier.id,
          quantity: line.quantity,
        })
        reference = result.order_reference ?? result.order_id.slice(0, 8)
      }
      setQuantities({})
      setPlaced({ reference })
      toast.success(t('checkout.placed', { reference }))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t('checkout.failed')
      setFormError(message)
      toast.error(t('checkout.failed'))
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-32 sm:py-10 lg:pb-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t('checkout.title')}
        </h1>
        {event && <p className="mt-1 text-sm text-muted-foreground">{event.name}</p>}
      </header>

      {error && (
        <EmptyState
          icon={Ticket}
          title={t('common:error.network')}
          description={error.message}
          action={
            <Button variant="outline" onClick={refetch}>
              {t('common:action.retry')}
            </Button>
          }
        />
      )}

      {!error && isEmpty && (
        <EmptyState icon={Ticket} title={t('checkout.empty')} description={t('checkout.emptyBody')} />
      )}

      {placed && (
        <div className="mt-6 rounded-lg border border-success/40 bg-success-subtle p-4">
          <p className="font-medium text-success">
            {t('checkout.placed', { reference: placed.reference })}
          </p>
          <p className="mt-1 text-sm text-foreground text-pretty">{t('checkout.placedBody')}</p>
          <Button asChild className="mt-3" variant="outline">
            <Link to="/wallet">{t('checkout.viewWallet')}</Link>
          </Button>
        </div>
      )}

      {tiers.length > 0 && (
        <div className="mt-6 gap-8 lg:flex">
          <ul className="min-w-0 flex-1 space-y-3">
            {tiers.map((tier) => {
              const remaining = remainingOf(tier)
              const available = onSale(tier)
              const quantity = quantities[tier.id] ?? 0
              return (
                <li
                  key={tier.id}
                  className={
                    quantity > 0
                      ? 'rounded-lg border-2 border-primary bg-card p-4'
                      : 'rounded-lg border border-border bg-card p-4'
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2
                        className={
                          available
                            ? 'font-medium text-card-foreground'
                            : 'font-medium text-muted-foreground'
                        }
                      >
                        {tier.ticket_type}
                      </h2>
                      {tier.description && (
                        <p className="mt-1 text-sm text-muted-foreground text-pretty">
                          {tier.description}
                        </p>
                      )}
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium tabular-nums text-foreground">
                          {formatMoney(effectivePrice(tier), currency, i18n.language)}
                        </span>
                        {available ? (
                          <span className="tabular-nums text-muted-foreground">
                            {t('ticket.remaining', { count: remaining })}
                          </span>
                        ) : (
                          <Badge variant="secondary">{t('ticket.soldOut')}</Badge>
                        )}
                        {tier.requires_id && (
                          <Badge variant="warning">{tier.age_restriction ?? 'ID'}</Badge>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={!available || quantity === 0}
                        aria-label={t('checkout.decrease', { tier: tier.ticket_type })}
                        onClick={() => setQuantity(tier, quantity - 1)}
                      >
                        <Minus aria-hidden="true" />
                      </Button>
                      <span
                        className="w-8 text-center text-base font-medium tabular-nums text-foreground"
                        aria-live="polite"
                      >
                        {quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={!available || quantity >= remaining}
                        aria-label={t('checkout.increase', { tier: tier.ticket_type })}
                        onClick={() => setQuantity(tier, quantity + 1)}
                      >
                        <Plus aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Desktop: sticky summary. Mobile: the fixed bar below. */}
          <aside className="mt-6 hidden w-80 shrink-0 lg:mt-0 lg:block">
            <div className="sticky top-20 rounded-lg border border-border bg-card p-4">
              <h2 className="font-medium text-card-foreground">{t('checkout.summary')}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {lines.map((line) => (
                  <li key={line.tier.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {line.quantity} × {line.tier.ticket_type}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatMoney(
                        effectivePrice(line.tier) * line.quantity,
                        currency,
                        i18n.language,
                      )}
                    </span>
                  </li>
                ))}
                {lines.length === 0 && (
                  <li className="text-muted-foreground">{t('checkout.selectOne')}</li>
                )}
              </ul>
              <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">{t('ticket.total')}</span>
                <span className="text-lg font-semibold tabular-nums text-foreground">
                  {formatMoney(total, currency, i18n.language)}
                </span>
              </div>
              {formError && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {formError}
                </p>
              )}
              <CheckoutButton
                signedIn={Boolean(user)}
                pending={purchase.isPending}
                disabled={totalQuantity === 0}
                onSubmit={submit}
              />
            </div>
          </aside>
        </div>
      )}

      {tiers.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background p-4 lg:hidden">
          {formError && (
            <p role="alert" className="mb-2 text-sm text-destructive">
              {formError}
            </p>
          )}
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground tabular-nums">
              {t('common:count.selected', { count: totalQuantity })}
            </span>
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {formatMoney(total, currency, i18n.language)}
            </span>
          </div>
          <CheckoutButton
            signedIn={Boolean(user)}
            pending={purchase.isPending}
            disabled={totalQuantity === 0}
            onSubmit={submit}
          />
        </div>
      )}
    </div>
  )
}

function CheckoutButton({
  signedIn,
  pending,
  disabled,
  onSubmit,
}: {
  signedIn: boolean
  pending: boolean
  disabled: boolean
  onSubmit: () => void
}) {
  const { t } = useTranslation(['catalog', 'common'])

  if (!signedIn) {
    return (
      <Button asChild className="mt-4 w-full">
        <Link to={`/login?next=${encodeURIComponent(window.location.pathname)}`}>
          {t('checkout.signIn')}
        </Link>
      </Button>
    )
  }

  return (
    <Button className="mt-4 w-full" disabled={disabled || pending} onClick={onSubmit}>
      {pending ? t('ticket.processing') : t('ticket.checkout')}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Organizer tier admin
// ---------------------------------------------------------------------------

function TierAdmin({ eventId }: { eventId: string | undefined }) {
  const { t, i18n } = useTranslation(['catalog', 'common'])
  const { data: event } = useEvent(eventId)
  const { data: tiers, isLoading, error, isEmpty, refetch } = useTickets(eventId)
  const summary = useFinancialSummary(eventId)
  const save = useSaveTicket(eventId ?? '')
  const [editing, setEditing] = useState<Partial<TicketRow> | null>(null)

  const currency = (event?.currency ?? tiers[0]?.currency ?? 'IDR') as Currency

  const sales = useMemo(() => {
    const rows = summary.data.filter((row) => row.transaction_type === 'ticket_sale')
    return {
      net: rows.reduce((sum, row) => sum + Number(row.net_amount), 0),
      pending: rows.reduce((sum, row) => sum + Number(row.pending_amount), 0),
    }
  }, [summary.data])

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t('tier.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{t('tier.subtitle')}</p>
        </div>
        <Button onClick={() => setEditing({})}>{t('tier.new')}</Button>
      </header>

      {/* Totals come from `event_financial_summary`, never from reducing orders
          in this component — criterion 4. */}
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <dt className="text-sm text-muted-foreground">{t('tier.revenue')}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
            {formatMoney(sales.net, currency, i18n.language)}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <dt className="text-sm text-muted-foreground">{t('tier.pendingRevenue')}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
            {formatMoney(sales.pending, currency, i18n.language)}
          </dd>
        </div>
      </dl>

      {isLoading && (
        <div className="mt-6 space-y-3" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <EmptyState
          icon={Ticket}
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
          icon={Ticket}
          title={t('tier.empty')}
          description={t('tier.emptyBody')}
          action={<Button onClick={() => setEditing({})}>{t('tier.new')}</Button>}
        />
      )}

      <ul className="mt-6 space-y-3">
        {tiers.map((tier) => (
          <li key={tier.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-medium text-card-foreground">{tier.ticket_type}</h2>
                <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                  {formatMoney(Number(tier.price), currency, i18n.language)}
                  {tier.sale_end
                    ? ` · ${t('ticket.salesEnd', {
                        date: new Intl.DateTimeFormat(i18n.language, {
                          day: 'numeric',
                          month: 'short',
                        }).format(new Date(tier.sale_end)),
                      })}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={tier.status === 'active' ? 'success' : 'secondary'}>
                  {tier.status === 'sold_out' ? t('ticket.soldOut') : tier.status}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => setEditing(tier)}>
                  {t('common:action.edit')}
                </Button>
              </div>
            </div>
            <div className="mt-3">
              <Progress
                value={
                  tier.quantity_available > 0
                    ? (tier.quantity_sold / tier.quantity_available) * 100
                    : 0
                }
              />
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                {t('tier.sold', { sold: tier.quantity_sold, total: tier.quantity_available })}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <TierDialog
        value={editing}
        onClose={() => setEditing(null)}
        onSave={async (values) => {
          try {
            await save.mutateAsync(values)
            setEditing(null)
            toast.success(t('common:status.saved'))
          } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : t('tier.saveError'))
          }
        }}
        pending={save.isPending}
      />
    </div>
  )
}

function TierDialog({
  value,
  onClose,
  onSave,
  pending,
}: {
  value: Partial<TicketRow> | null
  onClose: () => void
  onSave: (values: Partial<TicketRow> & { id?: string }) => void
  pending: boolean
}) {
  const { t } = useTranslation(['catalog', 'common'])
  const [draft, setDraft] = useState<Partial<TicketRow>>({})
  const [touched, setTouched] = useState<Partial<TicketRow> | null>(null)

  // Reset the form when a different tier is opened, without an effect.
  if (value !== touched) {
    setTouched(value)
    setDraft(value ?? {})
  }

  const nameInvalid = !draft.ticket_type?.trim()

  return (
    <Dialog open={value !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{value?.id ? t('tier.edit') : t('tier.new')}</DialogTitle>
          <DialogDescription>{t('tier.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="tier-name">{t('tier.name')}</Label>
            <Input
              id="tier-name"
              value={draft.ticket_type ?? ''}
              onChange={(e) => setDraft({ ...draft, ticket_type: e.target.value })}
              aria-invalid={nameInvalid ? true : undefined}
              className="coarse:min-h-11"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="tier-price">{t('ticket.price')}</Label>
              <Input
                id="tier-price"
                type="number"
                min={0}
                value={draft.price ?? 0}
                onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                className="tabular-nums coarse:min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="tier-quantity">{t('tier.quantity')}</Label>
              <Input
                id="tier-quantity"
                type="number"
                min={0}
                value={draft.quantity_available ?? 0}
                onChange={(e) => setDraft({ ...draft, quantity_available: Number(e.target.value) })}
                className="tabular-nums coarse:min-h-11"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="tier-sale-end">{t('tier.saleEnd')}</Label>
              <Input
                id="tier-sale-end"
                type="date"
                value={draft.sale_end?.slice(0, 10) ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    sale_end: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
                className="coarse:min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="tier-status">{t('tier.status')}</Label>
              <Select
                value={draft.status ?? 'active'}
                onValueChange={(status) =>
                  setDraft({ ...draft, status: status as TicketRow['status'] })
                }
              >
                <SelectTrigger id="tier-status" className="coarse:min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="inactive">inactive</SelectItem>
                  <SelectItem value="sold_out">sold_out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="tier-description">{t('tier.description')}</Label>
            <Textarea
              id="tier-description"
              value={draft.description ?? ''}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t('common:action.cancel')}
          </Button>
          <Button
            className="flex-1"
            disabled={pending || nameInvalid}
            onClick={() => onSave(draft)}
          >
            {pending ? t('common:status.saving') : t('common:action.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
