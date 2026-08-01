import { useEffect, useState } from 'react'
import { Ticket, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { QRCodeGenerator } from '@/lib/qrcode'
import { formatMoney, type Currency } from '@/lib/money'
import { useEvents, useMyPurchases, usePasses, useTickets } from '@/lib/queries'
import type { TicketPassRow, TicketPurchaseRow } from '@/lib/database.types'
import { useAuthStore } from '@/stores/authStore'

/**
 * The attendee's QR wallet — one card per `ticket_passes` row, because one order
 * for five people admits five people and a single code per order admits either
 * once or unlimited times.
 *
 * THE PAYLOAD IS THE PASS'S OWN `qr_token` AND NOTHING ELSE. Not
 * `QR_${id}_${Date.now()}`, not JSON: `redeem_tickets` looks the token up and the
 * server decides admission. Anything encoded here that the server does not read
 * is decoration at best and a forgery surface at worst.
 *
 * Offline: the QR is rendered locally by the `qrcode` package, so the image needs
 * no network at all — only the pass rows do, and those are mirrored into
 * localStorage after the first successful load. A wallet that needs venue wifi at
 * the gate is useless.
 */
export default function TicketWallet({ eventId }: { eventId?: string }) {
  const { t, i18n } = useTranslation(['catalog', 'common'])
  const userId = useAuthStore((s) => s.user?.id)
  const events = useEvents()
  const [pickedEvent, setPickedEvent] = useState<string | null>(null)

  // `/wallet` carries no event scope, so the wallet picks one: the event running
  // today, else the next one that has not finished, else whatever exists. Sorting
  // by newest — which is what the event list returns — lands an attendee on the
  // convention six months out with an empty wallet on the morning they are
  // standing at the gate of the one running now.
  const byDate = [...events.data].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const today = new Date().toISOString().slice(0, 10)
  const activeEventId =
    eventId ??
    pickedEvent ??
    byDate.find((event) => event.status === 'ongoing')?.id ??
    byDate.find((event) => event.end_date >= today)?.id ??
    byDate[0]?.id
  const { data: orders, isLoading, error, isEmpty, refetch } = useMyPurchases(activeEventId, userId)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t('common:nav.myTickets')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{t('wallet.subtitle')}</p>
        </div>
        {!eventId && events.data.length > 1 && (
          <Select value={activeEventId} onValueChange={setPickedEvent}>
            <SelectTrigger className="w-56 coarse:min-h-11" aria-label={t('wallet.eventLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {events.data.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>

      {isLoading && (
        <div className="mt-6 space-y-3" aria-busy="true">
          {[0, 1].map((n) => (
            <div key={n} className="h-56 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <EmptyState
          icon={WifiOff}
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
          title={t('wallet.empty')}
          description={t('wallet.emptyBody')}
          action={
            activeEventId ? (
              <Button asChild>
                <Link to={`/e/${activeEventId}/tickets`}>{t('wallet.buy')}</Link>
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="mt-6 space-y-6">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} eventId={activeEventId} locale={i18n.language} />
        ))}
      </div>

      {orders.length > 0 && activeEventId && (
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link to={`/e/${activeEventId}/tickets`}>{t('wallet.buy')}</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Pass rows mirrored to localStorage after the first successful read, so the
 * wallet still renders on a dead connection at the gate. Stale is acceptable
 * here: the server decides admission, this is only what is shown to the scanner.
 *
 * ponytail: localStorage rather than the Dexie database the scanner uses. A
 * handful of pass rows per attendee is a few kB and needs no schema. Upgrade
 * path if the wallet ever holds hundreds of passes or needs the same conflict
 * handling as the scan queue: move it into `src/lib/scanQueue.ts`'s Dexie
 * instance as a `walletPasses` table.
 */
function usePassesOffline(purchaseId: string) {
  const key = `doujindesk.passes.${purchaseId}`
  const { data, isLoading, error } = usePasses(purchaseId)
  const [cached] = useState<TicketPassRow[] | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? 'null') as TicketPassRow[] | null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (data.length) {
      try {
        localStorage.setItem(key, JSON.stringify(data))
      } catch {
        // Quota or private mode: the wallet still works online.
      }
    }
  }, [data, key])

  const rows = data.length > 0 ? data : (cached ?? [])
  return {
    rows,
    isLoading: isLoading && !cached,
    error: error && !cached ? error : null,
    fromCache: Boolean(error && cached),
  }
}

function OrderCard({
  order,
  eventId,
  locale,
}: {
  order: TicketPurchaseRow
  eventId: string | undefined
  locale: string
}) {
  const { t } = useTranslation(['catalog', 'common'])
  const { rows, isLoading, error, fromCache } = usePassesOffline(order.id)
  const tiers = useTickets(eventId)
  const tierName =
    tiers.data.find((tier) => tier.id === order.ticket_id)?.ticket_type ?? t('ticket.tier')
  const currency = (order.currency ?? 'IDR') as Currency

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="font-medium text-card-foreground">{tierName}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('wallet.order')}{' '}
            <span className="font-mono tabular-nums">{order.order_reference ?? order.id.slice(0, 8)}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="font-medium tabular-nums text-card-foreground">
            {formatMoney(Number(order.total_amount), currency, locale)}
          </div>
          <StatusBadge status={order.payment_status} />
        </div>
      </header>

      {fromCache && (
        <p className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm text-muted-foreground">
          <WifiOff className="size-4" aria-hidden="true" />
          {t('wallet.cached')}
        </p>
      )}

      {order.payment_status === 'pending' && (
        <div className="p-4">
          <p className="font-medium text-foreground">{t('wallet.pending')}</p>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{t('wallet.pendingBody')}</p>
        </div>
      )}

      {order.payment_status !== 'pending' && (
        <div className="p-4">
          {isLoading && <div className="h-48 animate-pulse rounded-md bg-muted" aria-busy="true" />}
          {!isLoading && error && (
            <p className="text-sm text-destructive">{t('common:error.network')}</p>
          )}
          {!isLoading && !error && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {rows.map((pass, index) => (
                <li key={pass.id}>
                  <PassCard
                    pass={pass}
                    index={index + 1}
                    total={rows.length}
                    locale={locale}
                    admitted={order.payment_status === 'paid'}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation(['common'])
  if (status === 'paid') return <Badge variant="success">{t('status.paid')}</Badge>
  if (status === 'refunded') return <Badge variant="secondary">{t('status.refunded')}</Badge>
  if (status === 'cancelled') return <Badge variant="secondary">{t('status.cancelled')}</Badge>
  return <Badge variant="warning">{t('status.pending')}</Badge>
}

function PassCard({
  pass,
  index,
  total,
  locale,
  admitted,
}: {
  pass: TicketPassRow
  index: number
  total: number
  locale: string
  admitted: boolean
}) {
  const { t } = useTranslation(['catalog', 'common'])
  const [src, setSrc] = useState<string | null>(null)
  const revoked = pass.revoked_at !== null || !admitted

  useEffect(() => {
    if (revoked) return
    let alive = true
    QRCodeGenerator.generateQRCode(pass.qr_token)
      .then((url) => {
        if (alive) setSrc(url)
      })
      // Canvas unavailable (very old browser, jsdom): keep the placeholder
      // rather than taking the whole wallet down with an unhandled rejection.
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [pass.qr_token, revoked])

  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-border p-4">
      {revoked ? (
        <div className="flex h-40 w-40 items-center justify-center rounded-md bg-muted p-4 text-center">
          <span className="text-sm text-muted-foreground text-pretty">{t('wallet.revokedBody')}</span>
        </div>
      ) : src ? (
        // Left at the library's black-on-white: a QR is a contrast target, not a
        // themed surface, and tinting it breaks cheap gate scanners.
        <img
          src={src}
          alt={t('ticket.showQr')}
          width={160}
          height={160}
          className="size-40 rounded-md bg-background"
        />
      ) : (
        <div className="size-40 animate-pulse rounded-md bg-muted" />
      )}

      <p className="text-center text-sm font-medium text-foreground text-pretty">
        {pass.holder_name ?? t('wallet.holder')}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {t('wallet.passOf', { index, total })}
      </p>
      {revoked && <Badge variant="secondary">{t('wallet.revoked')}</Badge>}
      {!revoked && pass.valid_until && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {t('wallet.validUntil', {
            date: new Intl.DateTimeFormat(locale, {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(pass.valid_until)),
          })}
        </p>
      )}
    </div>
  )
}
