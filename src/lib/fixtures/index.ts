/**
 * Fixture seed for demo mode. One module per surface, assembled here.
 *
 * Adding a surface: create `src/lib/fixtures/<surface>.ts`, export arrays typed
 * against `../database.types`, and add them to the object below. Nothing else in
 * the app changes — see `src/lib/fixtures/README.md`.
 */
import { catalogBooths, catalogCircles, catalogSchedule } from './catalog'
import { booths, circles } from './circles'
import { event_counters, event_pricing, events, profiles } from './events'
import {
  announcements,
  event_schedule,
  notifications,
  queues,
  staff,
  staff_tasks,
} from './operations'
import { organizer_notifications } from './organizer'
import { ticket_passes, ticket_purchases, ticket_scans, tickets } from './tickets'
import { financial_transactions } from './transactions'

export type Row = Record<string, unknown>
export type SeedTables = Record<string, Row[]>

/** Deep copy, so a demo write never mutates the fixture module's own array. */
const copy = <T>(rows: readonly T[]): Row[] => JSON.parse(JSON.stringify(rows)) as Row[]

export function seedTables(): SeedTables {
  return {
    profiles: copy(profiles),
    events: copy(events),
    event_pricing: copy(event_pricing),
    event_counters: copy(event_counters),
    circles: [...copy(circles), ...copy(catalogCircles)],
    booths: [...copy(booths), ...copy(catalogBooths)],
    tickets: copy(tickets),
    ticket_purchases: copy(ticket_purchases),
    ticket_passes: copy(ticket_passes),
    ticket_scans: copy(ticket_scans),
    staff: copy(staff),
    staff_tasks: copy(staff_tasks),
    announcements: copy(announcements),
    notifications: [...copy(notifications), ...copy(organizer_notifications)],
    event_schedule: [...copy(event_schedule), ...copy(catalogSchedule)],
    queues: copy(queues),
    financial_transactions: copy(financial_transactions),
  }
}

export { DEMO_SCAN_CODES } from './tickets'
export { EVENT_ID, EVENT_ID_TOKYO, USER } from './ids'
