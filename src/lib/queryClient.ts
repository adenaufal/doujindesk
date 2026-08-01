import { QueryClient } from '@tanstack/react-query'

/**
 * One QueryClient, tuned for the machine this app actually runs on: a phone on
 * venue wifi.
 *
 *  - `refetchOnWindowFocus: false` — an organizer tabbing between the review
 *    queue and their email should not re-issue every query, and a scanner coming
 *    back from the camera permission prompt should not either.
 *  - `retry: 2` — two retries covers a dropped packet; more turns a dead network
 *    into a UI that lies about loading for half a minute.
 *  - `staleTime: 30s` — the default. Screens that want longer say so at the hook
 *    (catalog 5 min, schedule/map/guide 1 h); screens that want instant say so
 *    with realtime invalidation, not with a shorter stale time.
 *  - `gcTime: 24h` — the tab lives all weekend at a convention. Keeping the cache
 *    means a route the staffer already visited still paints with no network.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
    },
    mutations: {
      // A retried write at the money or scan path is a second row, not a second
      // attempt. Idempotency lives in SQL (UNIQUE client_scan_id, the purchase
      // RPC); nothing here should paper over it.
      retry: 0,
    },
  },
})
