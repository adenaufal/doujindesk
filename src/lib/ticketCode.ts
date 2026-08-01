/**
 * The one scannable code format.
 *
 * The payload printed in a QR is the `ticket_passes.qr_token` uuid and nothing
 * else. No name, no event, no expiry:
 *
 *  - a code carrying PII is a privacy leak the moment someone photographs a
 *    ticket over a shoulder;
 *  - a self-describing, unsigned payload is forgeable by typing JSON into the
 *    manual-entry box, which is exactly what the old `JSON.parse` scanner
 *    accepted.
 *
 * Validity is decided by `redeem_tickets` on the server, or by the
 * pre-downloaded ticket mirror when the network is gone. Never by the contents
 * of the code itself.
 */

/**
 * Loose uuid shape: 8-4-4-4-12 hex. Deliberately not pinned to v4 — the token
 * is `gen_random_uuid()` today, and a future v7 default should not turn every
 * ticket at the door into "invalid code".
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Normalise a scanned or typed code to a `qr_token`, or `null` if it is not one.
 *
 * Accepts a bare uuid and a `doujindesk:<uuid>` / URL-suffixed form, because a
 * printed ticket may carry a link and the camera hands back whatever the QR
 * encodes. Everything else — JSON, `QR_123_169…`, a typo — is `null`, and the
 * caller shows "invalid code" without ever touching the network.
 */
export function parseTicketCode(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Last path-ish segment: handles `https://…/t/<uuid>` and `doujindesk:<uuid>`.
  const tail = trimmed.split(/[/:?#]/).filter(Boolean).pop() ?? trimmed
  const candidate = tail.toLowerCase()

  return UUID.test(candidate) ? candidate : null
}

/** True for a string that could be a pass token. Same rule, used by the form. */
export function isTicketCode(raw: string): boolean {
  return parseTicketCode(raw) !== null
}
