# Demo fixtures

`npm run dev` runs the app against these files instead of Supabase, so the whole
product is clickable before a single migration is applied. Nothing here ships a
behaviour the real database does not have — when the two disagree, the SQL wins
and this directory is the bug.

## The toggle

`VITE_DEMO_MODE`

| value | result |
|---|---|
| unset | ON in `pnpm dev`, OFF in `pnpm build` |
| `true` | ON, including in a production build |
| `false` | OFF — the real `createClient<Database>` against `VITE_SUPABASE_URL` |

Once the owner applies migrations 001–006, `VITE_DEMO_MODE=false pnpm dev`
develops against real data with no code change.

**Demo writes are not persisted.** Approving an application, scanning a ticket
and buying a ticket all mutate an in-memory store, so the UI responds correctly —
and a reload puts the fixtures back. That is deliberate: the point is a
predictable clickable app, not a second database to keep in sync.

**There is no RLS in demo mode.** Demo shows the shape of the app, never its
access control. Access control is tested in SQL, in
`supabase/migrations/README.md`.

## The seam

One file: `src/lib/supabase.ts` exports either the real client or
`src/lib/demo/client.ts`. Every hook, store and component calls the same methods
either way.

> If you find yourself writing `if (DEMO_MODE)` inside a `.tsx`, the seam is in
> the wrong place. Fix it in `src/lib/demo/client.ts` instead.

Signing in: demo mode has no passwords. The banner at the bottom of the screen
carries a role picker (organizer / staff / circle / attendee). It is rendered
from `src/main.tsx` only when demo mode is on, so with demo off it is not wired
at all — not merely hidden.

## Adding fixtures for your screen

1. Create or open `src/lib/fixtures/<surface>.ts`. One module per surface, so
   four packages can add rows in parallel without touching the same file.
2. Export arrays typed against `../database.types` — `TicketRow[]`, not `any[]`.
   The types are the schema; if a row does not typecheck, the screen would have
   failed against Postgres too.
3. Cross-reference ids through `./ids.ts` (`EVENT_ID`, `USER.organizer`,
   `uid('c', 3)`). Every id is a real uuid shape because `parseTicketCode` and
   Postgres both reject anything else.
4. Register the arrays in `seedTables()` in `./index.ts`.
5. Dates come from `iso(daysFromToday, hour)` so the demo is never stale.

### Make it realistic

A demo full of `Test Circle 1` teaches the owner nothing. Real names
(`猫町堂`, `Kopi Susu Studio`), plausible IDR amounts (Rp 450.000 for a space,
Rp 110.000 for a day ticket), several states per surface — accepted, submitted,
waitlisted, rejected, draft; paid, pending, refunded — and at least one row that
exercises the unhappy path. `ticket_passes[0]` is already redeemed, which is what
makes a rescan show the duplicate sheet.

### Embedded relations

`select()` projection is ignored by the demo client: whole rows come back, which
is a superset of what was asked for. So an embedded to-one
(`select('*, tickets ( ticket_type )')`) has to be present on the fixture row —
see `ticket_passes` in `tickets.ts`, which carries `tickets: { ticket_type }`.

### Views

`circle_catalog` and `event_financial_summary` are **computed on read** in
`src/lib/demo/store.ts`, exactly as the SQL views derive them. Do not add fixture
rows for a view; add rows to its base table and the view follows. The catalog's
column list is the access control there too — the projection is explicit for that
reason.

### RPCs

`redeem_tickets` and `purchase_tickets` are reimplemented in
`src/lib/demo/client.ts`, mirroring 003 and 004 including the duplicate path,
the one-pass-per-head rule, the oversell guard and the ledger row a trigger would
write. A new RPC needs a handler there or the call returns a loud
`PGRST202`-shaped error instead of failing silently.

### Filters

Implemented: `eq neq gt gte lt lte like ilike in is contains overlaps match not
or`. Anything else throws with a message naming the file to edit. Add the
operator; do not work around it in a component.
