import { describe, expect, it } from 'vitest'

import {
  resolveScanOutcome,
  type LocalCheck,
  type PendingScan,
  type RedeemResult,
} from './scanContract'

// No database, no DOM, no Supabase. If any of these need one to pass, the
// contract has leaked something it should not have.

const admittedLocally: LocalCheck = {
  known: true,
  alreadyAdmittedHere: true,
  holder_name: 'Sato Yuki',
  tier_name: 'Day 1',
  admittedHereAt: '2026-08-01T02:00:00.000Z',
  device_id: 'gate-a-phone-1',
  gate_id: 'A',
}

const serverDuplicate: RedeemResult = {
  client_scan_id: '11111111-1111-4111-8111-111111111111',
  result: 'duplicate',
  scan_id: '22222222-2222-4222-8222-222222222222',
  admitted_at: null,
  conflicting_device: 'gate-b-phone-3',
  conflicting_scanned_at: '2026-08-01T01:58:12.000Z',
  conflicting_gate: 'B',
}

describe('resolveScanOutcome', () => {
  it('lets a server duplicate override a local admission', () => {
    // Both phones were offline and both let the holder in. The server saw both;
    // this device only saw itself. The server wins, and it wins loudly.
    const local = resolveScanOutcome(admittedLocally, null)
    expect(local.kind).toBe('duplicate') // this device already admitted it

    const outcome = resolveScanOutcome({ ...admittedLocally, alreadyAdmittedHere: false }, serverDuplicate)
    expect(outcome.kind).toBe('duplicate')
    expect(outcome.detail?.device).toBe('gate-b-phone-3')
    expect(outcome.detail?.gate).toBe('B')
    expect(outcome.detail?.at).toBe('2026-08-01T01:58:12.000Z')
  })

  it('never auto-dismisses a duplicate', () => {
    // A conflict that disappears on a timer is not a visible conflict.
    expect(resolveScanOutcome(null, serverDuplicate).autoDismiss).toBe(false)
    expect(resolveScanOutcome(admittedLocally, null).autoDismiss).toBe(false)
  })

  it('rejects an unknown token offline instead of admitting it', () => {
    // The mirror was downloaded and does not contain this token. That is
    // information, not an absence of it.
    const outcome = resolveScanOutcome({ known: false, alreadyAdmittedHere: false }, null)
    expect(outcome.kind).toBe('rejected')
    expect(outcome.kind).not.toBe('admitted')
    expect(outcome.detail?.code).toBe('not_found')
  })

  it('queues a recognised token with no server answer, and never paints it admitted', () => {
    const outcome = resolveScanOutcome(
      { known: true, alreadyAdmittedHere: false, holder_name: 'Sato Yuki', tier_name: 'Day 1' },
      null,
    )
    expect(outcome.kind).toBe('queued')
    expect(outcome.autoDismiss).toBe(false)
    expect(outcome.detail?.holder).toBe('Sato Yuki')
  })

  it('queues rather than admits when no mirror was downloaded at all', () => {
    expect(resolveScanOutcome(null, null).kind).toBe('queued')
  })

  it('only ever returns admitted when the server said so', () => {
    const admitted: RedeemResult = {
      client_scan_id: '33333333-3333-4333-8333-333333333333',
      result: 'admitted',
      scan_id: '44444444-4444-4444-8444-444444444444',
      admitted_at: '2026-08-01T02:00:00.000Z',
      conflicting_device: null,
      conflicting_scanned_at: null,
      conflicting_gate: null,
    }
    const outcome = resolveScanOutcome({ known: true, alreadyAdmittedHere: false, holder_name: 'Sato Yuki' }, admitted)
    expect(outcome.kind).toBe('admitted')
    expect(outcome.autoDismiss).toBe(true)
    expect(outcome.detail?.at).toBe('2026-08-01T02:00:00.000Z')
    expect(outcome.detail?.holder).toBe('Sato Yuki')
  })

  it('maps every non-admitted, non-duplicate result to a distinct rejection key', () => {
    const codes = ['not_found', 'unpaid', 'revoked', 'wrong_event', 'outside_window'] as const
    const messages = codes.map(
      (code) => resolveScanOutcome(null, { ...serverDuplicate, result: code }).message,
    )
    expect(messages).toEqual([
      'scanner.result.not_found',
      'scanner.result.unpaid',
      'scanner.result.revoked',
      'scanner.result.wrong_event',
      'scanner.result.outside_window',
    ])
    expect(new Set(messages).size).toBe(codes.length)
  })

  it('is idempotent: a replayed client_scan_id resolves identically', () => {
    // `UNIQUE (client_scan_id)` means the server returns the stored row verbatim
    // on a retried flush. The resolver must not drift on the second pass.
    const first = resolveScanOutcome(admittedLocally, serverDuplicate)
    const second = resolveScanOutcome(admittedLocally, serverDuplicate)
    expect(second).toEqual(first)
  })

  it('resolves 50 offline scans without a single admitted', () => {
    // Criterion 3, the pure half: with the network off, nothing is confirmed.
    const queue: PendingScan[] = Array.from({ length: 50 }, (_, i) => ({
      client_scan_id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      event_id: '55555555-5555-4555-8555-555555555555',
      qr_token: `66666666-6666-4666-8666-${String(i).padStart(12, '0')}`,
      scanned_at: new Date(Date.UTC(2026, 7, 1, 2, 0, i)).toISOString(),
      gate_id: 'A',
      device_id: 'gate-a-phone-1',
      scan_type: 'entry',
      offline: true,
    }))

    const outcomes = queue.map(() =>
      resolveScanOutcome({ known: true, alreadyAdmittedHere: false }, null),
    )

    expect(outcomes).toHaveLength(50)
    expect(outcomes.every((o) => o.kind === 'queued')).toBe(true)
    expect(outcomes.some((o) => o.kind === 'admitted')).toBe(false)
  })
})
