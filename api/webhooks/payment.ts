import { createHash } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import type { Database } from '../../src/lib/database.types'

/**
 * The payment gateway endpoint — the only server-side code in this app.
 *
 * It exists because two things cannot happen in a browser:
 *   1. Minting a hosted-checkout session needs the gateway's server key.
 *   2. Moving an order to `paid` needs the Supabase service role, because
 *      `authenticated` has no UPDATE grant on `ticket_purchases` and
 *      `circles_guard_privileged_columns` reverts `payment_status` for anyone
 *      who is not the event's organizer. That is deliberate: if a browser could
 *      write `paid`, the ledger would be fiction.
 *
 * It never inserts into `financial_transactions`. The 004 triggers
 * (`ledger_from_circle_payment`, `ledger_from_ticket_purchase`) write the
 * immutable row when `payment_status` transitions, with an idempotency key they
 * derive themselves, and their `WHEN (OLD.payment_status IS DISTINCT FROM
 * NEW.payment_status)` clause is what makes a replayed webhook a no-op.
 *
 * It can only be exercised with `vercel dev` or a deployment. `pnpm dev` is
 * Vite alone and serves no functions, so the checkout button reports the
 * endpoint as unavailable there — see PaymentProcessor.
 */

// This module reads the service role key. If a bundler ever pulls it into the
// client graph, fail at import rather than shipping the key to a browser.
if (typeof window !== 'undefined') {
  throw new Error('api/webhooks/payment.ts is server-only and must never be imported by the client.')
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

type Kind = 'circle' | 'ticket_order'

const TABLE: Record<Kind, 'circles' | 'ticket_purchases'> = {
  circle: 'circles',
  ticket_order: 'ticket_purchases',
}

// ---------------------------------------------------------------------------
// Gateway adapter — every Midtrans-specific line is in this block.
//
// Swapping to Xendit is this object plus the order-id codec below, and nothing
// else in the repo. The client only ever sees `{ redirect_url }`.
// ---------------------------------------------------------------------------

const gateway = {
  name: 'midtrans',

  baseUrl:
    process.env.MIDTRANS_IS_PRODUCTION === 'true'
      ? 'https://app.midtrans.com'
      : 'https://app.sandbox.midtrans.com',

  serverKey: process.env.MIDTRANS_SERVER_KEY ?? '',

  /** Snap: one POST, one hosted page, no card data on our side. */
  async createCheckout(input: {
    orderId: string
    amount: number
    currency: string
    itemName: string
    email: string | null
    returnUrl: string
  }): Promise<string> {
    // Snap settles in IDR only. The schema allows USD events (the Tokyo one),
    // and quietly charging those in rupiah would be a real financial bug — so
    // it is a loud 500 with the reason instead.
    if (input.currency !== 'IDR') {
      throw new Error(
        `Midtrans Snap settles IDR only; this event is priced in ${input.currency}. Point the adapter at a provider that handles it.`,
      )
    }
    // Snap rejects a fractional gross_amount. Round once, here, so the signature
    // check later compares the same string the gateway hashed.
    const gross = Math.round(input.amount)
    const response = await fetch(`${this.baseUrl}/snap/v1/transactions`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(`${this.serverKey}:`).toString('base64')}`,
      },
      body: JSON.stringify({
        transaction_details: { order_id: input.orderId, gross_amount: gross },
        item_details: [
          { id: input.orderId, price: gross, quantity: 1, name: input.itemName.slice(0, 50) },
        ],
        customer_details: input.email ? { email: input.email } : undefined,
        callbacks: { finish: input.returnUrl },
      }),
    })

    const body = (await response.json()) as { redirect_url?: string; error_messages?: string[] }
    if (!response.ok || !body.redirect_url) {
      throw new Error(body.error_messages?.join('; ') ?? `Gateway returned HTTP ${response.status}`)
    }
    return body.redirect_url
  },

  /**
   * `sha512(order_id + status_code + gross_amount + server_key)`. Without this
   * check the endpoint is an unauthenticated "mark anything paid" button.
   */
  verify(payload: Record<string, unknown>): boolean {
    const expected = createHash('sha512')
      .update(
        `${payload.order_id ?? ''}${payload.status_code ?? ''}${payload.gross_amount ?? ''}${this.serverKey}`,
      )
      .digest('hex')
    return typeof payload.signature_key === 'string' && payload.signature_key === expected
  },

  /** Gateway vocabulary → the `payment_status` CHECK domain in 001. */
  toPaymentStatus(payload: Record<string, unknown>): 'paid' | 'pending' | 'cancelled' | 'refunded' | null {
    const status = String(payload.transaction_status ?? '')
    const fraud = String(payload.fraud_status ?? '')
    if (status === 'capture') return fraud === 'challenge' ? 'pending' : 'paid'
    if (status === 'settlement') return 'paid'
    if (status === 'pending') return 'pending'
    if (status === 'deny' || status === 'cancel' || status === 'expire') return 'cancelled'
    if (status === 'refund' || status === 'partial_refund') return 'refunded'
    return null
  },
}

/**
 * Order id codec. Dots, not dashes — a uuid already contains dashes, and the
 * gateway only guarantees uniqueness per order id, so a retry after a failed
 * attempt needs a fresh suffix.
 */
const encodeOrderId = (kind: Kind, id: string) =>
  `${kind === 'circle' ? 'CIR' : 'TIX'}.${id}.${Date.now().toString(36)}`

function decodeOrderId(orderId: string): { kind: Kind; id: string } | null {
  const [prefix, id] = orderId.split('.')
  if (!id) return null
  if (prefix === 'CIR') return { kind: 'circle', id }
  if (prefix === 'TIX') return { kind: 'ticket_order', id }
  return null
}

// ---------------------------------------------------------------------------

function admin() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the deployment.')
  }
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) as Record<
    string,
    unknown
  > | null
  if (!body) return res.status(400).json({ error: 'Expected a JSON body' })

  try {
    return body.action === 'checkout'
      ? await checkout(body, req, res)
      : await notification(body, res)
  } catch (error) {
    // The gateway retries on a 5xx, which is what we want for a transient
    // failure; a bad signature is a 401 above and is never retried.
    console.error('[payment]', error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

/**
 * Browser → here → gateway. The amount is read from the database under the
 * service role and never taken from the request: a client-sent price is how a
 * Rp 450.000 space fee becomes Rp 1.
 */
async function checkout(body: Record<string, unknown>, req: VercelRequest, res: VercelResponse) {
  const kind = body.kind as Kind
  const referenceId = String(body.reference_id ?? '')
  const returnUrl = String(body.return_url ?? '')
  if (!TABLE[kind] || !referenceId) return res.status(400).json({ error: 'Unknown charge' })

  const token = String(req.headers.authorization ?? '').replace(/^Bearer /i, '')
  if (!token) return res.status(401).json({ error: 'Sign in first' })

  const db = admin()
  const { data: auth } = await db.auth.getUser(token)
  const user = auth.user
  if (!user) return res.status(401).json({ error: 'Sign in first' })

  if (kind === 'circle') {
    const { data: circle } = await db
      .from('circles')
      .select('id, user_id, circle_name, total_amount, payment_status, email, event_id')
      .eq('id', referenceId)
      .maybeSingle()
    if (!circle || circle.user_id !== user.id) return res.status(404).json({ error: 'Not found' })
    if (circle.payment_status === 'paid') return res.status(409).json({ error: 'Already paid' })

    const currency = await currencyOf(db, circle.event_id)
    const redirect_url = await gateway.createCheckout({
      orderId: encodeOrderId(kind, circle.id),
      amount: Number(circle.total_amount),
      currency,
      itemName: `Circle fee — ${circle.circle_name}`,
      email: circle.email,
      returnUrl,
    })
    return res.status(200).json({ redirect_url })
  }

  const { data: order } = await db
    .from('ticket_purchases')
    .select('id, user_id, total_amount, currency, payment_status, attendee_email, order_reference, event_id')
    .eq('id', referenceId)
    .maybeSingle()
  if (!order || order.user_id !== user.id) return res.status(404).json({ error: 'Not found' })
  if (order.payment_status === 'paid') return res.status(409).json({ error: 'Already paid' })

  const redirect_url = await gateway.createCheckout({
    orderId: encodeOrderId(kind, order.id),
    amount: Number(order.total_amount),
    currency: order.currency ?? (await currencyOf(db, order.event_id)),
    itemName: `Tickets ${order.order_reference ?? order.id}`,
    email: order.attendee_email,
    returnUrl,
  })
  return res.status(200).json({ redirect_url })
}

/** Gateway → here. The only path that writes `payment_status`. */
async function notification(body: Record<string, unknown>, res: VercelResponse) {
  if (!gateway.verify(body)) return res.status(401).json({ error: 'Bad signature' })

  const decoded = decodeOrderId(String(body.order_id ?? ''))
  if (!decoded) return res.status(400).json({ error: 'Unrecognised order id' })

  const status = gateway.toPaymentStatus(body)
  if (!status) return res.status(200).json({ ok: true, ignored: body.transaction_status })

  const db = admin()
  const table = TABLE[decoded.kind]
  // Idempotent by construction: re-sending the same notification writes the same
  // value, the ledger trigger's WHEN clause sees no transition, and no second
  // ledger row is written.
  const { error } = await db.from(table).update({ payment_status: status }).eq('id', decoded.id)

  if (error) throw new Error(error.message)
  return res.status(200).json({ ok: true })
}

async function currencyOf(db: ReturnType<typeof admin>, eventId: string): Promise<string> {
  const { data } = await db.from('events').select('currency').eq('id', eventId).maybeSingle()
  return data?.currency ?? 'IDR'
}

function safeParse(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}
