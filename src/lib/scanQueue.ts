/**
 * The offline scan queue — success criterion 3.
 *
 * Every scan is written to IndexedDB BEFORE anything touches the network, and
 * the network is only ever a batched replay of what is already on disk. That
 * ordering is the whole design: a phone that loses wifi, gets force-quit, or
 * runs out of battery between the beep and the sync has already persisted the
 * scan, and `flush()` picks it up on the next launch.
 *
 * The two guarantees that make a replay safe live in the database
 * (`003_scanning.sql`), not here:
 *   UNIQUE (client_scan_id)  → flushing the same batch four times inserts once.
 *   one_admission_per_pass   → two phones that both admitted pass X offline
 *                              cannot both win; the loser comes back
 *                              `duplicate` with the winner's device, gate and
 *                              time attached.
 * This module's job is to keep the queue honest and to surface the loser as a
 * conflict the operator has to acknowledge, never as a toast that fades.
 *
 * Deliberately NOT used: React Query's offline mutation persistence (a cache
 * warm-start feature — it cannot survive an app kill mid-queue and has no
 * vocabulary for "another device already redeemed this pass") and Background
 * Sync (iOS Safari does not implement it, so half the venue's phones would
 * silently never sync).
 */

import Dexie, { type Table } from 'dexie'
import { useCallback, useSyncExternalStore } from 'react'
import type { LocalCheck, PendingScan, RedeemResult, ScanType } from './scanContract'
import { supabase } from './supabase'

export type SyncState = 'pending' | 'synced' | 'conflict'

/** A `PendingScan` plus everything the device needs to track its fate. */
export interface QueuedScan extends PendingScan {
  sync_state: SyncState
  /** The server's answer, once there is one. */
  server_result: RedeemResult | null
}

/**
 * One row of the pre-doors ticket snapshot. Holder name and tier are here so an
 * offline admission can still show the operator who they just let in — the
 * point of a mirror is that the door does not go blind when the wifi does.
 */
export interface MirrorRow {
  qr_token: string
  event_id: string
  holder_name: string | null
  tier_name: string | null
}

export interface MirrorMeta {
  event_id: string
  downloaded_at: string
  count: number
}

class ScanDB extends Dexie {
  pendingScans!: Table<QueuedScan, string>
  ticketMirror!: Table<MirrorRow, string>
  mirrorMeta!: Table<MirrorMeta, string>

  constructor() {
    super('doujindesk-scans')
    this.version(1).stores({
      pendingScans: 'client_scan_id, sync_state, qr_token, event_id',
      ticketMirror: 'qr_token, event_id',
      mirrorMeta: 'event_id',
    })
  }
}

export const db = new ScanDB()

// ---------------------------------------------------------------------------
// Device identity
// ---------------------------------------------------------------------------

const DEVICE_KEY = 'doujindesk.device_id'

/**
 * Stable per-install id. It is what a conflict names ("first scanned by
 * GATE-A / device 3f2a…"), so it has to outlive a page reload; localStorage is
 * enough, and a private-mode failure degrades to a per-session id rather than
 * breaking the door.
 */
export function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, fresh)
    return fresh
  } catch {
    return sessionDeviceId
  }
}
const sessionDeviceId = crypto.randomUUID()

// ---------------------------------------------------------------------------
// Enqueue — the hot path. Never awaits the network.
// ---------------------------------------------------------------------------

export interface ScanInput {
  event_id: string
  qr_token: string
  gate_id?: string | null
  scan_type?: ScanType
}

/**
 * Persist a scan. Returns the stored row, including the `client_scan_id` the
 * caller needs to match a later `RedeemResult` against.
 *
 * There is no network call in here at all, not even a conditional one: the
 * operator is holding up a queue of four hundred people and the scan must be
 * durable in single-digit milliseconds whatever the wifi is doing. Syncing is
 * `flush()`'s problem.
 */
export async function enqueue(input: ScanInput): Promise<QueuedScan> {
  const row: QueuedScan = {
    client_scan_id: crypto.randomUUID(),
    event_id: input.event_id,
    qr_token: input.qr_token,
    scanned_at: new Date().toISOString(),
    gate_id: input.gate_id ?? null,
    device_id: deviceId(),
    scan_type: input.scan_type ?? 'entry',
    offline: !navigator.onLine,
    sync_state: 'pending',
    server_result: null,
  }
  await db.pendingScans.add(row)
  notify()
  return row
}

// ---------------------------------------------------------------------------
// Local check — what this device can work out on its own
// ---------------------------------------------------------------------------

/**
 * Mirror lookup + "did this device already admit this token".
 *
 * Returns `null` only when there is genuinely nothing to say: no mirror for the
 * event AND no earlier scan of this token here. With no mirror but a local
 * admission we still answer, because catching the operator scanning the same
 * badge twice is the check that matters most at a door and it does not need a
 * mirror to work. `known: false` is only ever returned when a mirror exists and
 * does not contain the token — an actual rejection, not an absence of data.
 */
export async function checkLocal(qrToken: string, eventId: string): Promise<LocalCheck | null> {
  const [mirror, prior, mirrored] = await Promise.all([
    db.ticketMirror.get(qrToken),
    db.pendingScans.where('qr_token').equals(qrToken).toArray(),
    hasMirror(eventId),
  ])

  // An earlier entry scan on this device that has not been rejected: either it
  // is still queued (we believe it admitted) or the server confirmed it did.
  const admittedHere = prior.find(
    (scan) =>
      scan.scan_type === 'entry' &&
      scan.event_id === eventId &&
      (scan.sync_state === 'pending' || scan.server_result?.result === 'admitted'),
  )

  if (!mirrored && !admittedHere) return null

  return {
    known: mirrored ? Boolean(mirror) : true,
    alreadyAdmittedHere: Boolean(admittedHere),
    holder_name: mirror?.holder_name ?? null,
    tier_name: mirror?.tier_name ?? null,
    admittedHereAt: admittedHere?.scanned_at ?? null,
    device_id: admittedHere?.device_id ?? null,
    gate_id: admittedHere?.gate_id ?? null,
  }
}

// ---------------------------------------------------------------------------
// Ticket mirror — downloaded before doors open
// ---------------------------------------------------------------------------

export async function hasMirror(eventId: string): Promise<boolean> {
  return (await db.mirrorMeta.get(eventId)) !== undefined
}

export async function getMirrorMeta(eventId: string): Promise<MirrorMeta | undefined> {
  return db.mirrorMeta.get(eventId)
}

/**
 * Pull every pass for the event into IndexedDB so an offline scan can reject an
 * unknown code instead of waving through anything that decodes.
 *
 * ponytail: one unpaginated select, capped by PostgREST's default 1000-row
 * limit, so an event with more passes than that mirrors only the first page.
 * Upgrade path is a `.range()` loop keyed on `created_at` — worth writing the
 * day an organizer sells 1000+ passes, not before.
 */
export async function downloadMirror(eventId: string): Promise<MirrorMeta> {
  const { data, error } = await supabase
    .from('ticket_passes')
    .select('qr_token, holder_name, tickets ( ticket_type )')
    .eq('event_id', eventId)

  if (error) throw error

  const rows: MirrorRow[] = (data ?? []).map((pass: Record<string, unknown>) => ({
    qr_token: String(pass.qr_token),
    event_id: eventId,
    holder_name: (pass.holder_name as string | null) ?? null,
    tier_name: tierName(pass.tickets),
  }))

  const meta: MirrorMeta = {
    event_id: eventId,
    downloaded_at: new Date().toISOString(),
    count: rows.length,
  }

  await db.transaction('rw', db.ticketMirror, db.mirrorMeta, async () => {
    await db.ticketMirror.where('event_id').equals(eventId).delete()
    await db.ticketMirror.bulkPut(rows)
    await db.mirrorMeta.put(meta)
  })

  notify()
  return meta
}

/** PostgREST embeds a to-one relation as an object; older versions as a 1-array. */
function tierName(embedded: unknown): string | null {
  const one = Array.isArray(embedded) ? embedded[0] : embedded
  const value = (one as { ticket_type?: unknown } | undefined)?.ticket_type
  return typeof value === 'string' ? value : null
}

// ---------------------------------------------------------------------------
// Flush — the only place the queue meets the network
// ---------------------------------------------------------------------------

/**
 * ponytail: fixed batch of 50 per RPC call, batches sent sequentially. One
 * round trip per 50 scans is the right shape for venue wifi, and sequential
 * keeps the `one_admission_per_pass` conflict ordering deterministic. Upgrade
 * path if a 5,000-scan backlog ever feels slow: a cursor over `scanned_at` and
 * two calls in flight.
 */
const BATCH = 50

let inFlight: Promise<RedeemResult[]> | null = null

/**
 * Drain every `pending` row. Idempotent: a row the server has already seen comes
 * back with the answer it gave the first time, because `UNIQUE(client_scan_id)`
 * turns a replay into a lookup rather than a second admission.
 *
 * Never throws for a network failure — the rows simply stay `pending` and the
 * next `online`/focus event tries again. It does throw nothing at all, in fact:
 * a door scanner that pops an exception dialog mid-shift is worse than a chip
 * that says "12 queued".
 */
export function flush(): Promise<RedeemResult[]> {
  // Both the `online` event and app focus can fire at once. Coalesce, or two
  // drains race to send the same rows.
  if (inFlight) return inFlight
  inFlight = drain().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function drain(): Promise<RedeemResult[]> {
  const resolved: RedeemResult[] = []

  for (;;) {
    const batch = await db.pendingScans.where('sync_state').equals('pending').limit(BATCH).toArray()
    if (batch.length === 0) break

    let results: RedeemResult[]
    try {
      const { data, error } = await supabase.rpc('redeem_tickets', {
        p_scans: batch.map(toPendingScan),
      })
      if (error) throw error
      results = (data ?? []) as RedeemResult[]
    } catch (error) {
      // Offline, 5xx, or not-authorised. Leave every row `pending` and swallow
      // it: the queue IS the retry mechanism, losing a scan here is
      // unrecoverable, and an unhandled rejection at a door is a dialog nobody
      // can dismiss with a queue of four hundred people behind it.
      console.warn('[scanQueue] flush failed, rows stay queued:', error)
      break
    }
    await applyResults(results)
    resolved.push(...results)

    // A server that answered fewer rows than we sent would loop forever.
    if (results.length < batch.length) {
      console.warn('[scanQueue] partial answer, stopping drain')
      break
    }
  }

  notify()
  return resolved
}

function toPendingScan(row: QueuedScan): PendingScan {
  return {
    client_scan_id: row.client_scan_id,
    event_id: row.event_id,
    qr_token: row.qr_token,
    scanned_at: row.scanned_at,
    gate_id: row.gate_id,
    device_id: row.device_id,
    scan_type: row.scan_type,
    offline: row.offline,
  }
}

async function applyResults(results: RedeemResult[]) {
  await db.transaction('rw', db.pendingScans, async () => {
    for (const result of results) {
      // Anything the server did not admit needs a human to look at it, so it
      // lands in `conflict` and shows up in the persistent list — a duplicate,
      // an unknown code, an unpaid order and a revoked pass are all "this
      // person did not get in and someone has to know".
      await db.pendingScans.update(result.client_scan_id, {
        sync_state: result.result === 'admitted' ? 'synced' : 'conflict',
        server_result: result,
      })
    }
  })
}

/**
 * Drop a conflict once the operator has seen it. The authoritative row lives in
 * `ticket_scans` forever; this only clears the device's to-do list.
 */
export async function acknowledgeConflict(clientScanId: string): Promise<void> {
  await db.pendingScans.delete(clientScanId)
  notify()
}

export async function acknowledgeAllConflicts(): Promise<void> {
  await db.pendingScans.where('sync_state').equals('conflict').delete()
  notify()
}

// ---------------------------------------------------------------------------
// Reactive counts
// ---------------------------------------------------------------------------

export interface QueueSnapshot {
  pending: number
  admitted: number
  conflicts: QueuedScan[]
}

const EMPTY: QueueSnapshot = { pending: 0, admitted: 0, conflicts: [] }
let snapshot: QueueSnapshot = EMPTY
const listeners = new Set<() => void>()

/** Recompute and publish. Called after every write; cheap, all indexed. */
export function notify(): void {
  void (async () => {
    const [pending, admitted, conflicts] = await Promise.all([
      db.pendingScans.where('sync_state').equals('pending').count(),
      db.pendingScans.where('sync_state').equals('synced').count(),
      db.pendingScans.where('sync_state').equals('conflict').toArray(),
    ])
    const next: QueueSnapshot = { pending, admitted, conflicts }
    if (
      next.pending === snapshot.pending &&
      next.admitted === snapshot.admitted &&
      next.conflicts.length === snapshot.conflicts.length
    ) {
      return
    }
    snapshot = next
    listeners.forEach((listener) => listener())
  })()
}

/**
 * Queue state for the UI. `useSyncExternalStore` rather than `dexie-react-hooks`
 * — one dependency avoided for fifteen lines, and every mutation in this module
 * already funnels through `notify()`.
 */
export function useQueueCounts(): QueueSnapshot {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener)
    notify() // first mount: fill the snapshot from disk
    return () => {
      listeners.delete(listener)
    }
  }, [])
  const get = useCallback(() => snapshot, [])
  return useSyncExternalStore(subscribe, get, get)
}

/** Test hook: wipe every table and the in-memory snapshot. */
export async function __resetQueue(): Promise<void> {
  await Promise.all([db.pendingScans.clear(), db.ticketMirror.clear(), db.mirrorMeta.clear()])
  snapshot = EMPTY
}
