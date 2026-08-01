/**
 * Zustand holds CLIENT state only: the session, the scanner's device settings,
 * UI toggles. Server data lives in TanStack Query — `@/lib/queries`.
 *
 * `circleStore`, `ticketStore`, `financialStore` and `staffStore` are hand-rolled
 * caches of server rows and are on their way out; they are not exported here so
 * nothing new picks them up. See PROGRESS.md for which package deletes which.
 */
export { useAuthStore, type AppRole } from './authStore'
export { useEventStore } from './eventStore'

/** Domain unions live with the schema now. */
export type {
  ApplicationStatus as CircleStatus,
  EventStatus,
} from '@/lib/database.types'
