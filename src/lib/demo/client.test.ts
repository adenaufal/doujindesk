import { describe, expect, it } from 'vitest'

import { DEMO_SCAN_CODES, EVENT_ID, USER } from '../fixtures'
import { demoClient, demoSignInAs } from './client'

/**
 * The demo adapter is what the owner actually clicks before the migrations are
 * applied, so the three behaviours the brief names are asserted here: a read
 * resolves, a write moves the row, and a second scan of one pass conflicts
 * instead of double-admitting.
 *
 * These run in order against one in-memory store — that is the point, not an
 * accident: test 4 depends on test 3 having admitted the pass.
 */
describe('demo client', () => {
  it('reads fixture rows filtered by event', async () => {
    const { data, error } = await demoClient.from('circles').select('*').eq('event_id', EVENT_ID)
    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(5)
    expect(data!.some((c) => c.circle_name === '猫町堂')).toBe(true)
  })

  it('projects the catalog view and hides private columns', async () => {
    const { data } = await demoClient.from('circle_catalog').select('*').eq('event_id', EVENT_ID)
    // Only accepted circles, and no PII — the column list is the access control.
    expect(data!.length).toBe(3)
    expect(data![0]).not.toHaveProperty('email')
    expect(data![0]).not.toHaveProperty('total_amount')
  })

  it('moves a row on write, and the catalog follows', async () => {
    const before = await demoClient.from('circle_catalog').select('*').eq('event_id', EVENT_ID)

    const { data: submitted } = await demoClient
      .from('circles')
      .select('*')
      .eq('application_status', 'submitted')
      .single()

    const { error } = await demoClient
      .from('circles')
      .update({ application_status: 'accepted' })
      .eq('id', submitted!.id)
    expect(error).toBeNull()

    const after = await demoClient.from('circle_catalog').select('*').eq('event_id', EVENT_ID)
    expect(after.data!.length).toBe(before.data!.length + 1)
  })

  it('admits a valid pass and rejects the second scan of it', async () => {
    demoSignInAs(USER.staff)

    const scan = (client_scan_id: string, qr_token: string) => ({
      client_scan_id,
      event_id: EVENT_ID,
      qr_token,
      scanned_at: new Date().toISOString(),
      gate_id: 'Gate 3',
      device_id: 'test-device',
      scan_type: 'entry' as const,
    })

    const first = await demoClient.rpc('redeem_tickets', {
      p_scans: [scan('11111111-0000-4000-8000-000000000001', DEMO_SCAN_CODES.valid)],
    })
    expect((first.data as { result: string }[])[0].result).toBe('admitted')

    // Same pass, different device and a fresh client_scan_id: the DB's
    // one_admission_per_pass is what this mirrors.
    const second = await demoClient.rpc('redeem_tickets', {
      p_scans: [scan('11111111-0000-4000-8000-000000000002', DEMO_SCAN_CODES.valid)],
    })
    const result = (second.data as { result: string; conflicting_device: string }[])[0]
    expect(result.result).toBe('duplicate')
    expect(result.conflicting_device).toBe('test-device')

    // A replay of the first scan returns the first answer, never a second admission.
    const replay = await demoClient.rpc('redeem_tickets', {
      p_scans: [scan('11111111-0000-4000-8000-000000000001', DEMO_SCAN_CODES.valid)],
    })
    expect((replay.data as { result: string }[])[0].result).toBe('admitted')

    // A revoked pass (refunded order) is rejected, not admitted.
    const revoked = await demoClient.rpc('redeem_tickets', {
      p_scans: [scan('11111111-0000-4000-8000-000000000003', DEMO_SCAN_CODES.revoked)],
    })
    expect((revoked.data as { result: string }[])[0].result).toBe('revoked')
  })

  it('derives the financial summary from the ledger, signed by direction', async () => {
    const { data } = await demoClient
      .from('event_financial_summary')
      .select('*')
      .eq('event_id', EVENT_ID)

    const refunds = data!.find(
      (r) => r.transaction_type === 'refund' && r.direction === 'debit',
    ) as { net_amount: number } | undefined
    expect(refunds!.net_amount).toBeLessThan(0)
  })

  it('signs in without a password and reads the matching profile', async () => {
    demoSignInAs(USER.organizer)
    const { data } = await demoClient.auth.getSession()
    expect(data.session!.user.id).toBe(USER.organizer)

    const { data: profile } = await demoClient
      .from('profiles')
      .select('role')
      .eq('id', data.session!.user.id)
      .maybeSingle()
    expect(profile!.role).toBe('organizer')
  })
})
