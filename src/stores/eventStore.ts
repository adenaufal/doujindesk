import { create } from 'zustand'

import type { EventRow } from '@/lib/database.types'

/**
 * What is left of the event store: one nullable field, no persistence, no data.
 *
 * Everything else it held was server state wearing client-state clothes — a
 * hardcoded 'Comic Frontier 18', five invented aggregates (`totalBooths`,
 * `soldTickets`, `revenue: { idr, usd }`, a pair that contradicts the schema's
 * single per-event `currency` and criterion 4's "totals derive from rows") and
 * two `await sleep(1000)` fake fetches. Read events with `useEvents()` /
 * `useEvent(eventId)` from `@/lib/queries`; `:eventId` from the URL is the only
 * source of event scope.
 *
 * `persist` is gone with the data. It carried no `version` and no `migrate`, so
 * the mock literals it wrote on first render would rehydrate over any fix
 * forever; `src/main.tsx` removes the stale key on boot.
 *
 * ponytail: this shim survives only because `Dashboard.tsx` and `EventGuide.tsx`
 * still read `currentEvent?.name`, and those files belong to P13/P14. Delete the
 * file in the commit that switches them to `useEvent(eventId)`.
 */
interface EventStore {
  /** Null until something sets it. Nothing does today — the URL is the scope. */
  currentEvent: EventRow | null
  setCurrentEvent: (event: EventRow | null) => void
}

export const useEventStore = create<EventStore>()((set) => ({
  currentEvent: null,
  setCurrentEvent: (currentEvent) => set({ currentEvent }),
}))

/** @deprecated use `EventRow` from `@/lib/database.types`. */
export type Event = EventRow
