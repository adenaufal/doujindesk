/**
 * ============================================================================
 * THE DATA SEAM — read this before writing a screen. It is four rules long.
 * ============================================================================
 *
 * 1. SERVER STATE IS TANSTACK QUERY. ALWAYS.
 *    No `useState` + `useEffect` + `supabase.from(...)` in a component, and no
 *    Zustand store holding rows. Zustand keeps client state only: the session,
 *    the scanner's device id, UI toggles. Two caches for the same rows means one
 *    of them is stale, and the stale one is the number on the money screen.
 *
 *      import { useCircles } from '@/lib/queries'
 *      const { data, isLoading, error, isEmpty } = useCircles(eventId, { status: 'submitted' })
 *
 *    Every list hook returns exactly that shape, so every screen writes the same
 *    four branches: skeleton / error+retry / EmptyState / rows. Criterion 1 and
 *    the "every async surface needs three states" rule are both satisfied by
 *    using it and by nothing else.
 *
 * 2. EVENT SCOPE COMES FROM THE URL.
 *    `const { eventId } = useParams()`, pass it to the hook, which applies
 *    `.eq('event_id', eventId)`. Nothing copies it into a store.
 *
 * 3. KEYS COME FROM `queryKeys`, INVALIDATION COMES FROM `useWrite`.
 *    Never hand-type a key array. A mutation declares the keys it invalidates in
 *    the same call that performs the write — see `useUpdateCircleStatus`.
 *
 * 4. NEED A QUERY THAT IS NOT HERE? ADD IT TO THE MODULE FOR ITS TABLE.
 *    One module per table: events, circles, booths, tickets, purchases,
 *    transactions, staff, queues, announcements, notifications, schedule,
 *    dashboard. Add the hook next to its siblings and export it here. Do not
 *    open a raw `supabase.from()` in a `.tsx` file — that is how the seam rots.
 *
 * ----------------------------------------------------------------------------
 * DEMO MODE — why none of the above mentions it
 * ----------------------------------------------------------------------------
 * `src/lib/supabase.ts` exports a fixture-backed client when `VITE_DEMO_MODE` is
 * on (the default in `pnpm dev`). Reads resolve from memory, writes mutate that
 * memory, and the shape is identical. A component must never know which one it
 * has. If you are about to write `if (DEMO_MODE)` in a `.tsx`, stop: the answer
 * is a fixture row or an RPC handler in `src/lib/demo/client.ts`.
 *
 * To make a new screen work in demo, add rows to `src/lib/fixtures/<surface>.ts`
 * — one module per surface so four packages can add fixtures in parallel without
 * touching each other's file. `src/lib/fixtures/README.md` has the recipe.
 * ============================================================================
 */

export { queryKeys } from './keys'
export { STALE, useList, useItem, useWrite, unwrap } from './core'
export type { ListResult, ItemResult } from './core'

export * from './events'
export * from './circles'
export * from './booths'
export * from './tickets'
export * from './purchases'
export * from './transactions'
export * from './staff'
export * from './queues'
export * from './announcements'
export * from './notifications'
export * from './schedule'
export * from './dashboard'

export { useRealtimeTable } from '../useRealtimeTable'
