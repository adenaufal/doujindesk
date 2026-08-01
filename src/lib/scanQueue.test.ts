/**
 * Success criterion 3, end to end, with no database and no network:
 *
 *   "A staff member scans 50 tickets with the network off; scans queue in
 *    IndexedDB and reconcile on reconnect; a ticket already used offline is
 *    rejected on sync with a visible conflict, not silently double-admitted."
 *
 * The fake server below is not a stub that returns fixtures. It enforces the two
 * constraints `003_scanning.sql` declares — UNIQUE(client_scan_id) and the
 * partial unique index `one_admission_per_pass` — because those constraints are
 * the entire guarantee. A mock that just says "admitted" would pass while the
 * real door double-admits.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PendingScan, RedeemResult } from './scanContract'
import { resolveScanOutcome } from './scanContract'

vi.mock('./supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}))

import { supabase } from './supabase'
import {
  __resetQueue,
  acknowledgeConflict,
  checkLocal,
  db,
  enqueue,
  flush,
  type QueuedScan,
} from './scanQueue'

const rpc = vi.mocked(supabase.rpc)

// ---------------------------------------------------------------------------
// The fake server — a transcription of redeem_tickets, constraints included
// ---------------------------------------------------------------------------

const EVENT = '11111111-1111-4111-8111-111111111111'
const uuid = (n: number) => `2222${String(n).padStart(4, '0')}-2222-4222-8222-222222222222`

interface ServerScan {
  id: string
  client_scan_id: string
  pass_id: string | null
  result: RedeemResult['result']
  device_id: string
  gate_id: string | null
  scanned_at: string
  scan_type: string
  conflict_with: string | null
}

let ledger: ServerScan[] = []
let validPasses = new Set<string>()

function resultJson(row: ServerScan): RedeemResult {
  const winner = ledger.find((s) => s.id === row.conflict_with) ?? null
  return {
    client_scan_id: row.client_scan_id,
    result: row.result,
    scan_id: row.id,
    admitted_at: row.result === 'admitted' ? row.scanned_at : null,
    conflicting_device: winner?.device_id ?? null,
    conflicting_scanned_at: winner?.scanned_at ?? null,
    conflicting_gate: winner?.gate_id ?? null,
  }
}

function redeem(scans: PendingScan[]): RedeemResult[] {
  return scans.map((scan) => {
    // UNIQUE (client_scan_id): a replayed row is a lookup, never a new admission.
    const replay = ledger.find((s) => s.client_scan_id === scan.client_scan_id)
    if (replay) return resultJson(replay)

    const known = validPasses.has(scan.qr_token)
    // one_admission_per_pass: WHERE result = 'admitted' AND scan_type = 'entry'.
    const winner = known
      ? (ledger.find(
          (s) => s.pass_id === scan.qr_token && s.result === 'admitted' && s.scan_type === 'entry',
        ) ?? null)
      : null

    const row: ServerScan = {
      id: `scan-${ledger.length + 1}`,
      client_scan_id: scan.client_scan_id,
      pass_id: known ? scan.qr_token : null,
      result: !known ? 'not_found' : winner ? 'duplicate' : 'admitted',
      device_id: scan.device_id,
      gate_id: scan.gate_id,
      scanned_at: scan.scanned_at,
      scan_type: scan.scan_type,
      conflict_with: winner?.id ?? null,
    }
    ledger.push(row)
    return resultJson(row)
  })
}

function serveOk() {
  rpc.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (async (_fn: string, args: any) => ({ data: redeem(args.p_scans), error: null })) as any,
  )
}

function serveOffline() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc.mockImplementation((async () => ({ data: null, error: { message: 'Failed to fetch' } })) as any)
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value })
}

const rows = () => db.pendingScans.toArray()
const byState = async (state: QueuedScan['sync_state']) =>
  (await rows()).filter((r) => r.sync_state === state)

beforeEach(async () => {
  ledger = []
  validPasses = new Set()
  rpc.mockReset()
  setOnline(true)
  await __resetQueue()
})

// ---------------------------------------------------------------------------

describe('scanQueue', () => {
  it('1. a valid scan online is admitted and leaves one synced row', async () => {
    validPasses.add(uuid(1))
    serveOk()

    const queued = await enqueue({ event_id: EVENT, qr_token: uuid(1), gate_id: 'GATE-A' })
    const results = await flush()

    expect(results).toHaveLength(1)
    expect(results[0].result).toBe('admitted')
    expect(results[0].client_scan_id).toBe(queued.client_scan_id)

    const all = await rows()
    expect(all).toHaveLength(1)
    expect(all[0].sync_state).toBe('synced')
    expect(resolveScanOutcome(null, results[0]).kind).toBe('admitted')
  })

  it('2. a pass already used elsewhere comes back duplicate, is marked conflict, and is not admitted', async () => {
    validPasses.add(uuid(2))
    // Another gate got there first.
    redeem([
      {
        client_scan_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        event_id: EVENT,
        qr_token: uuid(2),
        scanned_at: '2026-08-01T09:00:00.000Z',
        gate_id: 'GATE-WEST',
        device_id: 'phone-1',
        scan_type: 'entry',
      },
    ])
    serveOk()

    await enqueue({ event_id: EVENT, qr_token: uuid(2), gate_id: 'GATE-EAST' })
    const [result] = await flush()

    expect(result.result).toBe('duplicate')
    // The conflict names who won, which is what makes it visible rather than
    // just red: the operator can radio the other gate.
    expect(result.conflicting_device).toBe('phone-1')
    expect(result.conflicting_gate).toBe('GATE-WEST')
    expect(result.conflicting_scanned_at).toBe('2026-08-01T09:00:00.000Z')

    expect(await byState('conflict')).toHaveLength(1)
    expect(await byState('synced')).toHaveLength(0)

    const outcome = resolveScanOutcome(null, result)
    expect(outcome.kind).toBe('duplicate')
    // Non-negotiable: a conflict that auto-dismisses is not visible.
    expect(outcome.autoDismiss).toBe(false)

    // It stays until a human clears it.
    expect(await byState('conflict')).toHaveLength(1)
    await acknowledgeConflict(result.client_scan_id)
    expect(await byState('conflict')).toHaveLength(0)
  })

  it('3. 50 scans with the network off persist and reconcile in one call on reconnect', async () => {
    for (let i = 1; i <= 50; i++) validPasses.add(uuid(i))
    setOnline(false)
    serveOffline()

    for (let i = 1; i <= 50; i++) {
      await enqueue({ event_id: EVENT, qr_token: uuid(i), gate_id: 'GATE-A' })
    }

    // Nothing touched the network on the hot path.
    expect(rpc).not.toHaveBeenCalled()
    expect(await rows()).toHaveLength(50)
    expect(await byState('pending')).toHaveLength(50)
    expect((await rows()).every((r) => r.offline)).toBe(true)

    setOnline(true)
    serveOk()
    const results = await flush()

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_scans: expect.any(Array) })
    expect((rpc.mock.calls[0][1] as { p_scans: PendingScan[] }).p_scans).toHaveLength(50)
    expect(results).toHaveLength(50)
    expect(await byState('synced')).toHaveLength(50)
    expect(await byState('pending')).toHaveLength(0)
  })

  it('3b. a failed flush leaves every row queued for the next attempt', async () => {
    validPasses.add(uuid(7))
    serveOffline()

    await enqueue({ event_id: EVENT, qr_token: uuid(7) })
    await expect(flush()).resolves.toEqual([])
    expect(await byState('pending')).toHaveLength(1)
  })

  it('4. two devices that both scanned one pass offline produce one admission and one visible conflict', async () => {
    validPasses.add(uuid(9))
    serveOk()

    const base = {
      event_id: EVENT,
      qr_token: uuid(9),
      scan_type: 'entry' as const,
      sync_state: 'pending' as const,
      server_result: null,
      offline: true,
    }
    await db.pendingScans.bulkAdd([
      {
        ...base,
        client_scan_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        device_id: 'phone-1',
        gate_id: 'GATE-WEST',
        scanned_at: '2026-08-01T09:00:00.000Z',
      },
      {
        ...base,
        client_scan_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        device_id: 'phone-2',
        gate_id: 'GATE-EAST',
        scanned_at: '2026-08-01T09:00:04.000Z',
      },
    ])

    const results = await flush()

    expect(results.filter((r) => r.result === 'admitted')).toHaveLength(1)
    expect(results.filter((r) => r.result === 'duplicate')).toHaveLength(1)
    expect(await byState('synced')).toHaveLength(1)

    const conflicts = await byState('conflict')
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].server_result?.conflicting_device).toBe('phone-1')
    expect(conflicts[0].server_result?.conflicting_scanned_at).toBe('2026-08-01T09:00:00.000Z')
  })

  it('5. flushing the same queue twice admits nothing extra', async () => {
    for (let i = 20; i < 25; i++) validPasses.add(uuid(i))
    serveOk()

    for (let i = 20; i < 25; i++) await enqueue({ event_id: EVENT, qr_token: uuid(i) })
    await flush()

    const admittedAfterFirst = ledger.filter((s) => s.result === 'admitted').length
    expect(admittedAfterFirst).toBe(5)

    // Force a replay of rows the server has already answered.
    await db.pendingScans.toCollection().modify({ sync_state: 'pending' })
    const second = await flush()

    expect(ledger.filter((s) => s.result === 'admitted')).toHaveLength(5)
    expect(ledger).toHaveLength(5)
    expect(second.every((r) => r.result === 'admitted')).toBe(true)
    expect(await byState('synced')).toHaveLength(5)
  })

  it('6. offline, the same badge scanned twice on this device is a local duplicate, never queued twice as admitted', async () => {
    setOnline(false)
    serveOffline()

    await enqueue({ event_id: EVENT, qr_token: uuid(31), gate_id: 'GATE-A' })
    const local = await checkLocal(uuid(31), EVENT)
    const outcome = resolveScanOutcome(local, null)

    expect(local?.alreadyAdmittedHere).toBe(true)
    expect(outcome.kind).toBe('duplicate')
    expect(outcome.autoDismiss).toBe(false)
  })

  it('6b. with a mirror downloaded, an unknown code is rejected offline instead of queued', async () => {
    await db.ticketMirror.put({
      qr_token: uuid(40),
      event_id: EVENT,
      holder_name: 'Sato Rin',
      tier_name: 'Day 1',
    })
    await db.mirrorMeta.put({ event_id: EVENT, downloaded_at: new Date().toISOString(), count: 1 })
    setOnline(false)

    expect(resolveScanOutcome(await checkLocal(uuid(41), EVENT), null).kind).toBe('rejected')

    const good = await checkLocal(uuid(40), EVENT)
    expect(good?.known).toBe(true)
    expect(good?.holder_name).toBe('Sato Rin')
    // Recognised, but the server has not spoken: amber, never green.
    expect(resolveScanOutcome(good, null).kind).toBe('queued')
  })

  it('6c. with no mirror and no local history there is nothing to say, so the scan queues', async () => {
    expect(await checkLocal(uuid(50), EVENT)).toBeNull()
    expect(resolveScanOutcome(null, null).kind).toBe('queued')
  })
})
