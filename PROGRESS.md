# DoujinDesk — Progress

Branch: `feat/functional-rebuild`. Brief: `PLAN_PROMPT.md`. Plan: `PLAN.md` (16 packages, 7 waves).

**Status: waves 0-3 landed. Waves 4-6 not started.** 14 commits. Typecheck, tests and
build are green; `pnpm lint` is not (see Known-not-done).

---

## Start here next session

```
Wave 4  P9-data-layer                                                    <- next, serial, gates everything
Wave 5  P11-circle-path, P12-booth-floorplan,
        P13-attendee-surface, P14-organizer-ops                          4 parallel
Wave 6  P16-hardening                                                    criteria sweep, README, a11y
```

Each package's full instruction is in `PLAN.md` under its `### <id>` heading. An
implementer agent needs `PLAN_PROMPT.md` plus its own package section and nothing else.

**Do Wave 4 before anything else.** `P9-data-layer` authors the seam all four Wave 5
packages build on: `database.types.ts` generated against migrations 001-006,
`createClient<Database>`, and the TanStack Query hook pattern. Four agents writing
features in parallel against an unstable seam produce four different shapes. It also
deletes `circleStore`, `ticketStore`, `financialStore` and `staffStore`, which are
hand-rolled caches of server data that TanStack Query supersedes.

---

## Blocked - needs the owner

1. **Apply the migrations.** Six files in `supabase/migrations/` are written, committed
   and never run. `.env` points at a live project (`iaieygnykpwckdwkhcqc`). Review, then
   `supabase db push`. `supabase/migrations/README.md` carries the apply order plus six
   paste-able `SET LOCAL role` assertions that prove the RLS policies do what they claim.
   **Nothing from Wave 4 on can be tested end to end until this lands** - the app now
   authenticates for real against a database whose `profiles` table does not exist yet.

2. **Rotate the Supabase service role key.** It sat in plaintext in `supabase/config.ts`
   on disk. Verified never committed (`git log --all -S 'service_role'` is empty) and the
   file is deleted, so this is precaution rather than incident response - but `exp` is
   2035 and rotation is cheap.

3. **Confirm or revert the brand colour change.** Light `--primary` moved `#ff4500` ->
   `#d63900` because the original measured 3.44:1 on a 14px button label, under the 4.5:1
   AA threshold criterion 6 requires. To keep the original orange exactly: revert
   `--primary` and add a `--primary-strong` (16 100% 42%) used only by text-bearing
   surfaces - one token plus a Button variant change.

4. **Supply a brand SVG for the PWA icons.** They were generated from
   `public/favicon.svg`, which is green on near-black and does not match the orange brand.
   `pnpm dlx @vite-pwa/assets-generator --preset minimal-2023 public/<brand>.svg`

---

## Known-not-done

- **Mock data still reaches 9 screens**: `AnnouncementSystem`, `AttendeeRegistration`,
  `CircleCatalog`, `EventGuide`, `EventSchedule`, `FinancialManagement`, `InteractiveMap`,
  `NotificationCenter`, `QueueStatus` - plus `eventStore` and `financialStore`. All owned
  by Wave 5. Success criterion 1 is not met yet.
- **`CircleManagement.tsx:433,464` writes status `'approved'`**, which the CHECK
  constraint rejects - it only permits `'accepted'`. The review queue throws on every
  approval. `P11-circle-path` owns the fix.
- **`pnpm lint` exits 1** on 21 errors + 8 warnings, all pre-existing `no-explicit-any` /
  `no-unused-vars` in Wave 5 files. The new token gate contributes zero. Each Wave 5
  package removes its own files from the baseline in `eslint.config.js`.
- **The floor plan needs rebuilding on plain SVG.** `leaflet`/`react-leaflet` were dropped
  as dead weight; `P12-booth-floorplan` builds the geometry model directly.
- **Bundle is 929 kB** (266 kB gzipped) in a single chunk. Unaddressed.
- **No payment webhook yet.** `api/` holds no server. `P11-circle-path` adds exactly one
  `@vercel/node` handler at `api/webhooks/payment.ts`. It can only be exercised via
  `vercel dev` or a preview deploy, never `pnpm dev`.

---

## Correction to the plan

`PLAN.md` originally claimed `tailwind.config.js` emitting `hsl(var(--primary))` without
`<alpha-value>` made every `bg-primary/90` compile to nothing. **False.** Tailwind
v3.4.17 infers the alpha channel from the bare form. `P7-design-system` caught it by
compiling HEAD's config in isolation rather than trusting the plan; independently
re-verified. Retracted in `PLAN.md` (commit `6e867d3`). The canonical `<alpha-value>`
form landed anyway as upgrade insurance, but nothing was broken.

Treat the rest of the plan the same way: test a premise before building on it.

---

## Done

- Planning — audited the codebase across 5 lenses, researched UX references on
  Mobbin, generated and merged 3 competing architecture proposals into `PLAN.md`
  (16 packages, 7 waves).
- `P1-repo-hygiene` — narrowed `.gitignore` (blanket `supabase/` and `*.sql` →
  `supabase/.branches/`, `supabase/.temp/`, `supabase/config.ts`, `backups/*.sql`)
  and deleted `supabase/config.ts` in the same commit, so tracking migrations never
  exposed the plaintext service role key it held. `001_initial_schema.sql` is now
  tracked. Added `.env.example` (four names, no values) and extended `.vercelignore`.
- `P2-rls-foundation` — wrote `supabase/migrations/002_identity_and_rls.sql`:
  `profiles` + `app_role` enum with a signup trigger that cannot mint an organizer,
  `staff` hardened into a real membership table, and four `SECURITY DEFINER`
  helpers (`current_app_role`, `is_event_staff`, `is_event_organizer`,
  `manages_profile`) that end the 42P17 recursion — every 001 policy is dropped and
  rewritten so no policy predicate names `staff`. Also: separate `TO anon` /
  `TO authenticated` read policies, a `BEFORE UPDATE` guard so a circle owner can
  no longer self-approve or zero their own `total_amount`, all seven `GRANT ALL`
  replaced with narrow verb sets (GRANT ALL includes TRUNCATE, which ignores RLS),
  column-level UPDATE grant on `profiles` so nobody self-promotes, working
  `updated_at` triggers, and `events.timezone`. `supabase/migrations/README.md`
  carries the apply order plus six paste-able `SET LOCAL role` assertions. Not
  applied — see Blocked.
- `P3-platform` — dropped 13 dependencies (leaflet ×3, express/cors/dotenv/nodemon/
  concurrently + their types, the two Trae IDE plugins, `vite-tsconfig-paths`),
  added TanStack Query, i18next, `@fontsource-variable/figtree`, Vitest + Testing
  Library + `fake-indexeddb`, and `vite-plugin-pwa`. Deleted the Express server
  (`api/app.ts`, `index.ts`, `server.ts`, `routes/auth.ts`), `nodemon.json` and the
  dev proxy: **every privileged operation in this plan is a Postgres
  `SECURITY DEFINER` RPC called with the user's own JWT**, so there is no server
  and no service-role key in the runtime. The one exception is the inbound
  payment-gateway webhook, whose caller holds no Supabase JWT — P11 adds exactly
  one bare `@vercel/node` handler at `api/webhooks/payment.ts`. Trade recorded:
  that endpoint can only be exercised via `vercel dev` or a preview deploy, never
  `pnpm dev`. `@vercel/node` and the `/api/(.*)` rewrite stay for it. Vitest is
  configured inside `vite.config.ts` (jsdom, globals, `src/test/setup.ts`);
  `pnpm test` and `pnpm build` are green and the build emits `dist/sw.js` +
  `dist/manifest.webmanifest`. PWA runtime caching is **one** entry — public
  Supabase Storage objects, CacheFirst — and nothing from `/rest/v1`, `/auth/v1`
  or `/realtime/v1`, because a cached ticket read is a stale "valid" answer and
  the Cache API outlives logout. Added `pnpm-workspace.yaml`
  (`allowBuilds: esbuild: true`); without it `pnpm install` exits 1 on
  ERR_PNPM_IGNORED_BUILDS and every CI/Vercel install fails.
  - PWA icons (192, 512, 512 maskable, 180 apple-touch, favicon.ico) were
    generated from `public/favicon.svg` — it scales cleanly, but **the mark is
    green on near-black and does not match the orange `--primary` brand**. Owner:
    supply a real brand source SVG and re-run
    `pnpm dlx @vite-pwa/assets-generator --preset minimal-2023 public/<file>.svg`.
  - `pnpm lint` still exits 1 on 24 pre-existing errors in files owned by other
    packages (`stores/*`, `components/*`, `ui/badge|button|form|textarea`). Not
    touched here; P7 installs the lint gate and the baseline disables.
- `P7-design-system` — collapsed `src/index.css` to one token source (deleted the
  Tailwind-v4 `@theme inline` block and the duplicate raw-hex `:root`/`.dark`
  inside `@layer base`, ~185 dead lines, as its own revertible commit), then made
  the palette legal: `--primary` 16 100% 50% → **16 100% 42%** in light so a 14px
  button label clears AA (3.44:1 → 4.72:1); `--destructive` is a real red instead
  of being byte-identical to `--primary`; `--success`/`--warning`/`--info` added
  with a `-foreground` and a `-subtle` surface each. 41 assertions in
  `src/components/ui/tokens.test.ts` hold every pair at ≥4.5:1 in both themes and
  fail if a second `:root` or an `@theme` block reappears. `tailwind.config.js`
  now exposes the `--shadow-*` tokens as `boxShadow` (making `shadow-xs` real),
  the 8 sidebar colours, `borderRadius.xl`, and a `coarse:` variant for 44px tap
  targets. Fonts: one `@import '@fontsource-variable/figtree'` replaces the Google
  Fonts URL and the 98-line "local backup" that pointed at gstatic TTFs; CJK
  system fallback appended to `--font-sans`; `--font-mono` no longer points at a
  proportional face. Primitives: `<CardAction>` was landing in the wrong grid cell
  because `has-data-[slot=…]` is v4 shorthand that compiled to nothing; badge
  gained success/warning/info/danger variants. `EmptyState` replaces
  `src/components/Empty.tsx`. An ESLint `no-restricted-syntax` gate rejects raw
  palette classes, gradients and hex in `.tsx`, with the 17 known-bad files
  baselined in `eslint.config.js`.
  - **The alpha-value bug in the plan does not exist.** `PLAN.md` "Verified
    starting state" #4 claims `hsl(var(--primary))` without `<alpha-value>` makes
    every `bg-primary/90` and `ring-ring/50` compile to nothing. Compiling HEAD's
    config in a scratch project before editing showed the opposite: Tailwind
    v3.4.17 infers the alpha channel itself, and both utilities were already
    emitting `hsl(var(--primary) / 0.9)` and `hsl(var(--ring) / 0.5)`. The
    canonical `<alpha-value>` form is still what landed — it is the documented
    contract and survives a Tailwind upgrade — but no rendering changed, and the
    "every focus ring renders blue-500" consequence was never true.
  - **Brand change to confirm.** Light-theme `--primary` is now `#d63900`, not
    `#ff4500`. If the owner wants the original orange kept exactly, the
    alternative is reverting `--primary` and adding a `--primary-strong`
    (16 100% 42%) used only by text-bearing surfaces — one extra token and a
    Button variant change, no other edits.
  - `pnpm lint` exits 1 on **23** pre-existing errors (`no-explicit-any`,
    `no-unused-vars`, `prefer-const`) in `stores/*`, `hooks/use-toast.ts` and 7
    screen components — all owned by later packages. The new token gate
    contributes **0** violations. One of the 24 (`ui/textarea.tsx`) was in this
    package's lane and is fixed.

- `P4-scan-contract` — froze the contract the Dexie queue, the scanner UI and the
  criterion-3 tests are all written against. `supabase/migrations/003_scanning.sql`
  adds `ticket_passes` (one opaque-uuid pass per admitted person, so an order for
  five admits five and not once-or-unlimited) and an append-only `ticket_scans`
  that logs failures too. Two constraints carry the whole offline story:
  `UNIQUE (client_scan_id)` makes replaying the IndexedDB queue idempotent, and
  the partial unique index `one_admission_per_pass` makes double admission
  impossible **in the database** — the 23505 it raises *is* the visible conflict
  criterion 3 asks for. `redeem_tickets(p_scans jsonb)` is `SECURITY DEFINER`,
  `SET search_path = ''`, authorises every item separately, locks the parent
  order, evaluates the validity window in `events.timezone`, and returns the same
  seven keys for a fresh scan and a replayed one (one builder,
  `scan_result_json`). No write policy on either table plus
  `REVOKE INSERT, UPDATE, DELETE`, so a scanner-role staffer cannot hand-forge an
  `admitted` row. `src/lib/scanContract.ts` is the TypeScript half — zero imports,
  no Supabase, no React — with one pure `resolveScanOutcome(local, server)` used
  by both the optimistic UI and the authoritative sync loop, so the two can never
  disagree about what "already used" means. 9 tests in `scanContract.test.ts`,
  no DB and no DOM.
  - **`PendingScan` carries `event_id`, which `PLAN.md` does not list.** It has
    to: `ticket_scans.event_id` is NOT NULL and an unknown code still gets
    logged, so it cannot be derived from the pass. It is also what the server
    compares against the pass to produce `wrong_event`. P10 must send it.
  - **`resolveScanOutcome` never returns `admitted` without a server answer.** A
    queued scan is amber, permanently, until `flush()` resolves it, and a
    `duplicate` sets `autoDismiss: false` as part of the contract rather than as
    a UI choice. Anything that paints an unconfirmed scan green is the silent
    double-admit in a nicer colour.
  - **Re-entry.** `one_admission_per_pass` also blocks legitimate wristband
    out-and-back, which real conventions do. The upgrade path is already in the
    schema: `scan_type = 'reentry'` sits outside the partial index. Never drop
    the index — that restores double-admission with no error anywhere.

- `P15-i18n` — `src/lib/i18n.ts` initialises i18next + react-i18next with
  `fallbackLng: 'en'`, six route namespaces (`common`, `auth`, `circle`,
  `scanner`, `catalog`, `organizer`) and 18 seeded JSON files under
  `src/locales/{en,ja,id}/`. No language detector and no HTTP backend:
  `navigator.language.split('-')[0]` with a `doujindesk.locale` localStorage
  override is the detector, and `import.meta.glob` is the backend — `en` eager
  (it is the fallback and the first paint), ja/id lazy, so the build emits 12
  separate locale chunks and a JA bundle never reaches an EN user. A
  `languageChanged` listener writes `document.documentElement.lang`, which
  `index.html` hardcodes to `en` and which is what selects the right regional
  glyph variants for shared Han characters and tells a screen reader which voice
  to use. `setLocale()` loads bundles *before* switching, persists to
  localStorage, and best-effort echoes to `profiles.locale` (lazy-imported
  Supabase, every failure swallowed — signed out, offline, or 002 not applied)
  so the preference follows a staffer to the phone at the door.
  `LanguageSwitcher.tsx` is a `ui/select` with `min-h-11`, an `aria-label`, and
  `lang=` per option. 8 assertions in `src/lib/i18n.test.ts`, including a key-set
  equality check across all three locales for **every** namespace — that is the
  test that fails when a Wave 5 package adds an `en` key and forgets ja/id, which
  would render the raw key on a Japanese screen.
  - **Furigana is not a translation** — a comment at the top of `i18n.ts` says so
    at length, because `circle_name_furigana` sits next to `circle_name` and
    invites the mistake. It is a kana reading aid for sort order (P6 index) and
    kana search (P13 query), stored per circle. Never an i18next key.
  - Plural keys deliberately differ per locale: `en` carries `_one`/`_other`,
    `ja` and `id` carry `_other` only, because `Intl.PluralRules` gives those two
    a single category. The key-set test strips the suffix before comparing.
  - Where a translation was uncertain the English string was **not** left in
    place — all three locales are fully written. Owner should still have a native
    JA/ID reader review the JSON; the risk is register (お/敬語 level, formal vs
    casual ID), not correctness.
- `P5-money-core` — wrote `supabase/migrations/004_money.sql` and `src/lib/money.ts`.
  Criterion 4 in three mechanisms: (1) `financial_transactions_immutable()`, a
  `BEFORE UPDATE OR DELETE` trigger that unconditionally raises — RLS does not
  constrain the table owner or the service role the payment webhook uses, a trigger
  does; (2) ledger rows are INSERTed only by `AFTER UPDATE` triggers on `circles`
  and `ticket_purchases` that fire on a `payment_status` transition, with no INSERT
  policy and no INSERT grant for anon or authenticated anywhere in the schema;
  (3) `event_financial_summary`, a `security_invoker` view the dashboard reads
  instead of reducing rows in a component. Refunds are reversing `debit` entries
  carrying `reverses_transaction_id`, never edits. Also: `purchase_tickets()` reads
  price out of `tickets` server-side and does its oversell guard in one
  `UPDATE … WHERE quantity_sold + n <= quantity_available RETURNING`, so two buyers
  for the last seat serialise on the row lock; a `BEFORE INSERT OR UPDATE` trigger
  on `circles` recomputes `total_amount` from a new `event_pricing` sheet and
  discards whatever the browser sent; every money column widened off 001's
  `DECIMAL(10,2)` (Rp 99,999,999.99 — under USD 6,500, i.e. one mid-sized event's
  gate). `src/lib/money.ts` is the only place an amount becomes a string: currency
  is event-scoped, locale is user-scoped, and they are never coupled.
  - **Verified by execution, not by reading.** 001 → 002 → a stub 003 → 004 were
    applied to a throwaway local `postgres:15` container (never the live project)
    and exercised: server-side pricing, oversell rejection, one pass per head,
    trigger-written ledger row, `UPDATE`/`DELETE` on the ledger both blocked,
    a circle owner's `total_amount = 0` tamper overwritten to the derived 675,000,
    refund posting a reversing debit, and `event_financial_summary` netting
    correctly. Under `SET ROLE authenticated` an attendee sees **0** ledger rows and
    **0** summary rows while the organizer sees 3 of each — `security_invoker` is
    doing its job.
  - **Deviation from the plan, deliberate:** the plan asked for a `status` column on
    `ticket_purchases` with the domain `('pending','paid','cancelled','refunded')`.
    001 already ships `payment_status` with exactly that domain. Two columns holding
    one state diverge, and when they do the ledger trigger fires on one while the UI
    reads the other — a silent accounting bug. **`payment_status` is the canonical
    order state; downstream packages write that, not `status`.**
  - **Second deviation:** the plan asked to `REVOKE UPDATE (quantity_sold, price)`.
    `quantity_sold` is revoked (re-issued as a per-column grant, since Postgres
    cannot subtract a column from a table-wide grant). `price` is deliberately left
    grantable: column grants apply to every `authenticated` role including
    organizers, so revoking it would leave the tier editor with no door while
    closing nothing — `tickets_write_organizer` already restricts every UPDATE to
    organizers and `purchase_tickets()` never reads a client price.
  - **Consequence the owner should know:** `authenticated` has no UPDATE grant on
    `ticket_purchases` at all, so nothing in the browser can move an order to
    `paid`. That transition belongs to P11's payment webhook on the service role.
    Until that lands, an order can only be marked paid from the SQL editor.
  - **Consequence #2:** the immutability trigger also blocks `DELETE`, including via
    `ON DELETE CASCADE`. An event that has taken money can no longer be deleted —
    retire it with `events.status = 'cancelled'`. This is intended; the ledger is
    the point.

- `P6-schema-completion` — wrote `005_operations.sql` and
  `006_catalog_floorplan_storage.sql`. **005**: the ~15 form fields that are not
  columns (so the app's only real write stops failing with PGRST204),
  `sells_commission` DECIMAL→boolean with the rate moved to `commission_rate`,
  `draft`/`submitted` added to the application_status domain, `circle_code`'s
  *global* UNIQUE replaced by `UNIQUE(event_id, circle_code)` (every convention
  restarts at A-01) plus `UNIQUE(event_id, user_id)` so one account cannot flood
  the queue, a `circle_name_sort_key` folded katakana→hiragana by an IMMUTABLE
  `kana_sort_key()` and maintained by trigger (Postgres orders kanji by code
  point, which is not 五十音), and five operations tables — `staff_tasks`
  (uuid[] + GIN, not a join table), `announcements` (jsonb title/body keyed
  {en,ja,id}), `notifications`, `event_schedule`, `queues` — plus
  `event_counters`. The counter exists because a raw `ticket_scans` subscription
  at doors-open is O(scans × clients) of realtime traffic to every organizer
  phone on venue wifi; one row is O(clients). `admitted_count` is incremented by
  an AFTER INSERT trigger on `ticket_scans` (entry only — `reentry` would inflate
  the headcount every lunch break), `queue_total` is rolled up from open
  `queues`, and neither has a write grant. **006**: `public.circle_catalog`, a
  `security_barrier` view with an explicit projection and no `SELECT *` — `anon`
  never gets a policy on `circles`, because that row holds email, phone, address,
  co-rep contacts and emergency contacts; `booths_no_overlap`, a
  `btree_gist` EXCLUDE constraint that makes geometric collision a 23P01 from the
  database rather than a check two organizers on two laptops can both pass;
  `one_booth_per_circle`; `events.floor_plan jsonb`; and two storage buckets with
  real `file_size_limit`/`allowed_mime_types` (the form's 5MB check is one curl
  away from irrelevant) behind owner-folder policies on `storage.objects`.
  - **Verified by execution.** 001 → 006 were applied in order to a throwaway
    local `postgres:15` container (never the live project) behind ~40 lines of
    Supabase-shaped stubs (`auth.users`, `auth.uid()`, `storage.buckets/objects`,
    `storage.foldername`, the `anon`/`authenticated` roles, an empty
    `supabase_realtime` publication), then exercised with 37 `RAISE EXCEPTION`
    assertions under `SET ROLE authenticated` / `SET ROLE anon` — all green,
    including: an applicant can submit their own draft but cannot self-approve,
    write `review_notes`/`waitlist_position` or zero `total_amount`; an organizer
    accept stamps `reviewed_at`/`reviewed_by`; 亜細亜組 sorts before 渋谷スタジオ
    by reading; `anon` reads 3 catalog rows and 0 raw `circles` rows; an accepted
    circle on a *draft* event stays out of the catalog; edge-adjacent booths are
    allowed while a genuine overlap raises 23P01; two `redeem_tickets` admissions
    move the counter to 2 and a duplicate + a reentry leave it there; a recipient
    can mark a notification read but cannot rewrite its text or post into anyone
    else's inbox; a circle cannot upload into another circle's storage folder.
    The harness was deleted afterwards — it is 5 files and reproducible from this
    paragraph, and it is not this package's to own.
  - **The plan asked for a new `enforce_circle_field_permissions()` trigger.**
    002 already ships exactly that under the name
    `circles_guard_privileged_columns`, and the name is load-bearing: BEFORE
    triggers fire in name order and 004's `circles_set_total_amount` must run
    after it. A second trigger would fight the first, so 005 issues a
    `CREATE OR REPLACE` of the 002 *function* (002's file is untouched) that adds
    the new review columns and **one behaviour change**: a non-organizer may now
    make the single transition `draft → submitted`. Without it the applicant
    cannot press Submit, because 002's guard reverts every `application_status`
    change for a non-organizer.
  - **The EXCLUDE constraint insets each booth by 0.01.** `box && box` treats
    boxes that merely *touch* as overlapping, and convention floor plans are laid
    out edge to edge — the literal expression in `PLAN.md` would have rejected
    A-02 placed flush against A-01 and made the constraint unusable. Coordinates
    are `numeric(8,2)`, so 0.01 is one representable unit: booths must genuinely
    interpenetrate to be refused. Tested both ways.
  - **`notifications.title`/`body` are jsonb, not text.** The plan lists them as
    plain columns, but the announcement fan-out would then have to pick a locale
    per recipient at write time and freeze the text in whatever language they
    preferred that day. jsonb keyed `{en,ja,id}` matches `announcements`; the
    client renders `body[locale] ?? body.en`.
  - **`circle_catalog` also projects `description` and `works_description`**,
    which the plan's column list omits. They are circle-authored catalog copy,
    the only prose the catalog has, and P13 cannot add them (the view is this
    package's). Everything genuinely private is named in a `COMMENT ON VIEW` as
    a do-not-add list.
  - **`circles.circle_code` is now nullable.** 001 made it NOT NULL, which is why
    the application form generates `C123456AB` junk client-side. A draft has no
    code, and the real code (A-01) is the organizer's to allocate. P11 should
    stop generating one.
  - **For P11/P12/P13**: the upload path must become `${uid}/${uuid}.${ext}` in
    bucket `circle-public` or every upload 403s (tested); `booths.circle_id` is
    the single source of truth for allocation and `circles.booth_number` is
    deprecated — read `circle_catalog.booth_number`; catch 23P01 from the
    floor-plan editor instead of re-implementing collision detection; and
    `announcements`/`event_schedule` titles are jsonb, not strings.

- `P10-offline-scanner` — criterion 3, built on the P4 contract and the 003
  constraints. `src/lib/scanQueue.ts`: Dexie (`doujindesk-scans`) with
  `pendingScans` + `ticketMirror` + `mirrorMeta`; `enqueue()` writes IndexedDB
  before anything touches the network, `flush()` drains `sync_state='pending'` in
  batches of 50 through one `redeem_tickets` RPC and is idempotent via
  `UNIQUE(client_scan_id)`, triggered on `online` and `visibilitychange` (never
  Background Sync — iOS Safari does not implement it). Any non-admitted answer
  becomes a `conflict` row that survives until acknowledged. `checkLocal()` reads
  the pre-doors mirror plus this device's own queue and returns `null` only when
  there is genuinely nothing to say. `src/lib/ticketCode.ts`: the scannable
  payload is the `qr_token` uuid and nothing else; `src/lib/qrcode.ts` is down to
  `generateQRCode` — the old `parseQRCode`/`validateQRCode` decided admission
  from the payload's own claims, so typing JSON into the manual box admitted a
  person. `TicketScanner.tsx` rewritten as a full-bleed viewfinder
  (`BarcodeDetector` decode loop at ~8fps, corner brackets, sync-state chip,
  torch, always-available manual entry, mirror download with count + timestamp,
  vibrate + WebAudio per outcome) with `ScanResultSheet` (green admitted / amber
  queued / red duplicate naming the winning device, gate and time) and a
  persistent `ConflictList`. The lying `syncOfflineData()` "Sync Complete" toast
  and the local-array "already used" check are gone. 9 tests in
  `src/lib/scanQueue.test.ts` against a fake server that enforces both SQL unique
  constraints, including the 50-scans-offline case (zero network calls, one RPC
  on reconnect) and double-admit across two devices. `TicketScanner.tsx` removed
  from the eslint token-gate baseline.

- `P8-auth-shell` — criterion 2. `src/stores/authStore.ts` rewritten against
  Supabase Auth: `getSession()` on boot plus an `onAuthStateChange` subscription
  (`initAuth()` from App.tsx), `signIn/signUp/signOut`, and `role` read from the
  `profiles` table — the seeded admin user, `'mock-session-token'`,
  `permissions: string[]`, `hasPermission()` and the `persist` middleware are all
  gone (a persisted role is a privilege bug; the Supabase client already persists
  the session). `RequireRole` guards every route: skeleton while `loading`,
  `/login?next=…` when unauthenticated, the role's own home when the role is
  wrong. Three layout routes in `App.tsx` — Public (topbar + footer), App (240px
  `--sidebar-*` rail collapsing to a Radix Dialog drawer below `lg`, event
  switcher on top, EVENT/OPERATIONS/MONEY groups from `layout/nav.ts`, role badge
  + user row pinned at the bottom, topbar with breadcrumb, connectivity chip,
  theme toggle, bell and account menu) and Focus (full-bleed, no chrome, what the
  scanner renders into). Nine previously unrouted components now have a path and
  a role, `eventId="default-event-id"` is gone, and `:eventId` from the URL is the
  only event scope. `useTheme` is a real module store with an explicit topbar
  toggle, OS default and localStorage persistence — it was previously per-component
  state whose only caller was `<Toaster />`. `Footer` folded into the role-aware
  nav table (it used to offer Financial, Staff and Booths to anonymous
  attendees); `FontLoader.tsx` deleted (its `mode: 'no-cors'` HEAD check could
  never fail, and P7 self-hosts the font). `Home.tsx` rewritten as the honest
  landing page and event chooser — the `from-blue-50 to-indigo-100` gradient, the
  103 palette violations, "Join thousands of circles and organizers" and "Trusted
  by Convention Organizers" are gone, and it now lists real events from Supabase
  with loading/error/empty states; removed from the eslint token-gate baseline.
  New `shell` i18n namespace in en/ja/id. 10 tests: `RequireRole.test.tsx` (4)
  and `layout/nav.test.ts` (6).

---

## Deferred - outside the scope fence


Anything found outside the scope fence in `PLAN_PROMPT.md` gets one line here
rather than an implementation.

- `.gitignore` line 128 is a blanket `auth.json` (meant for composer/npm
  credential files) and it silently ate `src/locales/{en,ja,id}/auth.json` — they
  are tracked now only because P15 used `git add -f`. `config.json`,
  `secrets.json` and `credentials.json` on lines 126–129 are the same trap for any
  future source file. The fix is anchoring them (`/auth.json`), which lives in
  `.gitignore` — P1's file, so left alone here. Run
  `git status --ignored --short src/` after adding source files until it lands.
- Staff shift scheduling — outside the scope fence.
- Incident tracking — outside the scope fence.
- Staff performance metrics — outside the scope fence.
- Internal staff chat / messaging — outside the scope fence (the brief names "no
  chat system" explicitly).
- Web Push *send* — needs VAPID keys and a server route to hold the private half.
  In-app notifications cover the same jobs without either.
- 23 pre-existing `@typescript-eslint` errors (`no-explicit-any`,
  `no-unused-vars`, `prefer-const`) in `src/stores/*`, `src/hooks/use-toast.ts`
  and 7 screen components. Left alone by P7 — those files belong to P9 (which
  deletes four of the stores outright) and to the Wave 5 screen packages. P16
  closes whatever survives.
- Shell follow-ups P8 could not do inside its own files: strip the now-redundant
  `min-h-screen` wrappers from `Dashboard.tsx:195`, `BoothAllocation.tsx:224`,
  `EventGuide.tsx:238` and `AttendeeRegistration.tsx:231/275` (they nest a
  full-height scroll container inside the shell's own) — those files belong to
  P12/P13/P14. `/circle/status` and `/wallet` still point at
  `CircleApplicationForm`/`AttendeeRegistration` until P11 adds
  `pages/CircleStatus.tsx` and P13 adds `TicketWallet.tsx`. The event switcher has
  no `+ Create event` row because no package owns a create-event screen — an
  organizer's first event has to be inserted by hand today.
