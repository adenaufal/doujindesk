# DoujinDesk — Progress

Branch: `feat/functional-rebuild`. Brief: `PLAN_PROMPT.md`. Plan: `PLAN.md` (16 packages, 7 waves).

**Status: all 16 packages landed.** Typecheck, tests, lint and build are green.
The database migrations have **not** been applied — see Blocked #1. Until they
are, run the app in demo mode (`pnpm dev`, which turns it on by default).

```
pnpm dev      # fixture-backed demo, no .env needed, role picker in the banner
pnpm test     # 146 tests, 14 files
pnpm lint     # 0 errors, 6 react-refresh warnings
pnpm build    # tsc -b && vite build, emits dist/sw.js + manifest
```

---

## Blocked — needs the owner

Nothing here can be done by an agent. Each is one decision or one command.

1. **Apply migrations 002–006.** Six files in `supabase/migrations/`, written,
   committed, never run. `.env` points at a live project (`iaieygnykpwckdwkhcqc`).
   Read `supabase/migrations/README.md` first — it carries the apply order and six
   paste-able `SET LOCAL role` assertions that prove the RLS policies do what they
   claim. Then `supabase db push`. **Until this lands, `VITE_DEMO_MODE=false` gives
   an app that authenticates for real and errors on every screen**, because
   `profiles`, `ticket_passes`, `ticket_scans` and `financial_transactions` do not
   exist yet. Nothing below Wave 3 has ever run against a real database.

2. **Run the six-statement RLS checklist** in `supabase/migrations/README.md` after
   the push. The policies were verified against a throwaway local `postgres:15`
   container, never against this project.

3. **Rotate the Supabase service role key.** It sat in plaintext in
   `supabase/config.ts` on disk. Verified never committed
   (`git log --all -S 'service_role'` is empty) and the file is deleted, so this is
   precaution rather than incident response — but `exp` is 2035 and rotation is cheap.

4. **Confirm or revert the brand colour.** Light `--primary` moved `#ff4500` →
   `#d63900` (16 100% 42%) because the original measured 3.44:1 on a 14px button
   label, under the 4.5:1 AA threshold criterion 6 requires. To keep the original
   orange exactly: revert `--primary` and add a `--primary-strong` used only by
   text-bearing surfaces — one token plus a Button variant change.

5. **Confirm the payment provider.** Defaulted to **Midtrans Snap**. Changing it
   touches only the `gateway` object and the order-id codec in
   `api/webhooks/payment.ts`. Snap settles IDR only, so the USD Tokyo fixture event
   raises a named error rather than silently charging rupiah. Deployment also needs
   `MIDTRANS_SERVER_KEY` and `MIDTRANS_IS_PRODUCTION` (listed in `.env.example`,
   no values, server-side only).

6. **Supply a brand SVG for the PWA icons.** They were generated from
   `public/favicon.svg`, which is green on near-black and does not match the orange
   brand. `pnpm dlx @vite-pwa/assets-generator --preset minimal-2023 public/<brand>.svg`

7. **Have a native JA/ID reader review `src/locales/{ja,id}/*.json`.** All three
   locales are fully written; the risk is register (敬語 level, formal vs casual ID),
   not correctness.

---

## In progress

Nothing.

---

## Verification — the eight criteria

Every line below is a command that was run in this repo on this branch, with its
real result. Where a criterion cannot be closed without the migrations applied,
it says so instead of claiming a pass.

| # | Criterion | Command | Result |
|---|---|---|---|
| 1 | No mock data | `grep -rn "Mock\|mockUser\|mock-session" src/` | One hit: `vi.clearAllMocks()` in `src/components/attendee.test.tsx`. Nothing in shipped source. Asserted permanently in `src/test/criteria.test.ts`, which also fails on `Comic Frontier 18`, `Sakura Studios`, `2500000000`, `lorem ipsum` and `trae-api-sg`, and boots `src/main.tsx` against a seeded localStorage to prove the five legacy `persist` keys are removed |
| 2 | Auth is real | `pnpm test` → `RequireRole.test.tsx`, `nav.test.ts`, `criteria.test.ts` | Guards and redirects pass. **RLS is NOT verified against a live database** — migration 002 was exercised only in a throwaway container. Blocked #1/#2 |
| 3 | Scanner works offline | `pnpm test` → `src/lib/scanQueue.test.ts` (9), `scanContract.test.ts` (9) | Pass, including 50 scans with zero network calls, one RPC on reconnect, and a double-admit across two devices resolved to one admission plus one visible conflict. The fake server enforces both SQL unique constraints. **Never run against real Postgres** |
| 4 | Money is auditable | `pnpm test` → `money.test.ts`, `ledger.test.ts` | Pass. The ledger is written by trigger with no client INSERT policy; `FinancialManagement` has no update or delete path and every total reads `event_financial_summary`. Migration 004 was executed against a throwaway `postgres:15`, not this project |
| 5 | No AI slop | `pnpm lint` | **Exit 0.** `TOKEN_GATE_BASELINE` is empty — no file is exempted from the token gate. `criteria.test.ts` re-asserts zero raw palette classes, gradients and hex across every `.tsx`, and fails if the baseline is refilled. 6 remaining warnings are `react-refresh/only-export-components` on four primitives that export a `cva` variant next to a component |
| 6 | Works on a phone | headless-Chrome sweep at 320 / 768 / 1440 over 22 route+role combinations | **Zero horizontal scroll everywhere.** Tap targets, tab order and focus rings: see the sweep notes below |
| 7 | Critical paths tested | `pnpm test` | **14 files, 146 tests, exit 0.** All four required paths present: scan valid/used/queued, application submit + validation, booth allocation conflict, role-guard redirect |
| 8 | README describes the code | `README.md` rewritten; `criteria.test.ts` asserts every repo path it names exists | Pass |

Also green: `npx tsc --noEmit` exit 0, `pnpm build` exit 0 (emits `dist/sw.js` and
`dist/manifest.webmanifest`).

### The 320 / 768 / 1440 sweep

Driven over CDP against `chrome-headless-shell` with touch emulation on for the
two narrow widths, so `coarse:` actually applies — the Playwright MCP browser
profile is held by another process and could not be used. Signed in through the
demo role picker as each of organizer, staff, circle and attendee.

- **No route at any width has `scrollWidth > clientWidth`.** Not one pixel.
- Tab order on the dense organizer screens is skip-link → brand → event switcher →
  sidebar, every stop carrying a visible ring.
- Fixed during this sweep, all in shared primitives so the fix reached every caller:
  `ui/tabs.tsx` triggers were 32px on touch (now `coarse:min-h-11`, list drops its
  fixed height); `ui/checkbox.tsx` was a 16px hit target (now an invisible
  `coarse:after:-inset-3.5`, giving 48px of hit area with zero layout change —
  verified with `elementFromPoint`); the public topbar brand link was 32px.
- Accessible names added where Radix renders `button role="checkbox"`, which a
  wrapping `<label>` does **not** name (a button is not a labelable element):
  `CircleCatalog` facets, `AnnouncementSystem` audiences, `CircleApplicationForm`.
  `BoothAllocation`'s `sr-only` file input and `TicketScanner`'s missing `h1`
  likewise.
- **Known ceiling:** on the floor map and the booth editor at 320px, a booth is a
  17×9 px SVG rect. A whole hall scaled to a phone cannot give each booth 44px;
  both screens zoom, scroll and take arrow-key input instead.

---

## Done — one line per package

- **P1-repo-hygiene** — narrowed `.gitignore` so migrations could be tracked without
  exposing the service role key in `supabase/config.ts`, deleted that file, added
  `.env.example`.
- **P2-rls-foundation** — `002_identity_and_rls.sql`: `profiles` + `app_role`, a signup
  trigger that cannot mint an organizer, and four `SECURITY DEFINER` helpers that end
  the 42P17 recursion. Every 001 policy rewritten; no policy predicate names `staff`.
- **P3-platform** — deleted the 501-returning Express server, pruned 13 dependencies,
  added TanStack Query / i18next / Vitest / vite-plugin-pwa. **There is no application
  server**: every privileged operation is a `SECURITY DEFINER` RPC on the user's own JWT.
- **P7-design-system** — one token source in `src/index.css`, AA-legal palette, a real
  `--destructive`, `--success`/`--warning`/`--info`, 41 contrast assertions in
  `tokens.test.ts`, and the ESLint token gate.
- **P15-i18n** — i18next with six route namespaces across en/ja/id, lazy locale chunks,
  `<html lang>` tracking, and a key-set parity test that fails when a package adds an
  `en` key and forgets the other two.
- **P4-scan-contract** — `003_scanning.sql` plus the pure `scanContract.ts`.
  `UNIQUE (client_scan_id)` makes queue replay idempotent; the partial index
  `one_admission_per_pass` makes double admission impossible **in the database**.
- **P5-money-core** — `004_money.sql` plus `money.ts`. Immutable ledger written by
  trigger, `purchase_tickets` prices server-side, `event_financial_summary` is what
  dashboards read.
- **P10-offline-scanner** — Dexie queue, `BarcodeDetector` viewfinder, idempotent sync,
  conflicts that survive until acknowledged. Nothing paints green without a server answer.
- **P6-schema-completion** — `005_operations.sql` and `006_catalog_floorplan_storage.sql`:
  the missing circle columns, five operations tables, `event_counters`, the
  `circle_catalog` view, booth overlap constraints and storage policies.
- **P8-auth-shell** — real Supabase Auth, four roles from `profiles`, `RequireRole` on
  every route, three layout routes, event switcher, honest `Home`.
- **P9-data-layer** — hand-derived `database.types.ts`, `createClient<Database>`, 12
  TanStack Query modules behind one key factory, **and demo mode**: one seam in
  `src/lib/supabase.ts`, a PostgREST subset over an in-memory store, a role picker.
- **P11-circle-path** — application form with draft/upload/furigana, review queue with
  bulk actions and CSV, hosted-checkout payment, and `api/webhooks/payment.ts`.
- **P12-booth-floorplan** — one pure geometry model (`src/lib/floorplan.ts`, 26 tests)
  shared by a plain-SVG editor and the attendee map; allocation is a conditional
  `WHERE circle_id IS NULL` update the database arbitrates.
- **P13-attendee-surface** — catalog off the `circle_catalog` view with facets and 五十音
  sort, ticket checkout through `purchase_tickets` only, the QR wallet (new), schedule, guide.
- **P14-organizer-ops** — dashboard on `count: 'exact', head: true` queries and one
  realtime counter row, financial dashboard on `src/lib/ledger.ts`, staff roster and
  tasks, announcements, notifications, queues. Charts are inline SVG.
- **P16-hardening** — this pass: the criteria sweep above, the README rewrite, and the
  defects listed next.

### Fixed by P16 in files it does not own

By Wave 6 every screen package has landed, so these were fixed in place rather than
reported:

- **`ui/input.tsx` dropped every ref.** A plain function component under React 18, so
  the ref from react-hook-form's `register()` never attached: the field was never
  registered and `getValues()` returned `undefined` — a form that renders and
  validates correctly and submits nothing. Now `React.forwardRef`.
- **Mutations invalidated a key that could not match.** `queryKeys.circles.list(id)`
  is `['circles', id, null]`; `useCircles` caches under `['circles', id, {}]`, and
  those do not prefix-match. Fixed once in `useWrite` (`queries/core.ts`), which
  drops a trailing `null` sentinel before invalidating — so every filtered factory
  (`circles.list`, `circles.catalog`, `staff.tasks`, `announcements.list`) is fixed
  for every present and future caller, not just the one that was reported.
- **Three routes pointed at the wrong component.** `/wallet` rendered
  `AttendeeRegistration` (now deleted; `TicketWallet` is the element), `/tasks`
  rendered the organizer console instead of `pages/StaffTasks`, and
  `/e/:eventId/status` did not exist. `criteria.test.ts` now fails if any nav
  destination or `homeForRole` target has no route.
- **`USER.circle` owned two fixture circles on one event**, which 005's
  `UNIQUE (event_id, user_id)` forbids and which made `useMyCircle`'s `maybeSingle()`
  return PGRST116. The draft moved to a new `USER.circle3`.
- **Dead code deleted**: `src/hooks/use-toast.ts` (the radix-toast hook — the app uses
  sonner; it was also the last ESLint error), `src/stores/eventStore.ts` (no consumers
  left) and `src/components/AttendeeRegistration.tsx`.
- **`src/lib/i18n.ts` did not list `shell` or `floorplan` in `NAMESPACES`**, so the
  key-parity test silently skipped both. Added; parity holds (12 assertions, was 8).
- `src/main.tsx`'s cleanup comment quoted the fake literals it exists to remove, which
  failed the criterion-1 grep for the right reason. Reworded.

---

## Contracts a later agent must not re-derive

These were each established by execution and are load-bearing.

- **`payment_status` is the canonical order state on `ticket_purchases`**, not
  `status`. Two columns holding one state diverge, and the ledger trigger fires on one
  while the UI reads the other.
- **Never write `submitted_at`, `reviewed_at` or `reviewed_by` from the client.**
  `circles_stamp_lifecycle` stamps them and `circles_guard_privileged_columns` reverts
  anything a non-organizer sends.
- **006 insets each booth by 0.01 before `&&`**, so edge-adjacent booths are legal
  (convention aisles are flush) and two booths must interpenetrate by 0.02 to be
  refused. `overlaps()` in `src/lib/floorplan.ts` reproduces that exactly — a client
  pre-check stricter than the server is the one direction that must never happen.
- **`one_admission_per_pass` also blocks legitimate re-entry.** The upgrade path is
  already in the schema: `scan_type = 'reentry'` sits outside the partial index. Never
  drop the index — that restores silent double-admission.
- **`circle_catalog` is `security_barrier` with an explicit projection.** `anon` has no
  policy on `circles` because that row carries email, phone, address and emergency
  contacts. Any PII column added later must be kept out of the view; the do-not-add
  list is a `COMMENT ON VIEW`.
- **Uploads must go to `${uid}/${uuid}.${ext}` in `circle-public`** or 006's
  owner-folder policy 403s them.
- **`announcements` and `event_schedule` titles and `notifications` title/body are
  jsonb** keyed `{en,ja,id}`, not text.
- **`booths.circle_id` is the single source of truth for allocation.**
  `circles.booth_number` is deprecated; read `circle_catalog.booth_number`.
- **The ledger's immutability trigger blocks `DELETE` too, including via cascade.** An
  event that has taken money cannot be deleted — retire it with
  `events.status = 'cancelled'`.
- **`authenticated` has no UPDATE grant on `ticket_purchases`.** Nothing in the browser
  can move an order to `paid`; that transition belongs to the webhook on the service role.

---

## Known limits

- **The payment webhook has never been executed.** Signature verification, the Snap
  call and the status mapping are written against Midtrans's documented contract and
  reviewed, not run — `pnpm dev` is Vite alone and serves no functions, so it needs
  `vercel dev` or a preview deployment. First real run should watch the notification
  content-type and whether the finish redirect carries `transaction_status` on every
  channel.
- **Demo-mode writes are lost on reload**, by design, and the banner says so.
- **The demo shows one floor**, so the data-derived floor tabs on the map and editor
  never appear. Four to six booths at `floor_level: 2` plus a `reserved` and a
  `maintenance` booth would demo those paths.
- **The mobile checkout's fixed bottom bar sits under the demo banner.** Demo-only
  cosmetic overlap; the banner has a Hide button. A real fix needs a shared bottom-inset
  variable.
- **The bundle is one 1,090 kB chunk** (334 kB gzipped). No manual chunking, no route
  splitting. The i18n locale chunks are split; nothing else is.
- **Catalog search and facets filter the cached array client-side.** Fine to ~1k
  circles, wrong at 10k. The server-side path already exists as
  `useCircleCatalog(eventId, { search })`.
- **Floor-plan import is one round trip per booth, serially.** Fine once per event;
  a 600-booth hall is 600 requests and not atomic. Upgrade path is named in a
  `// ponytail:` comment: one SECURITY DEFINER RPC taking the plan as jsonb.
- **Six `react-refresh/only-export-components` warnings** in `ui/badge`, `ui/button`,
  `ui/form` and `scanner/ScanResultSheet` — each exports a `cva` variant beside its
  component. Warnings, not errors; splitting the files buys nothing but a file.
- **A few user-facing strings are hardcoded English** in the circle path (address,
  co-representative, the price-sheet caveat, the gateway channel list) — roughly 12 keys.
- **The floor-plan catalog Dialog is not deep-linkable.** `share()` copies
  `?circle=<id>` and nothing reads the param back.
- **Booth `rotation` is stored, rendered and round-trips, but there is no rotate
  handle.** Deliberate: 006 excludes on the un-rotated box, so rotation is presentation
  only and a handle would imply the geometry respects it.
- **Mobbin MCP and Context7 MCP require OAuth and were unauthenticated all session.**
  Screens were built against `PLAN.md`'s UI Spec (itself Mobbin-grounded) and the
  repo's own established patterns rather than fresh screenshot research.

---

## Deferred — outside the scope fence

One line each, per the brief, rather than an implementation.

- Staff shift scheduling.
- Incident tracking.
- Staff performance metrics.
- Internal staff chat / messaging — the brief names "no chat system" explicitly.
- Web Push *send* — needs VAPID keys and a server route to hold the private half.
  In-app notifications cover the same jobs without either.
- Email invitations for staff — `auth.admin.inviteUserByEmail` needs the service role
  key, so it needs a server route. Staff are invited by the email address of an existing
  account; `useInviteStaff` errors with `no-account` if there is none.
- Per-gate attendance counters — one `event_counters` row per event today.
- Creating an event from the UI — no package owns a create-event screen, so an
  organizer's first event is inserted by hand. Everything after that is event-scoped.
- A period delta on the finance KPIs — `event_financial_summary` has no time dimension,
  so a delta would have to be reduced from raw ledger rows, which is exactly what
  criterion 4 forbids. It needs a period-bucketed view, i.e. a migration.
- `venue_locations` (entrances, stages, food, restrooms on the attendee map) — no such
  table exists in any migration. Adding it is a migration, not a screen edit.
- Indoor wayfinding — a venue floor has no GPS fix and the schema carries no route
  graph. Needs a waypoint table plus a pathfinder.
- `.gitignore` lines 126–129 are blanket `auth.json` / `config.json` / `secrets.json` /
  `credentials.json` (meant for credential files) and they silently ate
  `src/locales/*/auth.json`, which are tracked only because P15 used `git add -f`.
  Anchoring them (`/auth.json`) is the fix.
