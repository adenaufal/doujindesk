# DoujinDesk

Convention management for doujin and comic events. Circles apply for booths,
organizers review and allocate them, attendees buy tickets and browse a catalog,
and staff scan those tickets at the door on venue wifi.

Built for two markets at once: IDR and USD per event, and every screen in
English, Japanese and Indonesian.

**Status: pre-release.** The code is complete and typechecks, tests and builds
green, but the database migrations under `supabase/migrations/` have never been
applied to a live project. Until they are, run it in demo mode — see below.

---

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

That is the whole setup. No `.env` is needed, because `pnpm dev` starts in
**demo mode**: every read resolves from in-memory fixtures, every write mutates
that same store, and a banner at the bottom of the screen signs you in as an
organizer, staff member, circle or attendee without a password.

Demo mode is honest about what it is:

- The banner says "Fixture data, no database. Changes are lost on reload." It
  does. Approving an application moves it, scanning a ticket admits it, scanning
  it again conflicts — and a refresh puts everything back.
- The fixtures are shaped like a real event: Indonesian and Japanese circle
  names, IDR amounts that agree with the pricing sheet in migration 004, twelve
  booths with real geometry, tickets across sold-out / on-sale / refunded, and
  one pass already redeemed so a rescan produces the duplicate sheet.
- Scanner test codes are printed in the role picker.

The seam is one line in `src/lib/supabase.ts` — the exported client is either
the real Supabase client or `src/lib/demo/client.ts`, a PostgREST subset over an
in-memory store. No component knows which one it holds.

### Turning demo mode off

`VITE_DEMO_MODE` defaults to **on** under `pnpm dev` and **off** in a production
build. An explicit value always wins:

```bash
VITE_DEMO_MODE=false pnpm dev    # develop against real Supabase
VITE_DEMO_MODE=true pnpm build   # build a fixture-backed demo
```

With it off, the app needs `.env` (copy `.env.example`) **and** it needs the
migrations applied — see the next section. Against an un-migrated project it
authenticates for real and then errors on every screen, because `profiles`,
`ticket_passes`, `ticket_scans` and `financial_transactions` do not exist.

---

## Applying the database (owner action)

`supabase/migrations/` holds six files. `001_initial_schema.sql` was already
applied; **002 through 006 have not been, deliberately** — the agents that wrote
them never run SQL against a live project.

```bash
supabase db push
```

Read `supabase/migrations/README.md` first: it carries the apply order and six
paste-able `SET LOCAL role` statements that prove the row-level security
policies do what they claim.

| File | What it adds |
|---|---|
| `002_identity_and_rls.sql` | `profiles`, the `app_role` enum, a signup trigger that cannot mint an organizer, and `SECURITY DEFINER` helpers that end the policy recursion in 001 |
| `003_scanning.sql` | `ticket_passes`, append-only `ticket_scans`, and the `redeem_tickets` RPC |
| `004_money.sql` | `purchase_tickets`, the immutable `financial_transactions` ledger, and `event_financial_summary` |
| `005_operations.sql` | Circle application lifecycle, staff tasks, announcements, notifications, schedule, queues, `event_counters` |
| `006_catalog_floorplan_storage.sql` | The public `circle_catalog` view, booth-overlap constraints, storage buckets and policies |

Migrations are additive. Do not edit `001_initial_schema.sql` in place.

---

## What it does

**Organizer** — event dashboard with live attendance from a single counter row;
circle application review queue with tabs, filters, an inspector, bulk
accept/waitlist and CSV export; a plain-SVG floor-plan editor where booths drag
on a 0.5 m grid and allocation is a conditional update the database arbitrates;
a financial dashboard whose every total comes from `event_financial_summary`;
staff roster and task assignment; an announcement composer that writes one
record with EN/JA/ID text.

**Circle** — an application form with save-as-draft, circle-cut and sample-work
upload, conditionally-required furigana, and a price quoted from the event's
pricing sheet; a status page with the review timeline, the amount owed, a
payment hand-off and the booth once one is allocated.

**Attendee** — ticket checkout across tiers priced server-side; a QR wallet that
generates its codes locally and mirrors passes to localStorage so it still
paints at a dead gate; a public circle catalog with genre / fandom / rating /
block facets, kana search and 五十音 sort; an interactive floor map with
find-a-circle; the schedule.

**Staff** — an offline-capable ticket scanner, live queue and attendance
counters, and a task list.

**Cross-cutting** — four roles behind route guards, EN/JA/ID, IDR/USD per event,
dark mode, in-app notifications, PWA install.

### Two things worth knowing about how it is built

**The scanner assumes the network is gone.** Scans are written to IndexedDB
before anything touches the network and flushed through one `redeem_tickets`
call per batch of 50 on reconnect. A queued scan is amber and stays amber until
the server answers — nothing paints green without an authoritative reply. Double
admission is prevented by a partial unique index in Postgres, not by client
logic, so two phones offline at two gates still produce exactly one admission
and one visible conflict naming the device that won.

**The ledger is append-only.** `financial_transactions` rows are inserted by
database triggers on payment-status transitions, never by the browser: there is
no INSERT policy and no INSERT grant. A `BEFORE UPDATE OR DELETE` trigger raises
unconditionally, so a refund is a reversing entry rather than an edit. Every
figure an organizer sees is read from `event_financial_summary`.

---

## Stack

React 18 · TypeScript (strict) · Vite · Tailwind CSS + shadcn/ui primitives ·
React Router 7 · Supabase (Postgres, Auth, Storage, Realtime) · TanStack Query
for server state · Zustand for the session only · Dexie (IndexedDB) for the scan
queue · i18next · Vitest + Testing Library · vite-plugin-pwa.

There is no application server. Every privileged operation is a Postgres
`SECURITY DEFINER` function called with the user's own JWT. The single exception
is `api/webhooks/payment.ts`, one Vercel serverless function for the inbound
payment-gateway notification, whose caller holds no Supabase session.

Colour is a closed system: every value traces to a token in `src/index.css`, and
an ESLint rule fails the build on a raw hex, a gradient or a `gray-*` utility in
a `.tsx` file.

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server, demo mode on by default |
| `pnpm build` | `tsc -b && vite build` |
| `pnpm preview` | Serve the production build — **the only way to test the PWA** |
| `pnpm test` | Vitest, one pass |
| `pnpm check` | `tsc --noEmit` |
| `pnpm lint` | ESLint, including the design-token gate |

### Tests

```bash
pnpm test
```

The suites that matter, and what each one would catch:

| File | Covers |
|---|---|
| `src/lib/scanQueue.test.ts` | 50 scans with the network off, sync on reconnect, double-admit across two devices |
| `src/lib/scanContract.test.ts` | The pure scan resolver shared by the optimistic UI and the sync loop |
| `src/lib/money.test.ts`, `src/lib/ledger.test.ts` | Currency formatting, ledger folding, CSV export |
| `src/lib/floorplan.test.ts` | Booth overlap, mirroring the database's EXCLUDE constraint exactly |
| `src/components/CircleApplicationForm.test.tsx` | Application submit and validation, against the demo store |
| `src/components/RequireRole.test.tsx` | Role-guard redirects |
| `src/components/ui/tokens.test.ts` | Every token pair at AA contrast in both themes |
| `src/lib/i18n.test.ts` | Key-set parity across EN/JA/ID |
| `src/test/criteria.test.ts` | Repo-level properties: no mock data ships, every nav path has a route, the token gate has no exemptions |

### Testing the PWA

Never in `pnpm dev` — service workers behave differently there and a green
result proves nothing.

```bash
pnpm build && pnpm preview
```

Then in DevTools → Application: confirm the service worker is activated and the
manifest is picked up, tick Network → Offline, and reload. Only public Supabase
Storage objects are runtime-cached; nothing from `/rest/v1`, `/auth/v1` or
`/realtime/v1` is, because a cached ticket read is a stale "valid" answer.

---

## Deployment

Vercel: connect the repo, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`,
deploy. `VITE_DEMO_MODE` is off in a build unless you set it. The payment
webhook additionally needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`MIDTRANS_SERVER_KEY` and `MIDTRANS_IS_PRODUCTION` — all server-side, none
prefixed `VITE_`. `.env.example` lists every name with no values.

Any static host works for the frontend, but `api/webhooks/payment.ts` needs a
serverless runtime.

---

## Not built

Honest gaps, kept in sync with the Deferred section of `PROGRESS.md`:

- **Staff shift scheduling, incident tracking, staff performance metrics and
  internal chat** — outside the scope fence.
- **Web Push send** — needs VAPID keys and a server route to hold the private
  half. In-app notifications cover the same jobs.
- **Email invitations for staff** — needs the service role key, so it needs a
  server route. Staff are invited by the email address of an existing account.
- **Per-gate attendance counters** — one counter row per event today.
- **Creating an event from the UI** — an organizer's first event is inserted by
  hand. Everything after that is event-scoped and works.
- **The payment webhook has never been executed.** Signature verification and
  status mapping are written against Midtrans's documented contract and
  reviewed, not run: `pnpm dev` is Vite alone and serves no functions, so it
  needs `vercel dev` or a preview deployment.

---

## License

MIT — see `LICENSE`.
