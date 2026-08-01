/**
 * The demo Supabase client — the ONE seam.
 *
 * `src/lib/supabase.ts` exports either the real `createClient<Database>` or this,
 * decided once by `VITE_DEMO_MODE`. Nothing downstream branches: a query hook, a
 * store, the Dexie scan queue and every component call the same methods either
 * way. If you ever write `if (demoMode)` inside a component, the seam is in the
 * wrong place — fix it here instead.
 *
 * Scope, stated so nobody is surprised at 2am:
 *   - `select()` projection is IGNORED. Whole rows come back, which is a superset
 *     of what was asked for. Embedded relations (`tickets ( ticket_type )`) are
 *     therefore whatever the fixture row carries — put the nested object in the
 *     fixture.
 *   - Filters implemented: eq neq gt gte lt lte like ilike in is contains
 *     overlaps match not or. Anything else throws loudly rather than silently
 *     returning the wrong rows.
 *   - RLS does not exist here. Demo mode shows the shape of the app, never its
 *     access control; that is the database's job and it is tested in SQL.
 *
 * ponytail: a hand-rolled PostgREST subset, ~1 file. Upgrade path if it ever
 * strains — `supabase start` and a local Postgres — costs Docker on the owner's
 * laptop, which is exactly what this avoids.
 */
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import type { PendingScan, RedeemResult, ScanResultCode } from '../scanContract'
import { emit, isView, onChange, rowsOf, tables, type ChangeEvent } from './store'

type Row = Record<string, unknown>
type Result<T> = { data: T; error: PostgrestErrorLike | null; count: number | null; status: number }
type PostgrestErrorLike = { message: string; code: string; details: string; hint: string }

const ok = <T>(data: T, count: number | null = null): Result<T> => ({
  data,
  error: null,
  count,
  status: 200,
})
const fail = (message: string, code = 'PGRST000'): Result<null> => ({
  data: null,
  error: { message, code, details: '', hint: '' },
  count: null,
  status: 400,
})

const uuid = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  '00000000-0000-4000-8000-' + Math.floor(Math.random() * 1e12).toString(16).padStart(12, '0')

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

type Filter = (row: Row) => boolean

const norm = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : v)
const likeToRe = (pattern: string, flags: string) =>
  new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', flags)

function makeFilter(column: string, op: string, value: unknown): Filter {
  switch (op) {
    case 'eq':
      return (r) => String(r[column]) === String(value)
    case 'neq':
      return (r) => String(r[column]) !== String(value)
    case 'gt':
      return (r) => (r[column] as number) > (value as number)
    case 'gte':
      return (r) => (r[column] as number) >= (value as number)
    case 'lt':
      return (r) => (r[column] as number) < (value as number)
    case 'lte':
      return (r) => (r[column] as number) <= (value as number)
    case 'like':
      return (r) => likeToRe(String(value), '').test(String(r[column] ?? ''))
    case 'ilike':
      return (r) => likeToRe(String(value), 'i').test(String(r[column] ?? ''))
    case 'in': {
      const set = new Set(
        (Array.isArray(value) ? value : String(value).replace(/^\(|\)$/g, '').split(',')).map(String),
      )
      return (r) => set.has(String(r[column]))
    }
    case 'is':
      return (r) =>
        value === null || value === 'null' ? r[column] == null : r[column] === value
    case 'cs':
    case 'contains': {
      const needles = Array.isArray(value) ? value : [value]
      return (r) => {
        const have = (r[column] as unknown[]) ?? []
        return needles.every((n) => have.map(norm).includes(norm(n)))
      }
    }
    case 'ov':
    case 'overlaps': {
      const needles = Array.isArray(value) ? value : [value]
      return (r) => {
        const have = (r[column] as unknown[]) ?? []
        return needles.some((n) => have.map(norm).includes(norm(n)))
      }
    }
    default:
      throw new Error(
        `[demo] filter "${op}" is not implemented. Add it in src/lib/demo/client.ts rather than working around it in a component.`,
      )
  }
}

/** `or('a.eq.1,b.is.null')` — one level, no nested and(). */
function orFilter(expression: string): Filter {
  const parts = expression.split(',').map((clause) => {
    const [column, op, ...rest] = clause.split('.')
    return makeFilter(column, op, rest.join('.'))
  })
  return (row) => parts.some((p) => p(row))
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

type Op = 'select' | 'insert' | 'update' | 'delete' | 'upsert'

class DemoQuery<T = Row[]> implements PromiseLike<Result<T>> {
  private filters: Filter[] = []
  private sorts: { column: string; asc: boolean }[] = []
  private limitN: number | null = null
  private offset = 0
  private op: Op = 'select'
  private payload: Row[] = []
  private returning = false
  private head = false
  private wantCount = false
  private mode: 'many' | 'single' | 'maybe' = 'many'

  constructor(private readonly table: string) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      this.wantCount = Boolean(options?.count)
      this.head = Boolean(options?.head)
    } else {
      this.returning = true
    }
    return this
  }

  insert(values: Row | Row[]) {
    this.op = 'insert'
    this.payload = Array.isArray(values) ? values : [values]
    return this
  }

  upsert(values: Row | Row[]) {
    this.op = 'upsert'
    this.payload = Array.isArray(values) ? values : [values]
    return this
  }

  update(values: Row) {
    this.op = 'update'
    this.payload = [values]
    return this
  }

  delete() {
    this.op = 'delete'
    return this
  }

  eq(column: string, value: unknown) { return this.where('eq', column, value) }
  neq(column: string, value: unknown) { return this.where('neq', column, value) }
  gt(column: string, value: unknown) { return this.where('gt', column, value) }
  gte(column: string, value: unknown) { return this.where('gte', column, value) }
  lt(column: string, value: unknown) { return this.where('lt', column, value) }
  lte(column: string, value: unknown) { return this.where('lte', column, value) }
  like(column: string, value: string) { return this.where('like', column, value) }
  ilike(column: string, value: string) { return this.where('ilike', column, value) }
  in(column: string, value: unknown[]) { return this.where('in', column, value) }
  is(column: string, value: unknown) { return this.where('is', column, value) }
  contains(column: string, value: unknown) { return this.where('contains', column, value) }
  overlaps(column: string, value: unknown) { return this.where('overlaps', column, value) }
  filter(column: string, op: string, value: unknown) { return this.where(op, column, value) }

  not(column: string, op: string, value: unknown) {
    const inner = makeFilter(column, op, value)
    this.filters.push((row) => !inner(row))
    return this
  }

  or(expression: string) {
    this.filters.push(orFilter(expression))
    return this
  }

  match(criteria: Row) {
    for (const [column, value] of Object.entries(criteria)) this.where('eq', column, value)
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sorts.push({ column, asc: options?.ascending !== false })
    return this
  }

  limit(n: number) {
    this.limitN = n
    return this
  }

  range(from: number, to: number) {
    this.offset = from
    this.limitN = to - from + 1
    return this
  }

  single() {
    this.mode = 'single'
    return this as unknown as DemoQuery<Row>
  }

  maybeSingle() {
    this.mode = 'maybe'
    return this as unknown as DemoQuery<Row | null>
  }

  /** supabase-js exposes this; nothing in the app depends on the shape. */
  throwOnError() {
    return this
  }

  private where(op: string, column: string, value: unknown) {
    this.filters.push(makeFilter(column, op, value))
    return this
  }

  private matching(source: Row[]): Row[] {
    return source.filter((row) => this.filters.every((f) => f(row)))
  }

  private run(): Result<unknown> {
    if (this.op !== 'select' && isView(this.table)) {
      return fail(`cannot ${this.op} a view (${this.table})`, '42809')
    }

    const now = new Date().toISOString()
    let result: Row[]

    switch (this.op) {
      case 'insert':
      case 'upsert': {
        result = this.payload.map((values) => {
          const row: Row = { id: uuid(), created_at: now, updated_at: now, ...values }
          const existing =
            this.op === 'upsert' ? tables[this.table]?.findIndex((r) => r.id === row.id) : -1
          if (existing !== undefined && existing >= 0) {
            Object.assign(tables[this.table][existing], values, { updated_at: now })
            emit(this.table, 'UPDATE', tables[this.table][existing])
            return tables[this.table][existing]
          }
          rowsOf(this.table).push(row)
          emit(this.table, 'INSERT', row)
          return row
        })
        break
      }
      case 'update': {
        result = this.matching(rowsOf(this.table))
        for (const row of result) {
          Object.assign(row, this.payload[0], { updated_at: now })
          emit(this.table, 'UPDATE', row)
        }
        break
      }
      case 'delete': {
        result = this.matching(rowsOf(this.table))
        tables[this.table] = rowsOf(this.table).filter((r) => !result.includes(r))
        for (const row of result) emit(this.table, 'DELETE', row)
        break
      }
      default: {
        result = this.matching(rowsOf(this.table))
        for (const { column, asc } of [...this.sorts].reverse()) {
          result = [...result].sort((a, b) => {
            const x = a[column] as never
            const y = b[column] as never
            if (x === y) return 0
            if (x == null) return 1
            if (y == null) return -1
            return (x < y ? -1 : 1) * (asc ? 1 : -1)
          })
        }
      }
    }

    const total = result.length
    if (this.op === 'select' && (this.offset || this.limitN !== null)) {
      result = result.slice(this.offset, this.limitN === null ? undefined : this.offset + this.limitN)
    }

    if (this.mode === 'single' || this.mode === 'maybe') {
      if (result.length === 1) return ok(clone(result[0]))
      if (result.length === 0 && this.mode === 'maybe') return ok(null)
      return {
        ...fail(
          result.length === 0
            ? 'JSON object requested, multiple (or no) rows returned'
            : `more than one row returned (${result.length})`,
          'PGRST116',
        ),
        status: 406,
      }
    }

    if (this.op !== 'select' && !this.returning) return ok(null, this.wantCount ? total : null)
    if (this.head) return ok(null, total)
    return ok(clone(result), this.wantCount ? total : null)
  }

  then<A = Result<T>, B = never>(
    onfulfilled?: ((value: Result<T>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run() as Result<T>)
      .then(onfulfilled, onrejected)
  }
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

// ---------------------------------------------------------------------------
// Auth — the demo role picker's back end
// ---------------------------------------------------------------------------

const SESSION_KEY = 'doujindesk.demo.user'
type AuthListener = (event: string, session: Session | null) => void
const authListeners = new Set<AuthListener>()
let session: Session | null = null

function buildSession(userId: string): Session {
  const profile = tables.profiles.find((p) => p.id === userId)
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: (profile?.email as string) ?? 'demo@doujindesk.local',
    app_metadata: { provider: 'demo' },
    user_metadata: { display_name: profile?.display_name ?? 'Demo user' },
    created_at: (profile?.created_at as string) ?? new Date().toISOString(),
  } as unknown as User

  return {
    access_token: 'demo-access-token',
    refresh_token: 'demo-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  } as Session
}

/** Sign in as a fixture user, no password. Only reachable when demo mode is on. */
export function demoSignInAs(userId: string): void {
  session = buildSession(userId)
  try {
    localStorage.setItem(SESSION_KEY, userId)
  } catch {
    /* private mode; the session just does not survive a reload */
  }
  for (const fn of authListeners) fn('SIGNED_IN', session)
}

export function demoCurrentUserId(): string | null {
  return (session?.user.id as string) ?? null
}

function restore(): void {
  try {
    const id = localStorage.getItem(SESSION_KEY)
    if (id && tables.profiles.some((p) => p.id === id)) session = buildSession(id)
  } catch {
    /* ignore */
  }
}
restore()

// ---------------------------------------------------------------------------
// RPCs — the two SECURITY DEFINER functions the app actually calls
// ---------------------------------------------------------------------------

/** Mirrors `public.redeem_tickets` in 003, including the duplicate path. */
function redeemTickets(scans: PendingScan[]): RedeemResult[] {
  return scans.map((scan) => {
    const replay = tables.ticket_scans.find((s) => s.client_scan_id === scan.client_scan_id)
    if (replay) return scanResult(replay)

    const pass = tables.ticket_passes.find((p) => p.qr_token === scan.qr_token)
    const purchase = pass
      ? tables.ticket_purchases.find((p) => p.id === pass.purchase_id)
      : undefined

    let result: ScanResultCode
    if (!pass) result = 'not_found'
    else if (pass.event_id !== scan.event_id) result = 'wrong_event'
    else if (pass.revoked_at) result = 'revoked'
    else if (purchase?.payment_status !== 'paid') result = 'unpaid'
    else if (
      (pass.valid_from && scan.scanned_at < String(pass.valid_from)) ||
      (pass.valid_until && scan.scanned_at >= String(pass.valid_until))
    )
      result = 'outside_window'
    else result = 'admitted'

    // one_admission_per_pass: an entry admission already exists for this pass.
    let conflictWith: Row | undefined
    if (result === 'admitted') {
      conflictWith = tables.ticket_scans.find(
        (s) => s.pass_id === pass!.id && s.result === 'admitted' && s.scan_type === 'entry',
      )
      if (conflictWith && scan.scan_type !== 'reentry') result = 'duplicate'
    }

    const row: Row = {
      id: uuid(),
      event_id: scan.event_id,
      pass_id: pass?.id ?? null,
      scanned_code: scan.qr_token,
      scan_type: scan.scan_type ?? 'entry',
      result,
      gate_id: scan.gate_id ?? null,
      device_id: scan.device_id,
      scanned_by: demoCurrentUserId(),
      scanned_at: scan.scanned_at,
      synced_at: new Date().toISOString(),
      offline: scan.offline ?? false,
      client_scan_id: scan.client_scan_id,
      conflict_with: result === 'duplicate' ? (conflictWith?.id ?? null) : null,
    }
    tables.ticket_scans.push(row)
    emit('ticket_scans', 'INSERT', row)

    if (result === 'admitted') bumpCounter(scan.event_id)
    return scanResult(row)
  })
}

/** `public.scan_result_json` — one builder, so a replay and a fresh scan match. */
function scanResult(row: Row): RedeemResult {
  const winner = row.conflict_with
    ? tables.ticket_scans.find((s) => s.id === row.conflict_with)
    : undefined
  return {
    client_scan_id: row.client_scan_id as string,
    result: row.result as ScanResultCode,
    scan_id: row.id as string,
    admitted_at: row.result === 'admitted' ? (row.scanned_at as string) : null,
    conflicting_device: (winner?.device_id as string) ?? null,
    conflicting_scanned_at: (winner?.scanned_at as string) ?? null,
    conflicting_gate: (winner?.gate_id as string) ?? null,
  }
}

/** The AFTER INSERT trigger on ticket_scans in 005. Entry only — reentry must not inflate. */
function bumpCounter(eventId: string): void {
  const counter = tables.event_counters.find((c) => c.event_id === eventId)
  if (!counter) return
  counter.admitted_count = (counter.admitted_count as number) + 1
  counter.updated_at = new Date().toISOString()
  emit('event_counters', 'UPDATE', counter)
}

/** Mirrors `public.purchase_tickets` in 004: server-side price, oversell guard, one pass per head. */
function purchaseTickets(args: {
  p_ticket_id: string
  p_quantity: number
  p_holder_names?: string[] | null
}): Row {
  const tier = tables.tickets.find((t) => t.id === args.p_ticket_id)
  if (!tier) throw new Error('purchase_tickets: ticket tier not found')
  const quantity = args.p_quantity
  if (!quantity || quantity < 1 || quantity > 20)
    throw new Error(`purchase_tickets: quantity must be between 1 and 20, got ${quantity}`)

  const sold = tier.quantity_sold as number
  const available = tier.quantity_available as number
  if (sold + quantity > available) throw new Error('purchase_tickets: not enough tickets remaining')

  const now = new Date().toISOString()
  const earlyBird =
    tier.early_bird_price != null && tier.early_bird_end != null && now < String(tier.early_bird_end)
  const unit = Number(earlyBird ? tier.early_bird_price : tier.price)
  const userId = demoCurrentUserId()
  const profile = tables.profiles.find((p) => p.id === userId)

  tier.quantity_sold = sold + quantity
  if (tier.quantity_sold === available) tier.status = 'sold_out'

  const order: Row = {
    id: uuid(),
    event_id: tier.event_id,
    ticket_id: tier.id,
    user_id: userId,
    quantity,
    unit_price: unit,
    total_amount: unit * quantity,
    currency: tier.currency,
    order_reference: 'CF19-' + uuid().slice(0, 6).toUpperCase(),
    payment_status: 'pending',
    qr_code: null,
    rfid_code: null,
    attendee_name: (profile?.display_name as string) ?? null,
    attendee_email: (profile?.email as string) ?? null,
    attendee_phone: null,
    check_in_time: null,
    cancelled_at: null,
    refunded_at: null,
    created_at: now,
    updated_at: now,
  }
  tables.ticket_purchases.push(order)
  emit('ticket_purchases', 'INSERT', order)

  const passes = Array.from({ length: quantity }, (_, i) => {
    const pass: Row = {
      id: uuid(),
      purchase_id: order.id,
      event_id: tier.event_id,
      qr_token: uuid(),
      holder_name: args.p_holder_names?.[i] ?? (profile?.display_name as string) ?? null,
      tier_id: tier.id,
      valid_from: tier.valid_from ?? null,
      valid_until: tier.valid_until ?? null,
      revoked_at: null,
      created_at: now,
      tickets: { ticket_type: tier.ticket_type },
    }
    tables.ticket_passes.push(pass)
    return pass
  })

  // The ledger row a trigger writes on the payment_status transition. Demo orders
  // land `pending`, so this one is pending too — never a completed sale.
  const ledger: Row = {
    id: uuid(),
    event_id: tier.event_id,
    transaction_type: 'ticket_sale',
    direction: 'credit',
    reference_id: order.id,
    reference_table: 'ticket_purchases',
    amount: order.total_amount,
    currency: tier.currency,
    payment_method: null,
    payment_gateway: null,
    gateway_transaction_id: null,
    idempotency_key: null,
    status: 'pending',
    description: `${tier.ticket_type} × ${quantity}`,
    metadata: {},
    occurred_at: now,
    reverses_transaction_id: null,
    created_by: userId,
    created_at: now,
    updated_at: now,
  }
  tables.financial_transactions.push(ledger)
  emit('financial_transactions', 'INSERT', ledger)

  return {
    order_id: order.id,
    order_reference: order.order_reference,
    quantity,
    unit_price: unit,
    total_amount: order.total_amount,
    currency: tier.currency,
    passes: passes.map((p) => ({ id: p.id, qr_token: p.qr_token, holder_name: p.holder_name })),
  }
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

function makeChannel() {
  let unsubscribe: (() => void) | null = null
  const handlers: { table?: string; filter?: string; cb: (payload: unknown) => void }[] = []

  const channel = {
    on(_type: string, config: { table?: string; filter?: string }, cb: (payload: unknown) => void) {
      handlers.push({ table: config?.table, filter: config?.filter, cb })
      return channel
    },
    subscribe(cb?: (status: string) => void) {
      unsubscribe = onChange((table, event: ChangeEvent, row) => {
        for (const h of handlers) {
          if (h.table && h.table !== table) continue
          if (h.filter) {
            const [column, , value] = h.filter.split(/[.=]/).filter(Boolean)
            if (String(row[column]) !== value) continue
          }
          h.cb({ eventType: event, schema: 'public', table, new: row, old: row })
        }
      })
      cb?.('SUBSCRIBED')
      return channel
    },
    unsubscribe() {
      unsubscribe?.()
      unsubscribe = null
      return Promise.resolve('ok')
    },
  }
  return channel
}

const rpcHandlers: Record<string, (args: never) => unknown> = {
  redeem_tickets: (args: { p_scans: PendingScan[] }) => redeemTickets(args.p_scans ?? []),
  purchase_tickets: purchaseTickets,
}

export const demoClient = {
  from: (table: string) => new DemoQuery(table),

  rpc: (name: string, args?: Record<string, unknown>) => {
    const handler = rpcHandlers[name]
    return Promise.resolve().then(() => {
      if (!handler)
        return fail(
          `[demo] RPC "${name}" is not implemented. Add it in src/lib/demo/client.ts.`,
          'PGRST202',
        )
      try {
        return ok(handler((args ?? {}) as never))
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error), 'P0001')
      }
    })
  },

  auth: {
    getSession: () => Promise.resolve({ data: { session }, error: null }),
    getUser: () => Promise.resolve({ data: { user: session?.user ?? null }, error: null }),
    signInWithPassword: () =>
      Promise.resolve({
        data: { session: null, user: null },
        error: {
          message: 'Demo mode: use the role picker in the demo banner.',
          name: 'AuthApiError',
          status: 400,
        },
      }),
    signUp: () =>
      Promise.resolve({
        data: { session: null, user: null },
        error: {
          message: 'Demo mode: use the role picker in the demo banner.',
          name: 'AuthApiError',
          status: 400,
        },
      }),
    signOut: () => {
      session = null
      try {
        localStorage.removeItem(SESSION_KEY)
      } catch {
        /* ignore */
      }
      for (const fn of authListeners) fn('SIGNED_OUT', null)
      return Promise.resolve({ error: null })
    },
    onAuthStateChange: (cb: AuthListener) => {
      authListeners.add(cb)
      return {
        data: {
          subscription: {
            id: 'demo',
            callback: cb,
            unsubscribe: () => authListeners.delete(cb),
          },
        },
      }
    },
  },

  channel: makeChannel,
  removeChannel: (channel: { unsubscribe: () => Promise<string> }) => channel.unsubscribe(),

  storage: {
    from: () => ({
      // Object URLs are enough to preview an upload; nothing leaves the tab.
      upload: (path: string, file: Blob) =>
        Promise.resolve({ data: { path, fullPath: URL.createObjectURL(file) }, error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
      createSignedUrl: (path: string) =>
        Promise.resolve({ data: { signedUrl: path }, error: null }),
      remove: () => Promise.resolve({ data: [], error: null }),
    }),
  },
} as unknown as SupabaseClient<Database>
