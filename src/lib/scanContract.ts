/**
 * The scan contract — the TypeScript half of `supabase/migrations/003_scanning.sql`.
 *
 * Deliberately has no imports. No Supabase client, no React, no i18next. The Dexie
 * queue, the scanner UI and the criterion-3 tests all depend on this file, so it
 * has to be runnable with nothing attached — including in a test that has no
 * database, which is the point of the pure resolver at the bottom.
 *
 * Success criterion 3 is the spec these shapes exist to serve:
 *   "50 scans with the network off queue in IndexedDB, reconcile on reconnect,
 *    and a ticket already used offline is rejected on sync with a VISIBLE
 *    conflict, never a silent double-admit."
 *
 * The one rule that makes that true in the UI as well as in the database:
 * **a scan the server has not answered yet is `queued`, never `admitted`.**
 * Queued is amber. Admitted is green. An operator holding up a queue of 400
 * people has to be able to tell "this person is in" from "probably fine, the
 * server hasn't said". Anything that paints an unconfirmed scan green is the
 * silent double-admit wearing a nicer colour.
 */

/** Entry is the gated one. `exit`/`reentry` sit outside the DB's one-admission index. */
export type ScanType = 'entry' | 'exit' | 'reentry'

/** One item of the `p_scans` array passed to the `redeem_tickets` RPC. */
export interface PendingScan {
  /** Generated on the device. `UNIQUE (client_scan_id)` in SQL — this is what makes replay idempotent. */
  client_scan_id: string
  /**
   * The event the scanner is working. Not derivable from the pass when the token
   * is unknown, and `ticket_scans.event_id` is NOT NULL because an unknown code
   * still has to be logged somewhere. Also what the server compares against the
   * pass to produce `wrong_event`.
   */
  event_id: string
  /** The scanned payload: a `ticket_passes.qr_token` uuid and nothing else. */
  qr_token: string
  /** Device clock, ISO 8601. The server records its own `synced_at` separately. */
  scanned_at: string
  gate_id: string | null
  device_id: string
  scan_type: ScanType
  /** True when the scan was taken with no network. Recorded for the post-event audit. */
  offline?: boolean
}

/** `ticket_scans.result` — the CHECK constraint, verbatim. */
export type ScanResultCode =
  | 'admitted'
  | 'duplicate'
  | 'not_found'
  | 'unpaid'
  | 'revoked'
  | 'wrong_event'
  | 'outside_window'

/**
 * One element of the `redeem_tickets` return array. All seven keys are always
 * present; the SQL builds them in a single place (`public.scan_result_json`) so a
 * fresh scan and a replayed one are identical.
 */
export interface RedeemResult {
  client_scan_id: string
  result: ScanResultCode
  scan_id: string | null
  /** Set only when `result === 'admitted'`. */
  admitted_at: string | null
  /** The three `conflicting_*` fields are set only when `result === 'duplicate'`. */
  conflicting_device: string | null
  conflicting_scanned_at: string | null
  conflicting_gate: string | null
}

/**
 * What the device can work out on its own, from the pre-downloaded ticket mirror
 * plus its own queue. `null` means no check was possible at all — no mirror
 * downloaded — which is different from "the mirror says this token is unknown".
 */
export interface LocalCheck {
  /** The token is present in the mirror. `false` is a real rejection, not an absence of information. */
  known: boolean
  /** This device already queued an admission for this token. */
  alreadyAdmittedHere: boolean
  holder_name?: string | null
  tier_name?: string | null
  /** Device clock of this device's earlier admission, when there is one. */
  admittedHereAt?: string | null
  device_id?: string | null
  gate_id?: string | null
}

export type ScanOutcomeKind = 'admitted' | 'duplicate' | 'rejected' | 'queued'

export interface ScanOutcome {
  kind: ScanOutcomeKind
  /**
   * An i18next key in the `scanner` namespace, not a sentence. This module stays
   * import-free and the door staff may not read English.
   */
  message: string
  /**
   * False for everything except a confirmed admission. Part of the contract rather
   * than a UI decision: a conflict that vanishes on a timer is not visible, and
   * criterion 3 asks for visible.
   */
  autoDismiss: boolean
  detail?: {
    /** Device that won the admission (duplicate), or this device (local duplicate). */
    device?: string | null
    gate?: string | null
    /** ISO timestamp: admission time for `admitted`, the *winning* scan's time for `duplicate`. */
    at?: string | null
    holder?: string | null
    tier?: string | null
    /** The raw `result` code, so the UI can show why without re-deriving it. */
    code?: ScanResultCode
    scan_id?: string | null
  }
}

/**
 * The single place that decides what a scan means.
 *
 * Used by BOTH the scanner UI (optimistic, offline, `server === null`) and the
 * sync loop (authoritative, online). Two implementations would eventually
 * disagree about what "already used" means, and the disagreement would surface as
 * a double-admit at a door rather than as a failing test.
 *
 * Rules, in order:
 *  1. A server answer always wins. It saw every device; this one saw itself.
 *  2. No server answer + the mirror says the token is unknown → `rejected`.
 *     Admitting an unrecognised code because the network is down is exactly the
 *     failure the mirror exists to prevent.
 *  3. No server answer + this device already admitted it → `duplicate`, locally.
 *  4. Anything else with no server answer → `queued`. Never `admitted`.
 */
export function resolveScanOutcome(
  local: LocalCheck | null,
  server: RedeemResult | null,
): ScanOutcome {
  if (server) {
    if (server.result === 'admitted') {
      return {
        kind: 'admitted',
        message: 'scanner.result.admitted',
        autoDismiss: true,
        detail: {
          at: server.admitted_at,
          holder: local?.holder_name ?? null,
          tier: local?.tier_name ?? null,
          code: server.result,
          scan_id: server.scan_id,
        },
      }
    }

    if (server.result === 'duplicate') {
      return {
        kind: 'duplicate',
        message: 'scanner.result.duplicate',
        autoDismiss: false,
        detail: {
          device: server.conflicting_device,
          gate: server.conflicting_gate,
          at: server.conflicting_scanned_at,
          holder: local?.holder_name ?? null,
          tier: local?.tier_name ?? null,
          code: server.result,
          scan_id: server.scan_id,
        },
      }
    }

    return {
      kind: 'rejected',
      message: `scanner.result.${server.result}`,
      autoDismiss: false,
      detail: { code: server.result, scan_id: server.scan_id },
    }
  }

  if (local && !local.known) {
    return {
      kind: 'rejected',
      message: 'scanner.result.not_found',
      autoDismiss: false,
      detail: { code: 'not_found' },
    }
  }

  if (local?.alreadyAdmittedHere) {
    return {
      kind: 'duplicate',
      message: 'scanner.result.duplicate',
      autoDismiss: false,
      detail: {
        device: local.device_id ?? null,
        gate: local.gate_id ?? null,
        at: local.admittedHereAt ?? null,
        holder: local.holder_name ?? null,
        tier: local.tier_name ?? null,
        code: 'duplicate',
      },
    }
  }

  // Recognised by the mirror, or no mirror at all. Either way the server has not
  // spoken, so this is amber and it stays amber until flush() answers.
  return {
    kind: 'queued',
    message: 'scanner.result.queued',
    autoDismiss: false,
    detail: {
      holder: local?.holder_name ?? null,
      tier: local?.tier_name ?? null,
    },
  }
}
