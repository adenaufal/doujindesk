import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router-dom'

import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { formatMoney } from '@/lib/money'
import { useCircle, useEvent, usePurchaseTickets, useTickets } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/**
 * Hand-off to the payment gateway, and the state of a payment on the way back.
 *
 * What this component deliberately does NOT do:
 *   - hold card details. Four inputs here used to collect the card number,
 *     expiry, security code and cardholder name. A PAN in the DOM puts the whole
 *     application in PCI-DSS SAQ-D scope; a hosted checkout keeps it in SAQ-A.
 *     They are gone and must not come back.
 *   - decide that a payment succeeded. A three-second timer used to report
 *     success unconditionally, so the app could not fail a payment and had no
 *     failure path at all. Only `api/webhooks/payment.ts` — the gateway's own
 *     signed callback — moves a row to `paid`.
 *   - compute a total. The amount comes from `circles.total_amount` (priced by
 *     the 004 trigger from `event_pricing`) or from `purchase_tickets()`, both
 *     server-side.
 *
 * Provider: Midtrans Snap, the default for IDR in Indonesia. Every
 * provider-specific line lives in the adapter inside `api/webhooks/payment.ts`;
 * this file only knows "POST to the checkout endpoint, then go where it says".
 */

/** Where the gateway sends the browser back to. Snap appends its own query. */
const RETURN_PARAM = 'transaction_status'

type Phase = 'idle' | 'redirecting' | 'failed'

export interface PaymentProcessorProps {
  /** An accepted circle application paying its space fee. */
  circleId?: string
  /** An existing ticket order created by `purchase_tickets()`. */
  purchaseId?: string
  /**
   * ponytail: the tier-and-quantity entry point, kept because `TicketingSystem`
   * (owned by P13, rewritten in this same wave) still calls it that way. A tier
   * id is not an order, so this path calls `purchase_tickets()` first. Delete
   * these two props once the checkout screen passes a `purchaseId`.
   */
  ticketTypeId?: string
  quantity?: number
  onPaymentComplete?: (reference: string) => void
  onCancel?: () => void
}

export default function PaymentProcessor({
  circleId,
  purchaseId,
  ticketTypeId,
  quantity = 1,
  onPaymentComplete,
  onCancel,
}: PaymentProcessorProps) {
  const { eventId } = useParams()
  const { t, i18n } = useTranslation(['circle', 'common'])
  const [params] = useSearchParams()
  const userId = useAuthStore((s) => s.user?.id ?? null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [failure, setFailure] = useState<string | null>(null)

  const { data: event } = useEvent(eventId)
  const { data: circle } = useCircle(circleId)
  const { data: tiers } = useTickets(ticketTypeId ? eventId : undefined)
  const purchase = usePurchaseTickets(eventId ?? '', userId ?? undefined)

  const currency = event?.currency ?? 'IDR'
  const tier = tiers.find((x) => x.id === ticketTypeId) ?? null

  const amount = circle
    ? Number(circle.total_amount)
    : tier
      ? Number(tier.price) * quantity
      : null
  const label = circle?.circle_name ?? tier?.ticket_type ?? ''

  // The gateway sends the browser back with its own result on the query string.
  // It is a hint for the UI only — the webhook is what moves money.
  const returned = params.get(RETURN_PARAM)
  if (returned) {
    const settled = returned === 'settlement' || returned === 'capture'
    const waiting = returned === 'pending'
    return (
      <EmptyState
        icon={settled ? CheckCircle2 : waiting ? Clock : AlertTriangle}
        title={
          settled
            ? t('common:status.paid')
            : waiting
              ? t('common:status.pending')
              : t('common:error.generic')
        }
        description={
          settled
            ? t('status.title')
            : waiting
              ? 'The gateway has your payment and is confirming it. This page updates once it does.'
              : 'The payment did not go through. Nothing was charged — you can try again.'
        }
        action={
          settled ? undefined : (
            <Button onClick={() => void start()}>{t('common:error.tryAgain')}</Button>
          )
        }
      />
    )
  }

  if (amount === null) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t('common:error.notFound')}
        description={t('common:empty.noData.description')}
        action={onCancel ? <Button variant="outline" onClick={onCancel}>{t('common:action.cancel')}</Button> : undefined}
      />
    )
  }

  async function start() {
    setPhase('redirecting')
    setFailure(null)
    try {
      let target = circleId
        ? { kind: 'circle' as const, referenceId: circleId }
        : purchaseId
          ? { kind: 'ticket_order' as const, referenceId: purchaseId }
          : null

      // Tier + quantity: the order has to exist before it can be paid for, and
      // `purchase_tickets` is the only write path into `ticket_purchases`.
      if (!target && ticketTypeId) {
        const order = await purchase.mutateAsync({ ticketId: ticketTypeId, quantity })
        onPaymentComplete?.(order.order_reference ?? order.order_id)
        target = { kind: 'ticket_order', referenceId: order.order_id }
      }
      if (!target) throw new Error('Nothing to pay for.')

      const { data } = await supabase.auth.getSession()
      const response = await fetch('/api/webhooks/payment', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${data.session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          action: 'checkout',
          kind: target.kind,
          reference_id: target.referenceId,
          return_url: window.location.href,
        }),
      })

      const body = (await response.json().catch(() => null)) as { redirect_url?: string; error?: string } | null
      if (!response.ok || !body?.redirect_url) {
        throw new Error(
          body?.error ??
            `Checkout is unavailable (HTTP ${response.status}). The gateway handoff is a serverless function — it runs under \`vercel dev\` or a deployment, never \`pnpm dev\`.`,
        )
      }
      window.location.assign(body.redirect_url)
    } catch (err) {
      setPhase('failed')
      setFailure(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-muted-foreground text-pretty">{label}</span>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {formatMoney(amount, currency, i18n.language)}
        </span>
      </div>

      {/* No fee table: the processing fee is the gateway's to state, and an
          invented percentage on this screen is a number nobody can reconcile.
          Snap's own page carries the channel list and any surcharge. */}
      <p className="text-sm text-muted-foreground">
        Card, bank transfer (BCA / Mandiri / BNI virtual account), GoPay and QRIS are
        accepted on the gateway's page.
      </p>

      {failure && (
        <p role="alert" className="rounded-md bg-destructive-subtle p-3 text-sm text-destructive">
          {failure}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          className="sm:flex-1"
          disabled={phase === 'redirecting'}
          onClick={() => void start()}
        >
          <ExternalLink aria-hidden="true" />
          {phase === 'redirecting'
            ? t('common:status.loading')
            : `${t('status.payNow')} · ${formatMoney(amount, currency, i18n.language)}`}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            {t('common:action.cancel')}
          </Button>
        )}
      </div>
    </div>
  )
}
