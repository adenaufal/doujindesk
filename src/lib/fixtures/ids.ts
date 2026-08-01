/**
 * Stable ids for the demo fixtures.
 *
 * Every id is a real uuid shape because `parseTicketCode` (and Postgres, later)
 * rejects anything else — a fixture like `'circle-1'` would decode at the
 * scanner as "invalid code" and teach the owner the wrong thing.
 *
 * The first nibble is the surface, so an id is readable in devtools:
 * `cccccccc-…-000000000003` is the third circle.
 */
export const uid = (prefix: string, n: number): string =>
  `${prefix.repeat(8).slice(0, 8)}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`

/** Two events: one Indonesian (IDR), one Japanese (USD — the schema allows only IDR/USD). */
export const EVENT_ID = uid('e', 1)
export const EVENT_ID_TOKYO = uid('e', 2)

/** One account per role, so the picker can reach every screen. */
export const USER = {
  organizer: uid('a', 1),
  staff: uid('a', 2),
  circle: uid('a', 3),
  attendee: uid('a', 4),
  /** A second circle owner, so the review queue is not a queue of one person. */
  circle2: uid('a', 5),
} as const

/** Reference dates hang off "today" so the demo is never stale. */
const day = 86_400_000
export const NOW = new Date()
export const iso = (offsetDays: number, hour = 9): string => {
  const d = new Date(NOW.getTime() + offsetDays * day)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
