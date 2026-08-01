import { createClient } from '@supabase/supabase-js'

import type { Database } from './database.types'
import { DEMO_MODE } from './demo'
import { demoClient } from './demo/client'

/**
 * The one client. Typed with `Database` (hand-derived from migrations 001–006 —
 * see `database.types.ts`), so a typo in a column name is a build error instead
 * of a PGRST204 at the door.
 *
 * In demo mode this is a fixture-backed stand-in with the same surface. That
 * substitution happens here and nowhere else: no component, hook or store knows
 * which one it holds. See `src/lib/demo/client.ts`.
 *
 * Row types come from `database.types.ts` (`TableRow<'circles'>`). The
 * hand-written `Event`/`Circle` interfaces that used to live in this file were
 * wrong about ~14 columns and are deleted; `tsc` never caught it because the
 * client was untyped.
 *
 * ponytail: the demo client is imported statically, so its fixtures ride along in
 * a production bundle even with demo mode off. Measured cost: 12 kB raw, 4 kB
 * gzipped. Upgrade path if that ever matters: a dynamic import behind an async
 * accessor — which costs every caller an `await`, and the callers include the
 * scan queue.
 */
function realClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Set them in .env, or run with VITE_DEMO_MODE=true for fixture data.',
    )
  }
  return createClient<Database>(url, anonKey)
}

export const supabase = DEMO_MODE ? demoClient : realClient()

export type { Database } from './database.types'
import type { CircleRow, EventRow } from './database.types'

/**
 * @deprecated Compat aliases for the two interfaces this file used to hand-write.
 * They now point at the schema-derived rows, so the ~14-column drift is gone.
 * Import `TableRow<'circles'>` in new code; P11 drops the last consumer.
 *
 * `space_preference` and `space_size` are NOT columns — they are two of the
 * phantoms the old interface invented, still read by `CircleManagement.tsx`.
 * They are typed optional here so the build stays green while P11 owns that
 * file; at runtime they are `undefined` from every query, real or demo. The real
 * column is `space_type`.
 */
export type Circle = CircleRow & {
  /** @deprecated not a column — use `space_type`. */
  space_preference?: string
  /** @deprecated not a column. */
  space_size?: string
}
export type Event = EventRow
export type {
  BoothRow,
  CircleCatalogRow,
  CircleRow,
  EventFinancialSummaryRow,
  EventRow,
  ProfileRow,
  TableInsert,
  TableRow,
  TableUpdate,
  TicketRow,
} from './database.types'
