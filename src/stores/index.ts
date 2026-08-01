/**
 * Zustand holds CLIENT state only: the session and UI toggles. Server data
 * lives in TanStack Query — `@/lib/queries`.
 *
 * `circleStore`, `ticketStore`, `financialStore`, `staffStore` and `eventStore`
 * were hand-rolled caches of server rows. All five are deleted; the active event
 * is `:eventId` from the URL, read with `useParams`, never copied into a store.
 */
export { useAuthStore, type AppRole } from './authStore'

/** Domain unions live with the schema now. */
export type {
  ApplicationStatus as CircleStatus,
  EventStatus,
} from '@/lib/database.types'
