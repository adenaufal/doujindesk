/**
 * Demo mode — the toggle and the role picker's data.
 *
 * `VITE_DEMO_MODE` unset defaults to ON in dev and OFF in a production build, so
 * `npm run dev` is browsable with no configuration and `pnpm build` targets the
 * real Supabase project. An explicit 'true'/'false' always wins: once the owner
 * applies the migrations, `VITE_DEMO_MODE=false pnpm dev` develops against real
 * data with no code change.
 *
 * Everything demo lives under `src/lib/demo/` and `src/lib/fixtures/`. Deleting
 * those two directories plus the three lines in `src/lib/supabase.ts` and
 * `src/main.tsx` removes the feature entirely.
 */
import type { AppRole } from '../database.types'
import { USER } from '../fixtures'

function resolve(): boolean {
  const explicit = import.meta.env.VITE_DEMO_MODE
  if (explicit === 'true') return true
  if (explicit === 'false') return false
  return Boolean(import.meta.env.DEV)
}

export const DEMO_MODE: boolean = resolve()

/**
 * Who the picker can sign in as. One per role, because the point is to see every
 * role's screens without four passwords and four RLS policies applied.
 */
export const DEMO_ACCOUNTS: { role: AppRole; id: string; name: string; blurb: string }[] = [
  {
    role: 'organizer',
    id: USER.organizer,
    name: 'Rina Hapsari',
    blurb: 'Dashboard, review queue, booths, money',
  },
  { role: 'staff', id: USER.staff, name: 'Bagas Prakoso', blurb: 'Scanner, queues, tasks' },
  { role: 'circle', id: USER.circle, name: 'Kopi Susu Studio', blurb: 'Application and status' },
  { role: 'attendee', id: USER.attendee, name: 'Dimas Aditya', blurb: 'Tickets, catalog, map' },
]

export { DEMO_SCAN_CODES } from '../fixtures'
