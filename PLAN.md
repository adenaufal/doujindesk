# DoujinDesk Implementation Plan

Synthesized from five independent codebase audits, a Mobbin UX reference sweep,
and three competing architecture proposals (foundation-first, vertical-slice,
risk-first). Task brief: `PLAN_PROMPT.md`. Branch: `feat/functional-rebuild`.

---

## Verified starting state

Four facts drive the whole sequencing. All were confirmed directly, not inferred.

**1. Nothing under `supabase/` has ever been committed.** `.gitignore:108` ignores
`supabase/`, and a second rule ignores `*.sql`. `git ls-files supabase` returns
empty. The schema everyone treats as the contract exists on one machine only.

**2. `supabase/config.ts` holds a plaintext `service_role` JWT.** It was never
committed — `git log --all -S 'service_role'` is empty — because the same overly
broad ignore rule that hid the migrations also hid the key. Nothing imports the
file. Narrowing the ignore rule to track migrations, without deleting this file in
the same commit, publishes the key. That is why repo hygiene is Wave 0 and alone.

**3. The RLS policies in `001` are recursive.** The `staff` SELECT policy
self-references `staff`, and circles / booths / tickets / ticket_purchases /
financial_transactions all subquery it. Today nothing is authenticated, so nothing
runs them. The first real login raises `42P17` on six tables simultaneously, and it
will read as an auth bug for as long as it takes someone to find the policy.

**4. `CircleManagement.tsx:433,464` writes application status `'approved'`**, which
the CHECK constraint rejects — it only permits `'accepted'`. The review queue throws
on every approval.

> **Correction.** An earlier draft of this plan listed a second breakage here: that
> `tailwind.config.js` emitting `hsl(var(--primary))` without `<alpha-value>` made
> every `bg-primary/90` and `ring-ring/50` compile to nothing. That is false.
> Tailwind v3.4.17 infers the alpha channel from the bare form; compiling HEAD's
> config in isolation emits `hsl(var(--primary) / 0.9)` and `hsl(var(--ring) / 0.5)`
> correctly. `P7-design-system` verified this before editing and landed the
> canonical `<alpha-value>` form anyway — it is the documented contract and survives
> a Tailwind v4 upgrade — but no rendering changed and nothing was broken.

Points 3 and 4 are not unfinished work. They are wrong models, and any feature
built on top of them gets rebuilt. Hence risk-first sequencing.

---

## Decisions

Where the three proposals disagreed, these are the resolutions.

| Decision | Choice | Why |
|---|---|---|
| Sequencing | Risk-first foundation, then one wide parallel feature wave | The three wrong models above invalidate work built on them; everything after Wave 4 is genuinely independent and fans out 4–5 agents wide |
| Server state | TanStack Query only; Zustand keeps client state (session, active event, scanner device) | Four of six Zustand stores are caches of server data reimplemented by hand; delete `circleStore`, `ticketStore`, `financialStore`, `staffStore` |
| `api/` Express server | Delete. Keep one Vercel serverless function: `api/webhooks/payment.ts` | Every route returns 501 today; the only genuine server-side need is the payment webhook, which requires the service role key and cannot live in the browser |
| PWA | `vite-plugin-pwa`, app shell precached | Hand-rolling a service worker for a live-event scanner is how you ship a stale build to a venue. Supabase responses are never precached; scanner routes are network-first |
| Offline scope | Dexie for the scan queue only | The scanner on bad venue wifi is the real offline requirement. General offline sync for every screen is unrequested scope |
| App shell | Three layout routes: Public, App (sidebar + topbar), Focus (fullscreen, no chrome) | Every component currently renders its own `min-h-screen` header. Focus layout exists so the scanner fills a phone screen |
| Money | Append-only `financial_transactions`, written by trigger, no client INSERT policy, `BEFORE UPDATE OR DELETE` trigger that raises | Criterion 4 says totals derive from rows. A ledger the client can write is not a ledger |
| QR tokens | Opaque `uuid` per pass, one row per admitted person (`ticket_passes`) | Today's `QR_${purchaseId}_${Date.now()}` is guessable and embeds the row id. A 5-person order currently admits either once or unlimited times — there is no correct middle without a per-pass row |
| i18n | `i18next` + `react-i18next`, `Intl.NumberFormat` for IDR/USD | Boring and correct on locale fallback and plural rules; JA has no plural forms and ID differs from EN. Hand-rolled `t()` gets this wrong quietly |
| Migrations | Written, committed, never applied | `.env` points at a live project. Applying is the owner's call |

---

## Waves

Within a wave, packages run in parallel and their owned files are disjoint.
Between waves, there is a barrier.

| Wave | Packages | Width | Theme |
|---|---|---|---|
| 0 | `P1-repo-hygiene` | 1 | Make the work committable; remove the key. Alone by necessity |
| 1 | `P2-rls-foundation`, `P3-platform`, `P7-design-system` | 3 | Fix the three wrong models |
| 2 | `P4-scan-contract`, `P5-money-core`, `P15-i18n` | 3 | Prove the risky contracts in pure code + tests |
| 3 | `P6-schema-completion`, `P8-auth-shell`, `P10-offline-scanner` | 3 | Real auth, full schema, the scanner |
| 4 | `P9-data-layer` | 1 | The seam every feature package builds on — authored once |
| 5 | `P11-circle-path`, `P12-booth-floorplan`, `P13-attendee-surface`, `P14-organizer-ops` | 4 | Features fan out; all mock data dies here |
| 6 | `P16-hardening` | 1 | Criteria sweep, a11y/responsive, README rewrite |

Shared-file ownership, to keep parallel agents from colliding:

- `package.json`, `vite.config.ts`, `vercel.json`, `index.html`, `tsconfig.json` → `P3-platform` only
- `src/index.css`, `tailwind.config.js`, `eslint.config.js`, `src/components/ui/*` → `P7-design-system` only
- `src/App.tsx`, `src/components/layout/` → `P8-auth-shell` only
- `src/main.tsx` → `P15-i18n` (later packages add provider wraps one line at a time)
- `src/lib/supabase.ts`, `src/lib/database.types.ts`, `src/lib/queries/` → `P9-data-layer` only
- `PROGRESS.md` → append-only for every package, one line under Done; only `P1` and `P16` restructure it

**Honest cost of this sequencing.** Waves 0–4 are roughly a third of the effort and
produce almost nothing to look at: a repo that can commit its own migrations, SQL
files the owner has not applied, a palette that finally compiles, a scanner, and a
data layer with no screens using it. Every dashboard still shows fake numbers until
Wave 5, because mock data is removed screen-by-screen there. It will feel slow and
then finish fast.

---

## Packages

Each package below is self-contained. An implementer agent receives
`PLAN_PROMPT.md` plus its own section and nothing else.


### P1-repo-hygiene — Make the work committable and remove the checked-in service role key

**Wave 0** · depends on: nothing

**Owns** (exclusive write access):
- `.gitignore`
- `.vercelignore`
- `.env.example`
- `supabase/config.ts`
- `PROGRESS.md`

**Instruction**

Nothing else in this plan survives a clone until this lands. Two changes, ONE commit, in this order.

1. `.gitignore` line 108 is a blanket `supabase/` and line 137 is `*.sql`. Together they mean `supabase/migrations/001_initial_schema.sql` has never been committed (`git ls-files supabase` returns nothing) and every 00N migration this plan writes would be invisible. Replace `supabase/` with exactly three narrow rules — `supabase/.temp/`, `supabase/.branches/`, `supabase/config.ts` — and narrow `*.sql` to `backups/*.sql` and `*.dump` (it exists to block DB dumps, not migrations).

2. In the SAME commit, `git rm` (or delete + stage) `supabase/config.ts`. It contains the project URL, anon key AND the **service role key** in plaintext. Nothing imports it — verify with `rg -n 'supabaseConfig|supabase/config' src/ api/` before deleting; `src/lib/supabase.ts` already reads `import.meta.env.VITE_SUPABASE_*`. Narrowing the ignore rule without this deletion commits the service role key to history permanently. Do not print or copy the key value anywhere, including the commit message.

3. `git add supabase/migrations/001_initial_schema.sql` so the schema contract is finally tracked.

4. Write `.env.example` with the four variable names and no values: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, with a comment on the last one reading `# server-only — never prefix with VITE_, Vite inlines VITE_* into the client bundle`.

5. Create `.vercelignore` with `.env*`, `!.env.example`, `supabase/`, `src/test/`.

6. Create `PROGRESS.md` with four headings: `## Done`, `## In progress`, `## Blocked`, `## Deferred`. Seed `## Blocked` with two lines: (a) "Owner must rotate the Supabase service role key — it sat in plaintext in supabase/config.ts on disk; treat it as compromised regardless of the gitignore." (b) "Migrations 002+ are written but not applied. Nothing that reads or writes under RLS works until the owner runs them." Seed `## Deferred` with: staff shift scheduling, incident tracking, staff performance metrics, internal staff chat/messaging (all outside the scope fence), and Web Push send (needs VAPID keys + a server route). State the convention at the top of the file: every later package appends one line under `## Done` naming what it finished — PROGRESS.md is append-only for everyone except the final hardening package.

**Done when**

`git check-ignore -v supabase/migrations/001_initial_schema.sql` exits non-zero (file is no longer ignored); `git ls-files supabase/migrations` lists 001; `rg -n 'service_role|serviceRoleKey|eyJhbGciOi' src/ supabase/ api/` returns nothing; `.env.example` exists with four names and zero values; `pnpm build` still green.

---

### P2-rls-foundation — Migration 002 — identity, roles, non-recursive RLS helpers, and the missing write policies

**Wave 1** · depends on: P1-repo-hygiene

**Owns** (exclusive write access):
- `supabase/migrations/002_identity_and_rls.sql`
- `supabase/migrations/README.md`

**Instruction**

This is the single foundational blocker: 001's `staff` SELECT policy does `EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.event_id = staff.event_id)` — the inner alias shadows the outer on both sides, making the predicate a tautology AND making the policy on `staff` read `staff`. Postgres raises `42P17 infinite recursion detected in policy for relation "staff"`. Because circles(185), booths(194), tickets(200), ticket_purchases(205) and financial_transactions(218) all subquery `staff`, every one of those tables errors for any authenticated user. Do not edit 001; write 002 on top.

**Identity.** `CREATE TYPE app_role AS ENUM ('organizer','staff','circle','attendee')` — four roles per the brief, not authStore's five. `public.profiles(id uuid PK REFERENCES auth.users ON DELETE CASCADE, email text NOT NULL, display_name text, avatar_url text, role app_role NOT NULL DEFAULT 'attendee', locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en','ja','id')), notification_prefs jsonb NOT NULL DEFAULT '{}', created_at, updated_at)`. Backfill from `auth.users`. Add a `SECURITY DEFINER` `handle_new_user()` trigger on `auth.users AFTER INSERT` that inserts the profile, reading role from `raw_user_meta_data->>'role'` but coercing anything that is not 'circle' or 'attendee' to 'attendee' — self-service signup must never mint an organizer.

**Membership.** Harden `staff` as the per-event membership table: `ALTER COLUMN user_id SET NOT NULL`, `UNIQUE(event_id, user_id)`, replace the free-text role with `CHECK (role IN ('organizer','coordinator','scanner','volunteer'))`, add `invited_by uuid`, `accepted_at timestamptz`, and `CREATE INDEX idx_staff_event_role ON staff(event_id, role)`.

**Helpers — this is what breaks the recursion.** Three functions, all `SECURITY DEFINER`, `STABLE`, `SET search_path = ''` (fully qualify every identifier inside), `REVOKE EXECUTE FROM public` then `GRANT EXECUTE TO authenticated`:
- `public.current_app_role() RETURNS app_role` — reads `public.profiles` for `auth.uid()`.
- `public.is_event_staff(p_event uuid) RETURNS boolean` — a row in `public.staff` for `auth.uid()` + `p_event` with `status = 'active'`.
- `public.is_event_organizer(p_event uuid) RETURNS boolean` — the above with `role = 'organizer'`, OR `public.events.created_by = auth.uid()`.
SECURITY DEFINER means these read past RLS, so they never re-enter a policy. **No policy written from here on may contain a `FROM staff` subquery** — that rule is grep-checkable and is the whole point.

**Policy rewrite.** `DROP POLICY` every policy created in 001 by its exact name, then recreate:
- profiles: SELECT self or `EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = profiles.id AND public.is_event_organizer(s.event_id))`; UPDATE self with `WITH CHECK (id = auth.uid())`; no INSERT policy (trigger only); no DELETE. Then `REVOKE UPDATE (role, email) ON profiles FROM authenticated` so nobody self-promotes.
- events: SELECT `status <> 'draft' OR public.is_event_staff(id)` for anon+authenticated. INSERT `created_by = auth.uid() AND public.current_app_role() = 'organizer'`. UPDATE `public.is_event_organizer(id)` in both USING and WITH CHECK (the WITH CHECK is what stops reassigning `created_by`).
- circles: SELECT `user_id = auth.uid() OR public.is_event_staff(event_id)`. INSERT `user_id = auth.uid()`. UPDATE (owner) and UPDATE (organizer, `public.is_event_organizer(event_id)`) as two separate policies, both with USING **and** WITH CHECK — 001's owner UPDATE has USING only, which today lets a circle owner PATCH themselves to `application_status='accepted'`, `payment_status='paid'`, `total_amount=0`.
- booths / tickets: replace 001's `FOR ALL USING (staff exists)` with `public.is_event_organizer(event_id)` — a volunteer must not be able to reprice tickets or move booths. Public SELECT becomes `EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft') OR public.is_event_staff(event_id)`.
- staff: SELECT `user_id = auth.uid() OR public.is_event_staff(event_id)`; INSERT/UPDATE/DELETE `public.is_event_organizer(event_id)`.
- ticket_purchases: SELECT `user_id = auth.uid() OR public.is_event_staff(event_id)`. Leave writes to the RPCs in 004.
- financial_transactions: SELECT `public.is_event_organizer(event_id)` only (001 exposes event revenue to every volunteer). Deliberately **no** INSERT/UPDATE/DELETE policy — 004 hardens this further.

**Grants.** Replace all seven `GRANT ALL ON <t> TO authenticated` with explicit `GRANT SELECT, INSERT, UPDATE`. `GRANT ALL` includes TRUNCATE, which is not subject to RLS.

**Add `updated_at`.** 001 gives every table `updated_at TIMESTAMPTZ DEFAULT NOW()` with no trigger to maintain it, so it freezes at insert. Add `public.set_updated_at()` and a `BEFORE UPDATE` trigger on every table 001 created. Also add `events.timezone text NOT NULL DEFAULT 'Asia/Jakarta'` — ticket validity windows and "day 1" are meaningless without it when a Tokyo organizer and a Jakarta scanner disagree.

**`supabase/migrations/README.md`** — a six-statement verification checklist the owner pastes into the Supabase SQL editor using `SET LOCAL role authenticated; SET LOCAL request.jwt.claims = '{"sub":"<uuid>"}';`, asserting: (1) circle owner A cannot SELECT owner B's circle; (2) a circle owner cannot UPDATE their own `application_status` to 'accepted'; (3) an attendee gets zero rows from `financial_transactions`; (4) a `SELECT * FROM circles` as an authenticated user does not raise 42P17; (5) an organizer CAN update a circle in their own event; (6) `anon` can still SELECT published events. No pgTAP, no harness — six statements catch the failure mode that matters, which is a policy that silently allows everything. Also document the apply order and that the owner, not an agent, runs `supabase db push`.

**Done when**

`supabase/migrations/002_identity_and_rls.sql` exists; `rg -n 'FROM staff|JOIN staff' supabase/migrations/002_identity_and_rls.sql` matches only inside the SECURITY DEFINER helper bodies and never inside a `CREATE POLICY`; every helper declares `SET search_path = ''`; `rg -c 'GRANT ALL' supabase/migrations/002_identity_and_rls.sql` returns 0; README.md contains six `SET LOCAL role` assertions.

---

### P3-platform — Platform: dependency ledger, delete the 501 Express server, Vitest, PWA, self-hosted font

**Wave 1** · depends on: P1-repo-hygiene

**Owns** (exclusive write access):
- `package.json`
- `pnpm-lock.yaml`
- `vite.config.ts`
- `vercel.json`
- `nodemon.json`
- `tsconfig.json`
- `index.html`
- `api/`
- `src/test/setup.ts`
- `public/`

**Instruction**

Everything downstream needs a test runner, a build that emits a service worker, and fewer moving parts. The repo is pnpm-installed (`pnpm-lock.yaml`, `node_modules/.pnpm`) despite npm-flavoured scripts — use pnpm and add `"packageManager": "pnpm@<version>"` to package.json so Vercel and local agree.

**Remove (12):** `leaflet`, `react-leaflet`, `@types/leaflet` (imported nowhere; a tile-map library is the wrong tool for a fixed-coordinate venue floor plan and wants CDN tiles, the one thing that will not work at the venue); `express`, `cors`, `@types/express`, `@types/cors`, `dotenv`, `nodemon`, `concurrently` (all exist to run three handlers that return HTTP 501); `vite-plugin-trae-solo-badge`, `babel-plugin-react-dev-locator` (Trae IDE scaffolding); `vite-tsconfig-paths` (installed but `vite.config.ts` sets the `@` alias by hand — keep the hand alias, drop the plugin). Move `@types/qrcode` to devDependencies.

**Add (10):** `@tanstack/react-query` (server-state layer, used by P9); `vite-plugin-pwa` (dev); `@fontsource-variable/figtree`; `i18next` + `react-i18next` (used by P15); `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `fake-indexeddb` (all dev — jsdom ships no IndexedDB, so the offline-queue tests cannot run without the last one).

**Delete the server.** Remove `api/` entirely (app.ts, index.ts, server.ts, routes/auth.ts), `nodemon.json`, and the ~20-line dev proxy block in `vite.config.ts`. Rationale to record in PROGRESS.md: every privileged app operation in this plan — ticket redemption, purchase creation, circle review, booth allocation, ledger writes — is a Postgres `SECURITY DEFINER` RPC called with the user's own JWT, so no server and no service-role key is needed. The single exception is an inbound payment-gateway webhook, whose caller is a third party with no Supabase JWT; P11 adds exactly one bare `@vercel/node` handler at `api/webhooks/payment.ts` — no Express, no router, no cors. Keep `@vercel/node` and the `/api/(.*)` rewrite in `vercel.json` for it. Note the trade: that endpoint can only be exercised via `vercel dev` or a preview deploy.

**Scripts:** `dev: vite`, `build: tsc -b && vite build`, `test: vitest run`, `test:watch: vitest`, `check: tsc --noEmit`, `lint: eslint .`.

**Vitest** configured inside the existing `vite.config.ts` — no separate vitest.config.ts; it reuses the `@` alias and the react plugin, which is the whole reason to pick Vitest over Jest. `test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.ts' }`. `src/test/setup.ts` imports `@testing-library/jest-dom` and `fake-indexeddb/auto`. Add `"types": ["vitest/globals"]` to tsconfig. Note for everyone downstream: `noUnusedLocals`/`noUnusedParameters` are on and `build` runs `tsc -b`, so half-wired scaffolding fails the build, not just the lint.

**PWA** via `vite-plugin-pwa`, `strategies: 'generateSW'` (Vite emits content-hashed filenames, so a hand-written precache list is either wrong or is a build script reimplementing Workbox badly — this is the case where the dependency wins). `registerType: 'prompt'` — never auto-reload a scanner mid-shift. `workbox.globPatterns: ['**/*.{js,css,html,woff2,svg,png}']`, `navigateFallback: '/index.html'`, `navigateFallbackDenylist: [/^\/api/]`. **Runtime caching: exactly one entry** — Supabase Storage public objects (`/storage/v1/object/public/`) as `CacheFirst`, ~30 day expiry. **Cache nothing else from `*.supabase.co`.** No `/rest/v1`, no `/auth/v1`, no `/realtime/v1`, and specifically never `NetworkFirst` on anything ticket-related: NetworkFirst falls back to cache on failure, which is literally "serve a stale 200 saying this ticket is valid" — the double-admit criterion 3 forbids. Also, the Cache API is origin-scoped not session-scoped, so a cached RLS-filtered response outlives logout and leaks the previous user's rows. Put both reasons in a comment above the config. Manifest: name `DoujinDesk`, `start_url: '/'`, `display: 'standalone'`, `theme_color: '#d63a00'` with a `// ponytail:` comment noting the hex duplicates `--primary` because a manifest cannot read a CSS var. Icons in `public/`: 192, 512, a 512 maskable with a 40% safe zone, and a 180x180 `apple-touch-icon` linked from `index.html` (iOS ignores manifest icons). Generate them from the existing `public/favicon.svg`; if it does not scale acceptably, ship flat solid-color icons with the wordmark and add a PROGRESS.md line asking the owner for a real source asset. No `orientation` lock — organizers use tablets in landscape.

**index.html:** delete the render-blocking Google Fonts `<link>` and both `<link rel=preconnect>` (P7 replaces them with the self-hosted `@fontsource-variable/figtree` import in `src/index.css`); add the apple-touch-icon and `<meta name=theme-color>`. Leave `<html lang="en">` as authored — P15 updates it at runtime from the i18next `languageChanged` event.

**vercel.json:** add a `headers` block setting `Cache-Control: no-cache` on `/sw.js` and `/manifest.webmanifest` so a bad service worker is recoverable.

Do not touch `src/App.tsx`; `src/components/FontLoader.tsx` is deleted by P8 and `src/assets/fonts/figtree.css` by P7, each as part of their own file ownership.

**Done when**

`pnpm test` exits 0 (zero tests is fine); `pnpm build` exits 0 and `dist/sw.js` + `dist/manifest.webmanifest` exist; `rg -n "leaflet|express|nodemon|concurrently" package.json` returns nothing; `api/` contains no files; the PWA runtime-caching config contains no `/rest/v1` or `/auth/v1` entry.

---

### P7-design-system — Design system repair: make alpha modifiers compile, one token source, semantic status tokens, lint gate, EmptyState

**Wave 1** · depends on: P3-platform

**Owns** (exclusive write access):
- `tailwind.config.js`
- `src/index.css`
- `src/assets/fonts/figtree.css`
- `eslint.config.js`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/empty-state.tsx`
- `src/components/Empty.tsx`

**Instruction**

Must land before any screen is written, because roughly 40 token classes in the repo currently emit **no CSS at all**.

**1. The alpha-value bug (do this first and verify by compiling).** `tailwind.config.js:21-62` declares colors as `hsl(var(--primary))` without the `<alpha-value>` placeholder Tailwind v3 requires. v3 passes the literal string to `parseColor`, gets one token where it needs three channels, returns null, and drops the utility. Verify before editing: `pnpm install` (node_modules is pruned), then `npx tailwindcss -i src/index.css -o /tmp/out.css --content './src/**/*.tsx'` and `grep -c 'bg-primary\\/90\|ring-ring\\/50' /tmp/out.css` — expect 0. Rewrite every color to the canonical shadcn-for-v3 form `hsl(var(--primary) / <alpha-value>)`, recompile, confirm hits and that the emitted rule is `hsl(var(--ring) / 0.5)`. Consequences of the bug today: `hover:bg-primary/90` means the primary CTA has no hover state app-wide, and `focus-visible:ring-ring/50` falls back to Tailwind's default `rgb(59 130 246 / 0.5)` — every focus ring in an orange-branded app renders **blue-500**.

**2. Collapse `src/index.css` to one source of truth.** Delete the `@theme inline { … }` block (lines ~107-165) — that is Tailwind **v4** syntax in a v3.4.17 project; v3's PostCSS plugin passes it through as an unknown at-rule and browsers ignore it, so ~60 lines are dead. Delete the duplicate hex `:root`/`.dark` inside `@layer base` (lines ~171-295) — it redefines every token as raw hex while the unlayered `:root` at line 11 defines them as HSL triplets, and the HSL wins only by accident of source order. Verified safe: the only `var(--…)` reads from TS/TSX are Radix's own vars at `select.tsx:109`. Keep the unlayered HSL block as the single definition. Land this delete as its own commit so it can be reverted independently. Then wire into `tailwind.config.js theme.extend` what the dead block was pretending to provide: `boxShadow` mapped to the `--shadow-*` tokens (this one config edit retires ~27 shadow-abuse violations with zero component changes), the 8 `sidebar` colors, `borderRadius.xl`.

**3. Extend the token set — the migration cannot proceed without this.** (a) `--primary: 16 100% 50%` (#ff4500) on white is **3.44:1** and fails WCAG AA for the default Button's 14px label. Change `--primary` to `16 100% 42%` (~#d63a00, 4.71:1) and keep `16 100% 50%` for `--ring` and `--chart-1` where the 3:1 non-text threshold applies. This is a visible brand change — add a PROGRESS.md line naming it and the alternative (keep --primary, add `--primary-strong` used only by text-bearing surfaces). (b) `--destructive` is **byte-identical to `--primary`** — Reject, Delete and Submit are currently the same pixel. Give it a real red hue. (c) Add `--success`, `--warning`, `--info`, each with a `-foreground` and one subtle surface variant, in both `:root` and `.dark`: 40+ status-word/color pairings across src/ have no legal token to migrate to today, which is why the sweep would stall halfway. Cap it there — genre and category colors reuse `--chart-1..5`. Check every new pair at 4.5:1 in both themes.

**4. Fonts.** Replace the two `@import` lines at the top of `src/index.css` (Google Fonts URL + `./assets/fonts/figtree.css`, whose 14 `@font-face` rules point at gstatic TTFs despite being labelled "Local Backup") with one `@import '@fontsource-variable/figtree'` — self-hosted WOFF2 that the service worker precaches for free. Delete `src/assets/fonts/figtree.css`. Fix the stacks: append a zero-byte CJK system fallback to `--font-sans` (`'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', Meiryo, sans-serif`) — Figtree ships no Japanese glyphs and JA text currently falls through to whatever the device has. Do **not** ship a JA webfont; the full face is megabytes over the worst connection this app will ever see. `--font-mono` is currently set to `'Figtree'`, a proportional face — point it at `ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, monospace` so booth codes, ticket ids and money columns align.

**5. `ui/` v4-in-v3 audit.** These primitives are shadcn v4-era source in a v3 project: `shadow-xs` (6 uses in button/input/select) is not a v3 utility — map to `shadow-sm` or add an `xs` step when wiring boxShadow; `@container/card-header` (card.tsx:23) needs `@tailwindcss/container-queries` which is not installed — drop the class; `has-data-[slot=card-action]:grid-cols-[1fr_auto]` is v4 shorthand, v3 needs `has-[[data-slot=card-action]]`, so `<CardAction>` currently lands in the wrong grid cell. Verify each by grepping the compiled CSS from step 1.

**6. Lint gate.** One ESLint `no-restricted-syntax` rule in `eslint.config.js` (no new dependency) rejecting JSX className literals matching `(bg|text|border|ring|from|to|via|fill|stroke|divide)-(gray|slate|zinc|neutral|stone|blue|indigo|purple|violet|green|emerald|teal|cyan|sky|red|rose|pink|fuchsia|orange|amber|yellow|lime)-[0-9]+`, plus `bg-gradient-to-`, plus hex literals in .tsx. Baseline the 17 known-bad files with file-level `/* eslint-disable */` comments so the gate is green immediately and only *new* violations fail — each screen package removes its own disable in the same commit as its rewrite. Per-file violation counts for the packages that inherit them: Dashboard 197, Home 103, AnnouncementSystem 69, QueueStatus 54, NotificationCenter 48, EventSchedule 44, EventGuide 42, AttendeeRegistration 31, StaffCoordination 30, InteractiveMap 26, CircleCatalog 22, FinancialManagement 20, CircleManagement 16, BoothAllocation 14, TicketScanner 11.

**7. `src/components/ui/empty-state.tsx`.** `src/components/Empty.tsx` is an 8-line component that renders the literal string "Empty". Replace it with one `<EmptyState icon title description action secondaryAction />` used by every list screen for no-data, no-results and offline — no illustrations (nothing to commission, nothing that reads as stock AI art), headline + one sentence + primary CTA + optional secondary path. It must distinguish *no data* from *no results*: when emptiness is filter-induced the caller keeps table headers and filter row mounted and passes a description saying which filter. Export the mapping table for the screen packages in a comment at the top of `src/index.css` or the ESLint rule message: gray-900/800, slate-800, dark:text-white → `text-foreground` (drop the dark: variant, the token covers both themes); gray-700/600/500/400 → `text-muted-foreground`; bg-white, dark:bg-gray-800 → `bg-card`; bg-gray-50/100 → `bg-muted`; border-gray-200/300 → `border-border`; blue-600 → primary; bg-blue-50 → `bg-primary/10`; green-* → success; yellow/amber-* → warning; red-* → destructive; track/genre badges → chart-3/4/5; all 9 `bg-gradient-to-*` deleted outright with no replacement gradient.

**Done when**

Compiled CSS contains `hsl(var(--ring) / 0.5)` and a rule for `bg-primary/90`; `src/index.css` contains exactly one `:root` block and no `@theme`; `--destructive` differs from `--primary`; `--success`/`--warning`/`--info` exist in both `:root` and `.dark`; `pnpm lint` exits 0 with the 17 baseline disables; `pnpm build` green.

---

### P15-i18n — i18n EN/JA/ID with native Intl, locale-tracking lang attribute, language switcher

**Wave 2** · depends on: P3-platform

**Owns** (exclusive write access):
- `src/lib/i18n.ts`
- `src/locales/`
- `src/components/LanguageSwitcher.tsx`
- `src/main.tsx`

**Instruction**

Infrastructure now so every screen package writes `t('…')` from the start instead of being retrofitted.

`i18next` + `react-i18next` only. **Skip** `i18next-browser-languagedetector` — `navigator.language.split('-')[0]` plus a localStorage override is one line. **Skip** `i18next-http-backend` — three locales, loaded via native dynamic `import()` per locale so a JA bundle never ships to an EN user. **Skip** ICU — use native `Intl` for money (via `src/lib/money.ts` from P5) and dates.

`src/lib/i18n.ts`: init i18next with `fallbackLng: 'en'`, `supportedLngs: ['en','ja','id']`, namespaces split by route so the dynamic imports chunk cleanly — `common`, `auth`, `circle`, `scanner`, `catalog`, `organizer`. Subscribe to the `languageChanged` event and set `document.documentElement.lang` — it is hardcoded `en` in index.html today, and the `lang` attribute is what selects correct regional glyph variants for shared Han characters and what tells a screen reader which voice to use. Persist the choice to localStorage; when a session exists, also write `profiles.locale` so the preference follows a staffer to their phone at the door (localStorage stays the session source of truth).

`src/locales/{en,ja,id}/{common,auth,circle,scanner,catalog,organizer}.json` — seed with the shell, nav, auth and error strings, plus every string the scanner shows (that screen is used by a staffer who may not read English). Later packages add their own keys to these files; keep keys flat-ish and namespaced by screen (`scanner.result.duplicate`). Where a translation is genuinely unknown, leave the English string as the ja/id value rather than an empty string — a missing key renders the raw key on screen, which is worse than untranslated English.

`src/components/LanguageSwitcher.tsx`: a `ui/select` with EN / 日本語 / Bahasa Indonesia, mounted by P8 in the topbar. 44px target.

`src/main.tsx`: add the side-effect `import './lib/i18n'` before rendering. (P9 later wraps the tree in `QueryClientProvider` in this same file — a single-line wrap, different wave.)

**Furigana is not a translation and must never touch i18next.** `circles.circle_name_furigana` holds a reading aid (「東方地霊殿」→「とうほうちれいでん」), not a JA display form — swapping it in for JA users produces gibberish. Its jobs are kana sort order and kana search, handled in the schema by P6 and the catalog by P13. Put a comment saying exactly this at the top of `src/lib/i18n.ts`, because the columns sitting next to each other invite the mistake.

**Done when**

`import('@/lib/i18n')` initialises without error in a Vitest jsdom test; switching language updates `document.documentElement.lang`; all three locale folders contain the same key set for `common`; `pnpm build` green and the ja/id JSON are emitted as separate chunks.

---

### P4-scan-contract — Migration 003 + the scan contract: ticket passes, append-only scan log, idempotent redeem RPC, pure resolver + tests

**Wave 2** · depends on: P2-rls-foundation

**Owns** (exclusive write access):
- `supabase/migrations/003_scanning.sql`
- `src/lib/scanContract.ts`
- `src/lib/scanContract.test.ts`

**Instruction**

Risk #1. The RPC response shape defined here is what the Dexie queue (P10), the scanner UI (P10) and the criterion-3 tests are all written against — freeze it now or all three get rewritten. Never edit 001.

**`ticket_passes`** — one scannable pass per admitted person, which is what makes `quantity > 1` correct. 001 has a single nullable `check_in_time` on the *order*, so an order for five people admits either once or unlimited times; there is no correct middle and this extra table is the one place in the plan where an extra table is not over-engineering. Columns: `id uuid PK DEFAULT gen_random_uuid()`, `purchase_id uuid NOT NULL REFERENCES ticket_purchases ON DELETE CASCADE`, `event_id uuid NOT NULL REFERENCES events`, `qr_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()`, `holder_name text`, `tier_id uuid REFERENCES tickets(id)`, `valid_from timestamptz`, `valid_until timestamptz`, `revoked_at timestamptz`, `created_at`. The token is an opaque uuid carrying no row id and no PII — unlike today's `QR_${purchaseId}_${Date.now()}`, which is guessable and embeds the row id. Index `(event_id)`, `(purchase_id)`. RLS SELECT: owner of the parent order OR `public.is_event_staff(event_id)`; an attendee must never read another attendee's `qr_token`. No client INSERT/UPDATE.

**`ticket_scans`** — append-only: `id uuid PK`, `event_id uuid NOT NULL`, `pass_id uuid REFERENCES ticket_passes` (nullable — an unknown code still gets logged), `scanned_code text NOT NULL`, `scan_type text NOT NULL DEFAULT 'entry' CHECK (scan_type IN ('entry','exit','reentry'))`, `result text NOT NULL CHECK (result IN ('admitted','duplicate','not_found','unpaid','revoked','wrong_event','outside_window'))`, `gate_id text`, `device_id text NOT NULL`, `scanned_by uuid REFERENCES auth.users`, `scanned_at timestamptz NOT NULL` (device clock, at scan time), `synced_at timestamptz NOT NULL DEFAULT now()` (server clock, at upload), `offline boolean NOT NULL DEFAULT false`, `client_scan_id uuid NOT NULL`, `conflict_with uuid REFERENCES ticket_scans(id)`.

**Two constraints carry the entire offline story:**
1. `UNIQUE (client_scan_id)` — replaying the IndexedDB queue is idempotent. Flaky venue wifi retrying the same batch four times produces one row.
2. `CREATE UNIQUE INDEX one_admission_per_pass ON ticket_scans (pass_id) WHERE result = 'admitted' AND scan_type = 'entry'` — double admission is impossible in the database, not in application logic. Two phones offline both admit pass X; on sync the second INSERT raises 23505, and *that error is the visible conflict* criterion 3 asks for. `// ponytail:` comment: this also blocks legitimate re-entry; the `reentry` scan_type sits outside the index, which is the upgrade path — never drop the index.
Indexes: `(event_id, scanned_at DESC)`, `(pass_id)`, `(device_id, synced_at)`.

**`public.redeem_tickets(p_scans jsonb)`** — `SECURITY DEFINER`, `SET search_path = ''`, takes an array so an offline flush is one round trip. Per item: derive `event_id` from the pass, guard `public.is_event_staff(event_id)` internally and raise otherwise; lock the parent order `FOR UPDATE`; check the order is paid, the pass is not revoked, and `scanned_at` falls inside the validity window evaluated in `events.timezone`; INSERT the scan. Catch `unique_violation` on `one_admission_per_pass` and re-insert as `result='duplicate'` with `conflict_with` pointing at the winning scan. Catch `unique_violation` on `client_scan_id` by returning the previously stored row unchanged. Returns one JSON object per input, keyed by `client_scan_id`: `{ client_scan_id, result, scan_id, admitted_at, conflicting_device, conflicting_scanned_at, conflicting_gate }`. `GRANT EXECUTE TO authenticated`.
RLS on `ticket_scans`: SELECT `public.is_event_staff(event_id)`; no INSERT/UPDATE/DELETE policies plus `REVOKE INSERT, UPDATE, DELETE ON ticket_scans FROM authenticated` — otherwise a scanner-role staffer forges an `admitted` row. `ALTER PUBLICATION supabase_realtime ADD TABLE ticket_scans`.

**`src/lib/scanContract.ts`** — the TypeScript half of the same contract, no Supabase import, no React: exported types `PendingScan` (`client_scan_id`, `qr_token`, `scanned_at`, `gate_id`, `device_id`, `scan_type`), `RedeemResult` (mirrors the RPC return exactly), and `ScanOutcome` = `{ kind: 'admitted' | 'duplicate' | 'rejected' | 'queued', message: string, detail?: {...} }`. One pure function `resolveScanOutcome(local: LocalCheck | null, server: RedeemResult | null): ScanOutcome` used by BOTH the scanner UI (optimistic, offline) and the sync loop (authoritative, online) so the two can never disagree about what 'already used' means. Rules: server result always wins over local; `duplicate` renders the winning scan's device/time/gate and is never auto-dismissed; a scan with no server response yet is `queued`, which is amber, not green — the operator must be able to tell "admitted" from "probably fine, not confirmed".

**`src/lib/scanContract.test.ts`** — pure, no DOM: server `duplicate` overrides a local `admitted`; an unknown token with no local mirror entry resolves `rejected` not `admitted`; a queued scan never renders as admitted; a replayed `client_scan_id` yields the identical outcome (idempotence).

**Done when**

`supabase/migrations/003_scanning.sql` contains both `UNIQUE (client_scan_id)` and the partial `one_admission_per_pass` index; `redeem_tickets` is `SECURITY DEFINER` with `SET search_path = ''` and returns the seven documented keys; `pnpm test src/lib/scanContract.test.ts` passes with at least four assertions; no policy in the file contains a `FROM staff` subquery.

---

### P5-money-core — Migration 004 + money helpers: purchase RPC, immutable ledger, trigger-written transactions, summary view

**Wave 2** · depends on: P2-rls-foundation

**Owns** (exclusive write access):
- `supabase/migrations/004_money.sql`
- `src/lib/money.ts`
- `src/lib/money.test.ts`

**Instruction**

Risk #3. Criterion 4 says every circle payment and ticket sale writes an immutable row and totals derive from those rows. Today five invented rows live in localStorage, the browser decides `payment_status: 'paid'`, and `amount DECIMAL(10,2)` overflows above ~100,000,000 — which never appears in USD test data and appears on the first real ticket batch in Jakarta. Never edit 001.

**Ticket tiers (`tickets`).** Add `currency text CHECK (currency IN ('IDR','USD'))`, `early_bird_price numeric(12,2)`, `early_bird_end timestamptz`, `age_restriction text CHECK (age_restriction IN ('all_ages','adult'))`, `requires_id boolean DEFAULT false`, `valid_from`, `valid_until`, `sort_order int`, and `CHECK (quantity_sold <= quantity_available)`. `REVOKE UPDATE (quantity_sold, price) ON tickets FROM authenticated` — the browser must not be able to reprice or fake inventory.

**Orders (`ticket_purchases`).** Add `event_id uuid NOT NULL REFERENCES events` (denormalised on purpose — the scanner and RLS both need it without a join), `unit_price numeric(12,2)`, `currency text`, `order_reference text UNIQUE`, `status text CHECK (status IN ('pending','paid','cancelled','refunded'))`, `cancelled_at`, `refunded_at`. Widen `total_amount` to `numeric(14,2)`. Backfill `event_id` from `tickets`.

**`public.purchase_tickets(p_ticket_id uuid, p_quantity int, p_holder_names text[])`** — `SECURITY DEFINER`, `SET search_path = ''`. Reads `tickets.price` (and early-bird, evaluated against `now()` in `events.timezone`) **server-side** — never trusts a client price. The oversell guard is one statement: `UPDATE public.tickets SET quantity_sold = quantity_sold + p_quantity WHERE id = p_ticket_id AND quantity_sold + p_quantity <= quantity_available RETURNING price, currency, event_id` — zero rows means sold out, raise. Then insert the order (`status='pending'`), insert `p_quantity` rows into `ticket_passes` (created in 003), and return the order id + `order_reference`. No client INSERT policy on `ticket_purchases` at all — the RPC is the only door. `GRANT EXECUTE TO authenticated`.

**Circle pricing.** `event_pricing(event_id, space_type, price numeric(12,2), addon_table_price, addon_chair_price, addon_power_price, extra_pass_price, currency)`; public SELECT, writes `public.is_event_organizer(event_id)`. A `BEFORE INSERT OR UPDATE` trigger on `circles` recomputes `total_amount` from `event_pricing` + selected add-ons and **overwrites whatever the client sent**. Widen `circles.total_amount` to `numeric(12,2)`. Client-supplied prices are the money leak; this closes it without another RPC.

**Ledger hardening (`financial_transactions`).** Widen `amount` to `numeric(14,2)`. Add `currency text CHECK (currency IN ('IDR','USD'))`, `direction text CHECK (direction IN ('credit','debit'))`, `occurred_at timestamptz NOT NULL DEFAULT now()` (distinct from `created_at`), `reference_table text` beside the existing polymorphic `reference_id`, `idempotency_key text UNIQUE` (payment-webhook replay), `created_by uuid`, `reverses_transaction_id uuid REFERENCES financial_transactions(id)`. Note the enum in 001 is `circle_payment|ticket_sale|refund|expense|commission` — every downstream writer uses those exact values, not the store's illegal `payment`/`fee`.
**Immutability, literally:** no INSERT/UPDATE/DELETE policy; `REVOKE INSERT, UPDATE, DELETE ON financial_transactions FROM authenticated, anon`; **plus** a `BEFORE UPDATE OR DELETE` trigger that unconditionally `RAISE EXCEPTION`. RLS does not constrain the service role — the trigger does, and it is the only thing that makes "immutable" true rather than aspirational. Corrections are reversing entries via `reverses_transaction_id`.

**Rows are written by triggers, never by a browser.** `AFTER UPDATE` triggers on `circles` and `ticket_purchases` that fire when payment status transitions to paid and INSERT the matching row (`transaction_type` `circle_payment` / `ticket_sale`, `reference_table` + `reference_id` = the source row, `currency` from `events.currency`, `direction='credit'`). A refund transition inserts a `refund` row rather than mutating the original.

**`event_financial_summary`** view with `security_invoker = true` (so RLS still applies), grouping by `event_id, currency, transaction_type` with `sum(amount) FILTER (WHERE status='completed')` and a count. Criterion 4 forbids client-side reduce — the dashboard reads this. Indexes: `(event_id, occurred_at DESC)`, `(reference_table, reference_id)`, `(transaction_type, status)`.

**`src/lib/money.ts`** — the only place amounts become strings. `formatMoney(amount: number, currency: 'IDR'|'USD', locale: string)` using `Intl.NumberFormat(locale, { style:'currency', currency })` with `maximumFractionDigits: 0` for IDR (conventionally displayed without minor units even though the column is numeric(x,2)). Currency is **event-scoped**, locale is **user-scoped** — a ja-locale user browsing an Indonesian event sees IDR formatted with JA conventions, never JPY. Do not couple them. Also export `sumByCurrency(rows)` for the rare client-side case, with a `// ponytail:` comment that any figure shown to an organizer must come from `event_financial_summary`, not from this.
**`src/lib/money.test.ts`**: IDR renders with no decimals in en/ja/id; USD renders two decimals; a ja locale with an IDR event never produces '¥'.

**Done when**

`supabase/migrations/004_money.sql` contains a `BEFORE UPDATE OR DELETE` trigger on financial_transactions that raises, zero `CREATE POLICY ... financial_transactions ... FOR INSERT`, `purchase_tickets` reading price server-side, and `event_financial_summary` with `security_invoker`; `pnpm test src/lib/money.test.ts` passes; `rg 'DECIMAL\(10,2\)' supabase/migrations/004_money.sql` shows the widening ALTERs, not new narrow columns.

---

### P10-offline-scanner — The offline scanner: Dexie queue, camera decode, idempotent sync, visible conflicts, criterion-3 tests

**Wave 3** · depends on: P3-platform, P4-scan-contract

**Owns** (exclusive write access):
- `src/lib/scanQueue.ts`
- `src/lib/scanQueue.test.ts`
- `src/lib/ticketCode.ts`
- `src/lib/qrcode.ts`
- `src/components/TicketScanner.tsx`
- `src/components/scanner/ScanResultSheet.tsx`
- `src/components/scanner/ConflictList.tsx`

**Instruction**

Criterion 3, built against the contract frozen in P4 (`src/lib/scanContract.ts` — import it, do not redefine the shapes). This is a build, not a fix: there is no decode loop, no IndexedDB, no sync, and the code the app issues (`QR_${purchaseId}_${Date.now()}`) cannot be parsed by the scanner it ships with (`JSON.parse` at `src/lib/qrcode.ts:46`).

**One code format.** `src/lib/ticketCode.ts`: the scannable payload is the `ticket_passes.qr_token` uuid, nothing else — no name, no event, no expiry in the payload; a scannable code carrying PII is a privacy leak, and anything self-describing and unsigned is forgeable by typing JSON into the manual-entry box (which is true today). Validity is decided by the server or by the pre-downloaded mirror, never by the code's own contents. Delete `ticketStore.generateQRCode` and AttendeeRegistration's `QR-${id}`. Rewrite `src/lib/qrcode.ts` down to what is used: `QRCodeGenerator.generateQRCode` (the `qrcode` package, already installed, currently called from nowhere — the wallet in P13 uses it) and nothing else; delete `parseQRCode`/`validateQRCode`.

**`src/lib/scanQueue.ts`** — Dexie is a dependency and imported nowhere. Two tables:
- `pendingScans`: `client_scan_id` (uuid, PK, generated on the device), `qr_token`, `scanned_at`, `gate_id`, `device_id`, `scan_type`, `sync_state ('pending'|'synced'|'conflict')`, `server_result` (the `RedeemResult`), indexed on `sync_state`.
- `ticketMirror`: a snapshot of the event's valid `qr_token`s + tier + holder name, fetched once before doors open so an offline scan can reject an unknown token instead of admitting everything. Include a "Download tickets for offline" action with a row count and timestamp in the scanner UI.
API: `enqueue(scan)` (writes to Dexie **first, always** — never await the network on the hot path), `checkLocal(qr_token)` (mirror lookup + "already admitted by this device" check), `flush()`, `useQueueCounts()`.
`flush()` drains `pendingScans` where `sync_state='pending'` in batches via one `supabase.rpc('redeem_tickets', { p_scans })` call, then writes each returned `RedeemResult` back by `client_scan_id`. Idempotent because the DB has `UNIQUE(client_scan_id)`. Triggered on the `online` event and on app focus — **not** Background Sync, which iOS Safari does not implement and would silently do nothing on iPhones. `// ponytail:` batch of N per call, sequential batches; upgrade path is a cursor if a 5,000-scan backlog is slow. Do **not** use React Query's offline mutation persistence: it is a cache warm-start feature, cannot survive an app kill mid-queue, and has no vocabulary for "this pass was already redeemed on another device".

**Camera decode.** Try `new BarcodeDetector({ formats: ['qr_code'] })` in a `requestAnimationFrame` loop against the existing `<video>` — available on Android Chrome (the majority staff device), zero bytes, no canvas round-trip. Feature-detect and lazy `import()` a decoder (`jsqr` or `@zxing/browser`) only when `'BarcodeDetector' in window` is false, so most devices never download it — add that dependency in this package, it is the one genuinely conditional dep. Delete the unused `canvasRef`. Keep manual entry as an always-available third path (a scuffed badge still has to get in) and label it as a first-class control per the Uber reference, not buried.

**Scanner UI** (`TicketScanner.tsx`, mounted at `/e/:eventId/scan` inside FocusLayout): full-bleed viewfinder, corner brackets, top bar with close, event name, and a **sync-state chip** (`Online` / `Offline · 12 queued`). Torch FAB bottom-right where supported, `Enter ticket ID` link bottom-centre. Result via `resolveScanOutcome` from the contract: a toast pill drops from the top while the camera stays live, plus `ScanResultSheet` — green admitted (holder name, tier, pass id, Undo), red duplicate showing **when and by whom it was first scanned** (device, gate, timestamp from the RPC), amber queued ("will verify on sync" — never green, the operator must be able to tell confirmed from probable). Auto-dismiss after ~2s on success; require tap-to-dismiss on failure. `navigator.vibrate` + distinct audio per outcome — in a loud hall the operator is looking at the queue, not the phone.
`ConflictList.tsx`: a persistent `Conflicts (N)` surface listing every rejected scan with both timestamps and gates, cleared only by explicit acknowledgement. **A conflict must never be a toast that disappears.** Remove the current `syncOfflineData()` which is three lines and a lying "Sync Complete" toast, and the local-array "already used" check that only ever consults this device.

**`src/lib/scanQueue.test.ts`** — criterion 3, under `fake-indexeddb` with a stubbed `supabase.rpc` that enforces the same two unique constraints the SQL declares:
1. valid scan online → `admitted`, one row, `sync_state='synced'`.
2. already-used → RPC returns `duplicate` → row marked `conflict`, appears in the conflict list, is not counted as admitted.
3. **offline-queued at scale**: `navigator.onLine = false`, enqueue 50 distinct scans, assert 50 rows persisted and zero network calls; flip online, `flush()`, assert one RPC call carrying all 50 and 50 rows resolved.
4. **double-admit across devices**: two `pendingScans` rows for the same `qr_token` with different `client_scan_id`; the fake server admits the first and returns `duplicate` for the second → exactly one admitted, one visible conflict.
5. **replay**: call `flush()` twice on the same queue → the second produces no additional admitted rows (idempotence via `client_scan_id`).

**Done when**

`pnpm test src/lib/scanQueue.test.ts` passes all five cases including the 50-scan offline case; `rg -n 'setTimeout|Sync Complete' src/components/TicketScanner.tsx` returns nothing; `rg -n 'dexie' src/lib/scanQueue.ts` matches; the scanner renders a queued-count chip and a persistent conflict list; `pnpm build` green.

---

### P6-schema-completion — Migrations 005/006 — circle lifecycle, operations tables, public catalog view, floor-plan constraints, storage policies

**Wave 3** · depends on: P4-scan-contract, P5-money-core

**Owns** (exclusive write access):
- `supabase/migrations/005_operations.sql`
- `supabase/migrations/006_catalog_floorplan_storage.sql`

**Instruction**

Everything the feature surface needs that has no table, written once so the screen packages find columns waiting for them. Never edit 001. All new tables get `event_id uuid NOT NULL REFERENCES events ON DELETE CASCADE`, RLS enabled, policies built only from the P2 helpers (`public.is_event_staff` / `public.is_event_organizer` / `public.current_app_role`), explicit `GRANT SELECT, INSERT, UPDATE`, and a `set_updated_at` trigger.

**005_operations.sql**

*Circle lifecycle and form alignment.* `CircleApplicationForm` currently spreads ~15 fields that are not columns, so the app's only real write fails with PGRST204. Add: `postal_code`, `country`, `co_rep_name`, `co_rep_email`, `co_rep_phone`, `description`, `works_description`, `previous_participation boolean DEFAULT false`, `social_media_instagram`. Canonical names stay `space_type`, `social_media_twitter`, `social_media_pixiv`, `social_media_website` — the form is fixed to match by P11; do not carry both spellings. Change `sells_commission` from `DECIMAL(5,2)` to `boolean` (form and both TS types treat it as a flag) and add `commission_rate numeric(5,2)` if the rate is still wanted. Add `'draft'` and `'submitted'` to the `application_status` CHECK (save-as-draft has no representable state today), plus `submitted_at`, `reviewed_at`, `reviewed_by uuid REFERENCES auth.users`, `review_notes text`, `waitlist_position int`. Drop the global `UNIQUE` on `circle_code` and add `UNIQUE(event_id, circle_code)` — every convention restarts at A-01 — plus `UNIQUE(event_id, user_id)` so one user cannot poison the queue with unlimited applications. Add a `BEFORE UPDATE` trigger `enforce_circle_field_permissions()` that raises if `application_status`, `payment_status`, `total_amount`, `booth_number`, `circle_code`, `event_id`, `user_id` or `review_notes` changed and `NOT public.is_event_organizer(event_id)` — one trigger replaces a whole per-action RPC set, and column-level REVOKE cannot be used here because organizers are also `authenticated`. Indexes `(event_id, application_status, created_at DESC)` and `(event_id, rating, genre)`.

*Furigana sort key.* Add `circle_name_sort_key text` (katakana folded to hiragana, derived from `circle_name_furigana` by a small immutable SQL function, maintained by trigger) and a btree index on `(event_id, circle_name_sort_key)`. Comiket-style catalogs are ordered 五十音; Postgres's default collation sorts kanji by code point, which is meaningless ordering.

*Operations tables.* `staff_tasks(id, event_id, title, description, category CHECK (setup|operations|security|customer_service|cleanup|emergency), priority CHECK (low|medium|high|critical), status CHECK (pending|in_progress|completed|cancelled), due_at, location, assigned_to uuid[] NOT NULL DEFAULT '{}' with a GIN index, created_by, completed_at, completed_by)` — an array column plus `auth.uid() = ANY(assigned_to)` in the policy beats a join table at this scale. `announcements(id, event_id, title jsonb, body jsonb keyed {en,ja,id}, severity CHECK (info|warning|critical), audience text[] DEFAULT '{public}', status CHECK (draft|scheduled|published|archived), publish_at, expires_at, pinned boolean, created_by)` — one row per announcement, no translation join table. `notifications(id, user_id NOT NULL REFERENCES auth.users, event_id, category, title, body, data jsonb, announcement_id, read_at, archived_at, created_at)` with a partial index `(user_id, created_at DESC) WHERE read_at IS NULL`; SELECT/DELETE `user_id = auth.uid()`; `REVOKE UPDATE ON notifications FROM authenticated; GRANT UPDATE (read_at, archived_at) ON notifications TO authenticated` — column grants are the native way to say "you may only mark it read"; **no INSERT policy** (fan-out is a trigger on `announcements`) or anyone can spam any user's inbox. `event_schedule(id, event_id, title jsonb, description jsonb, starts_at, ends_at, location, track)` indexed `(event_id, starts_at)`, public SELECT when the event is published. `queues(id, event_id, name, location, type, capacity, status, current_length int, current_wait_minutes int, updated_at)`.

*Attendance counter.* `event_counters(event_id PRIMARY KEY REFERENCES events, admitted_count int NOT NULL DEFAULT 0, queue_total int NOT NULL DEFAULT 0, updated_at)` maintained by an `AFTER INSERT` trigger on `ticket_scans` that increments on `result='admitted'`. Dashboard and QueueStatus subscribe to this single row, not to the raw scan stream: at doors-open a raw INSERT subscription fans thousands of messages to every organizer phone on venue wifi (O(scans × clients)); one counter row is O(clients). `// ponytail:` one counter row per event, no per-gate breakdown — split into `(event_id, gate_id)` if organizers need per-door numbers.

*Realtime.* `ALTER PUBLICATION supabase_realtime ADD TABLE queues, notifications, announcements, circles, booths, event_counters;` and `REPLICA IDENTITY FULL` on the tables needing filtered subscriptions on non-PK columns. Realtime is opt-in per table and this is the step that gets forgotten.

**006_catalog_floorplan_storage.sql**

*Public catalog.* Do **not** add a permissive public SELECT policy to `circles` — that row holds `email`, `phone`, `address`, `emergency_contact_name`, `emergency_contact_phone`. Create `public.circle_catalog` as a view projecting only `id, event_id, circle_code, circle_name, circle_name_furigana, circle_name_sort_key, pen_name, fandom, genre, rating, product_types, circle_cut_file_url, sample_works_images, social_media_twitter, social_media_pixiv, social_media_website, social_media_instagram, marketplace_link, booth_number`, filtered to `application_status='accepted'` on a published event. Leave `security_invoker = false` (reading past circles' RLS is the point), set `security_barrier = true`, `GRANT SELECT ON circle_catalog TO anon, authenticated`. **The projection is the access control — never `SELECT *` into this view.** Put that as a `COMMENT ON VIEW` and a PROGRESS.md line.

*Floor plan.* `CREATE EXTENSION IF NOT EXISTS btree_gist;` Add `booths.rotation numeric DEFAULT 0`, `booths.label text`. `CREATE UNIQUE INDEX one_booth_per_circle ON booths (circle_id) WHERE circle_id IS NOT NULL` — the server half of collision detection; nothing today stops one circle holding two booths. Add an exclusion constraint `EXCLUDE USING gist (event_id WITH =, floor_level WITH =, box(point(position_x, position_y), point(position_x + size_width, position_y + size_height)) WITH &&)` so geometric overlap is rejected by the database and the editor merely surfaces 23P01. Make `booths.circle_id` the single source of truth and stop writing `circles.booth_number` (expose it through `circle_catalog`). Add `events.floor_plan jsonb` for canvas dimensions and background — one editor does not need a floor_plans table.

*Storage.* Two buckets instead of one `circle-files`: `circle-public` (public read — circle cuts and sample works feed the catalog) and `circle-private` (PII, signed URLs only). Set `file_size_limit` and `allowed_mime_types` on the bucket rows; the client-side 5MB check in the form is bypassed by one curl and is not a control. Policies on `storage.objects` using the standard owner-folder pattern: INSERT/UPDATE/DELETE `WHERE bucket_id = 'circle-public' AND (storage.foldername(name))[1] = auth.uid()::text`. P11 changes the upload path from `sample-works/<random>` to `${uid}/${uuid}.${ext}` to match. Without both halves either every upload 403s or anyone overwrites another circle's artwork.

Explicitly **not** built (one PROGRESS.md Deferred line each): staff shifts, incidents, performance metrics, internal messaging.

**Done when**

Both files exist; `rg -n 'FROM staff' supabase/migrations/00[56]_*.sql` matches nothing inside a CREATE POLICY; `circle_catalog` lists columns explicitly with no `SELECT *` and no `email`/`phone`/`address`/`emergency_contact`; `one_booth_per_circle` and the gist EXCLUDE constraint both present; `ALTER PUBLICATION supabase_realtime` names event_counters.

---

### P8-auth-shell — Real auth, four roles, route guards, three layouts, event switcher, Home rewrite

**Wave 3** · depends on: P2-rls-foundation, P3-platform, P7-design-system, P15-i18n

**Owns** (exclusive write access):
- `src/App.tsx`
- `src/stores/authStore.ts`
- `src/components/RequireRole.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/PublicLayout.tsx`
- `src/components/layout/FocusLayout.tsx`
- `src/components/layout/nav.ts`
- `src/components/layout/EventSwitcher.tsx`
- `src/components/Footer.tsx`
- `src/components/FontLoader.tsx`
- `src/pages/Home.tsx`
- `src/pages/Login.tsx`
- `src/hooks/useTheme.ts`
- `src/components/RequireRole.test.tsx`

**Instruction**

The frame every later screen mounts into. Criterion 2 (guards) and most of criterion 6 (phone) land here.

**authStore.** Replace the entire body — today it stores `'mock-session-token'` and infers role from the email string. New shape: `getSession()` on boot, a `supabase.auth.onAuthStateChange` subscription, `signIn/signUp/signOut`, and `role` read from the `profiles` table (P2), not from a token or an email. Four roles only: `organizer | staff | circle | attendee` ('admin'→'organizer'; 'volunteer' becomes a per-event `staff.role`, not a global role). Delete the seeded user, `permissions: string[]`, `hasPermission()` — client-held permission strings are trivially forgeable by editing localStorage and no RLS policy may ever depend on them. **No `persist` middleware**: the Supabase client already persists the session, and a stale persisted role is a privilege bug. Expose `{ session, user, role, loading }`.

**RequireRole.** One component, not a factory and not a HOC: `<RequireRole roles={['organizer']}>` renders children when `role` matches, redirects to `/login?next=<path>` when unauthenticated, and to the role's home when authenticated-but-wrong-role. While `loading`, render a skeleton — never redirect, or a refresh bounces a signed-in organizer to the login page.

**Route table** in `src/App.tsx`, using layout routes so guard and chrome nest together (`<Route element={<RequireRole roles={['organizer']}><AppLayout/></RequireRole>}>`):
- public / PublicLayout: `/`, `/login`, `/e/:eventId` (guide), `/e/:eventId/catalog`, `/e/:eventId/map`, `/e/:eventId/schedule`, `/e/:eventId/tickets`
- attendee: `/wallet`
- circle: `/e/:eventId/apply`, `/circle/status`
- staff / FocusLayout: `/e/:eventId/scan`; AppLayout: `/e/:eventId/queue`, `/tasks`
- organizer / AppLayout: `/e/:eventId/dashboard`, `/e/:eventId/circles`, `/e/:eventId/booths`, `/e/:eventId/financial`, `/e/:eventId/staff`, `/e/:eventId/announcements`
- `/` redirects by role after login.
`:eventId` in the URL is the **single source of truth** for event scope — read it with `useParams`, never duplicate it into a store that can drift. Nine components are currently unrouted (~5,000 LOC), including TicketScanner which is criterion 3; this table gives every one of them a path and a role. Remove the literal `eventId="default-event-id"` prop.

**Three layouts, because one would be wrong.** *PublicLayout* — topbar + footer, no rail; attendees on phones do not need an admin rail. *AppLayout* — 240px sidebar using the `--sidebar-*` tokens (already defined, currently unused), collapsing to a Radix Dialog/Sheet drawer below `lg`; sidebar top slot is the **event switcher** (compact button: event thumbnail + name + chevron, popover grouped Upcoming/Past with a check on the current one and `+ Create event` last — per the Fibery/TheyDo references, tenant scope lives in the sidebar, identity in the topbar, never merged); nav grouped under small-caps labels EVENT / OPERATIONS / MONEY, filtered by role from `nav.ts`; pinned bottom = role badge + user row. Topbar carries breadcrumb, the P15 `<LanguageSwitcher/>`, theme toggle, notification bell, avatar menu with sign-out, and a **connectivity + last-sync chip**. *FocusLayout* — no nav chrome, full-bleed, large targets, explicit back affordance, for `/scan` and checkout; a scanner with a sidebar is a scanner that gets mis-tapped at the door.

The connectivity indicator currently lives only inside Dashboard's header while TicketScanner — the screen used on venue wifi under criterion 3 — has none. Rendering it once in the topbar (and, for FocusLayout, in the scanner's own top bar) is the single strongest reason this shell exists.

**Migration is mostly deletion.** Strip `min-h-screen` from Dashboard:195, BoothAllocation:224, EventGuide:238, AttendeeRegistration:231/275 (they fight the shell with nested full-height scroll containers) — coordinate by leaving a one-line note in PROGRESS.md for the screen packages rather than editing their files here. Delete Home's marketing nav and fold `Footer.tsx`'s flat 10-link list (which offers Financial, Staff and Booths to anonymous attendees) into the role-aware `nav.ts`. Delete `src/components/FontLoader.tsx` and its render in App.tsx — its `mode: 'no-cors'` HEAD request returns an opaque response that resolves even when the CDN is blocked, so the detection never fires; P7 self-hosts the font.

**Home.tsx rewrite.** 103 palette violations plus fabricated marketing copy shipping to real organizers: delete "Join thousands of circles and organizers using DoujinDesk" (the product has zero users — that is a false claim, not a styling issue) and the "Trusted by Convention Organizers" heading over four figures that are capacity ceilings and benchmarks, not traction (keep the figures under an honest "Built to handle" if wanted). Replace "Welcome to DoujinDesk", "Everything You Need for Convention Management", "Ready to Get Started?" with copy naming the actual job: who applies, who allocates, who scans. Collapse the seven-pastel-chip feature grid to one accent treatment, delete the `from-blue-50 to-indigo-100` page gradient, remove the P7 eslint baseline disable for this file.

**Dark mode.** `useTheme` writes the `dark` class to documentElement but its only caller is `Toaster`, and `toggleTheme` is never invoked — so ~60 authored `dark:` variants activate as a side effect of rendering a toast container and die if it is removed. Lift theme into a small Zustand slice or provider mounted in App.tsx, with an explicit topbar toggle and localStorage persistence, defaulting to OS preference.

**`RequireRole.test.tsx`** — criterion 7's role-guard redirect. Needs no mocking library: `MemoryRouter` plus `useAuthStore.setState()`. Assert: unauthenticated → `/login`; attendee hitting `/e/x/financial` → redirected, not rendered; organizer → renders; `loading` → neither renders nor redirects.

**Done when**

`pnpm test src/components/RequireRole.test.tsx` passes with the four assertions; every route in App.tsx is inside a layout route; `rg -n 'mock-session|hasPermission|permissions' src/stores/authStore.ts` returns nothing; `rg -n 'Join thousands|Trusted by Convention' src/pages/Home.tsx` returns nothing; sidebar collapses to a drawer at 320px with no horizontal scroll; `pnpm lint` and `pnpm build` green.

---

### P9-data-layer — Server-state layer: typed client, TanStack Query hooks, realtime hook, and the deletion of four Zustand stores

**Wave 4** · depends on: P6-schema-completion, P8-auth-shell

**Owns** (exclusive write access):
- `src/lib/supabase.ts`
- `src/lib/database.types.ts`
- `src/lib/queryClient.ts`
- `src/lib/queries/`
- `src/lib/useRealtimeTable.ts`
- `src/stores/circleStore.ts`
- `src/stores/ticketStore.ts`
- `src/stores/financialStore.ts`
- `src/stores/staffStore.ts`
- `src/stores/eventStore.ts`
- `src/stores/index.ts`
- `src/main.tsx`

**Instruction**

One data seam for every screen package, so P11–P14 can run in parallel without each inventing its own fetch pattern. This seam is not test-only overhead: criterion 1 (no mock data in components) and criterion 4 (totals from rows) both require it.

**Types.** `src/lib/supabase.ts` hand-maintains `Event` and `Circle` interfaces that lie about eight columns (`venue` vs `venue_name`, phantom `co_rep_*`/`postal_code`/`twitter`/`pixiv`, `sells_commission` boolean vs DECIMAL) — they are the direct cause of the broken circle insert, and `tsc --noEmit` passes anyway because `createClient` is untyped. Hand-write `src/lib/database.types.ts` from migrations 001–006 (the migrations are not applied, so `supabase gen types` cannot run yet) and type the client `createClient<Database>`. Put the exact regeneration command in a header comment for the owner to run post-apply, and a `// ponytail:` noting the file is hand-derived until then. Delete the drifted interfaces from `src/lib/supabase.ts`. Keep hand-written types only for view shapes (`circle_catalog`, `event_financial_summary`) and RPC payloads — import the scan ones from `src/lib/scanContract.ts` rather than redeclaring.

**TanStack Query.** `src/lib/queryClient.ts` with defaults tuned for venue wifi on a phone: `refetchOnWindowFocus: false`, `retry: 2`, `staleTime: 30_000`, `gcTime: 24h`. Mount `QueryClientProvider` in `src/main.tsx` (single-line wrap around the existing tree; the i18n import from P15 stays).

**`src/lib/queries/`** — one module per table, each exporting typed hooks and a `queryKeys` factory so invalidation is not stringly-typed: `events.ts` (`useEvents`, `useEvent`), `circles.ts` (`useCircles(eventId, filters)`, `useCircleCatalog(eventId)` reading the **view**, `useUpdateCircleStatus`), `booths.ts`, `tickets.ts`, `purchases.ts`, `transactions.ts` (`useFinancialSummary` reading `event_financial_summary` — never a client-side reduce), `staff.ts`, `queues.ts`, `announcements.ts`, `notifications.ts`, `schedule.ts`, `dashboard.ts`. Every hook takes `eventId` and applies `.eq('event_id', eventId)`; every list hook returns the standard `{ data, isLoading, error, isEmpty }` so screens render loading/error/empty from one convention instead of hand-rolled booleans.

**`src/lib/useRealtimeTable.ts`** — ~20 lines: subscribe to `postgres_changes` on a table with an `event_id=eq.X` filter and call `queryClient.invalidateQueries({ queryKey })` (or `setQueryData` for a single-row update). One hook, reused, so there is no per-screen subscription code. Realtime surfaces: QueueStatus (`queues`), NotificationCenter (`notifications`, filtered to the user), Dashboard attendance (`event_counters` — the single counter row, never the raw scan stream), CircleManagement review queue (concurrent organizers), BoothAllocation (concurrent editors), AnnouncementSystem published feed. Everything else is plain `useQuery`: CircleCatalog (staleTime 5min, realtime is waste), schedule/map/guide (staleTime 1h), FinancialManagement (explicit refresh — numbers moving while an organizer reconciles is actively harmful).

**Delete four stores outright: `circleStore`, `ticketStore`, `financialStore`, `staffStore`.** They are server data wearing client-state costumes. Two caches for the same rows means realtime updates one and not the other, and the divergence shows up as a stale number on the financial dashboard — so the deletions land in the same commits as the hooks, never "temporarily" alongside. Specifically remove: `financialStore.initializeMockData()` (five invented rows auto-seeded whenever the list is empty) plus `updateTransaction`/`deleteTransaction` (an immutable ledger has no update path; a correction is a reversing row); `ticketStore`'s validations array and `pendingSync` (superseded by the Dexie queue in P10) and its hardcoded tier seed; `staffStore`'s `Message`/`activeChannel`/`unreadCounts` (a chat system, explicitly outside the scope fence), `Incident`, `PerformanceMetric`, `StaffInvitation` — roughly 60% of an 18KB file, none of it in the feature surface; one PROGRESS.md Deferred line each.

**Shrink `eventStore` to one field.** Delete the hardcoded 'Comic Frontier 18' literal, the five invented aggregates (`totalBooths`, `soldTickets`, `revenue:{idr,usd}` — that pair contradicts the schema's per-event single `currency` and criterion 4) and the `await sleep(1000)` fake fetches. What survives is the event list query (in `queries/events.ts`) plus, if anything, a UI-only slice; `:eventId` from the URL is the source of truth.

**The localStorage trap — do not skip this.** All six stores wrap `persist` with no `version` and no `migrate`, and `partialize` wrote the mock literals to localStorage on first render. Deleting mock arrays from source satisfies the `grep -rn "Mock"` criterion while the owner's own browser still renders Sakura Studios and 2,500,000,000 IDR forever, because rehydration overwrites the new empty defaults. Every store that keeps `persist` gets `version: 2` plus a `migrate` returning fresh defaults; every deleted store's key is explicitly removed via `localStorage.removeItem('circle-store' | 'ticket-store' | 'financial-store' | 'staff-store' | 'event-store')` in a one-time boot cleanup in `src/main.tsx`. This is the single most likely way criterion 1 gets falsely marked done.

Update `src/stores/index.ts` to export only what remains (authStore from P8, the scanner UI slice from P10, and whatever single-field slice survives).

**Done when**

`src/stores/` contains no circleStore/ticketStore/financialStore/staffStore; `rg -rn 'initializeMockData|mockCircles|Comic Frontier' src/stores/` returns nothing; every remaining `persist` call declares `version: 2` and a `migrate`; `useFinancialSummary` selects from `event_financial_summary`; `supabase` is created as `createClient<Database>`; `pnpm build` and `pnpm test` green.

---

### P11-circle-path — Circle path end to end: application with draft + upload, review queue with bulk actions, payment redirect + webhook

**Wave 5** · depends on: P9-data-layer, P6-schema-completion, P5-money-core

**Owns** (exclusive write access):
- `src/components/CircleApplicationForm.tsx`
- `src/components/CircleApplicationForm.test.tsx`
- `src/components/CircleManagement.tsx`
- `src/components/PaymentProcessor.tsx`
- `src/pages/CircleStatus.tsx`
- `api/webhooks/payment.ts`

**Instruction**

The money-in flow and criterion 7's "circle application submit + validation" test. These are the only two real Supabase call sites in the repo and **both are currently broken** — every later component was going to be copied from them.

**CircleApplicationForm.** The insert spreads the whole zod object into `circles`; ~15 fields have no column, `sells_commission` is boolean vs DECIMAL, and `user_id` is never set — so PostgREST rejects it, and even with the columns the RLS INSERT check `auth.uid() = user_id` would reject it. Fix by mapping field-for-field to the real column names now that P6 has aligned them (`space_type`, `social_media_twitter/pixiv/website/instagram`), never by spreading. Set `user_id` from the session. Add `circle_cut_file_url` as a **distinct required upload** from sample works (the schema has the column; nothing writes it). Change the upload path from `sample-works/<random>` to `${uid}/${crypto.randomUUID()}.${ext}` in the `circle-public` bucket so P6's owner-folder storage policy applies — without the path change every upload 403s. Keep the client-side size check for UX but note in a comment that the bucket's `file_size_limit` is the actual control.
**Save-as-draft:** one debounced `upsert` of the form values to a `circles` row with `application_status='draft'`, resumed by `(event_id, user_id)` — reuses the existing table (P6 added 'draft' to the CHECK and the `UNIQUE(event_id, user_id)` that makes upsert work) rather than a drafts table. On submit, flip to `'submitted'` and set `submitted_at`.
**Furigana validation:** the furigana fields are *conditionally* required — required when the circle name contains kana or kanji, optional otherwise (an Indonesian circle called 'Studio Kelinci' has none). Do this in the zod schema with a script-detection regex; a DB CHECK is too blunt. `// ponytail:` regex script detection, upgrade to a proper detection helper if false positives appear. Furigana is a reading aid for kana sort and search, never a translation — do not route it through i18next.
**Payment:** on submit, hand off to the gateway (below). The total shown comes from `event_pricing` via the P5 trigger's computed `total_amount`, not from a client calculation.

**CircleManagement (review queue).** The fetch/filter/update logic is real and worth keeping; the blockers were RLS (fixed in P2) and two bugs: it writes `application_status: 'approved'` at lines ~433/464, which is not in the CHECK constraint (`pending|under_review|accepted|rejected|waitlisted`) while line ~130 counts `'accepted'` — so the approve button has never worked; and it writes `reviewed_at`, which P6 has now added. Fix both. Then: scope the fetch to `:eventId` (it currently fetches every circle across every event), add the **waitlist** action the schema already allows, add row selection with bulk accept/reject/waitlist as a single `.in('id', ids)` update, and add pagination — a 500-circle event will not render as one list.
Layout per the folk/LangChain/Twenty references: status tabs with counts across the top (`Pending 42 · Accepted · Waitlist · Rejected`), a filter pill row (genre, payment status, submitted date), then a table — checkbox · 32px circle-cut thumbnail + circle name with pen name as subtitle · genre · space preference · payment pill (dot + label, not a colored cell) · submitted date · row menu. Row height 44px for touch, ~14 rows per viewport. Clicking a row opens a **right inspector** with the full application and cut preview and Approve/Waitlist/Reject pinned at its bottom edge; reject requires a reason (`review_notes`). Selection raises a **floating action bar anchored over the table**, not a toolbar that pushes content down: `12 selected · Approve · Waitlist · Reject · Export CSV · ×`. Bulk approve confirms in a dialog naming the count. Below `lg` the table becomes stacked cards and the inspector becomes a Sheet.

**PaymentProcessor.** Delete the `cardNumber`/`expiryDate`/`cvv`/`cardholderName` fields entirely — a solo dev cannot hold PAN data, and touching a raw PAN puts the whole app in PCI-DSS SAQ-D scope. Delete the `setTimeout(3000)` that unconditionally reports success. The component's job shrinks to: show the authoritative amount, pick a method, redirect to a hosted checkout, and render pending / success / failed on return. Add the failure path — today payment cannot fail. Remove the dead `'payment'` step from the union.
**Provider:** default to **Midtrans Snap** (IDR, Indonesia is the primary market); isolate every provider-specific line behind one adapter module inside `api/webhooks/payment.ts` so swapping to Xendit is a single file. Add a PROGRESS.md line under Blocked: "Payment provider defaulted to Midtrans Snap — owner to confirm; changing it touches only api/webhooks/payment.ts and the redirect URL."
**`api/webhooks/payment.ts`** — one bare `@vercel/node` handler (no Express; P3 deleted it). Verifies the gateway signature, then uses the service role key **read from `process.env.SUPABASE_SERVICE_ROLE_KEY` in this file only** (top-of-file guard throwing if `typeof window !== 'undefined'`) to flip `ticket_purchases.status` / `circles.payment_status` to paid. The P5 trigger writes the immutable ledger row; the webhook never inserts into `financial_transactions` directly, and never touches the browser. Use the gateway's order id as the ledger `idempotency_key` so a replayed webhook is a no-op.

**`src/pages/CircleStatus.tsx`** — the circle's own view: application status timeline (draft → submitted → under review → accepted/waitlisted/rejected with `review_notes`), payment state and pay button, and booth assignment once `booths.circle_id` points at them. Small screen; reuse the query hooks from P9.

**Token sweep:** remove the P7 eslint baseline disables for CircleManagement (16 violations) and PaymentProcessor (1) in the same commit as the rewrite.

**`CircleApplicationForm.test.tsx`** — criterion 7. Use `@testing-library/user-event` (fireEvent does not reliably trigger react-hook-form validation) and `vi.mock` the P9 query module, not `@supabase/supabase-js` (hand-mocking the fluent builder encodes chain order and breaks on harmless refactors). Assert: required-field errors block submit; furigana required when the name contains kana and optional when it does not; a valid submit calls the mutation with real column names and a `user_id`; draft upsert fires on change.

**Done when**

`pnpm test src/components/CircleApplicationForm.test.tsx` passes; `rg -n "'approved'|reviewed_at" src/components/CircleManagement.tsx` shows only `'accepted'` and a column that exists; `rg -n 'cardNumber|cvv|setTimeout' src/components/PaymentProcessor.tsx` returns nothing; `rg -n 'SERVICE_ROLE' src/` returns nothing while `api/webhooks/payment.ts` matches; bulk accept issues one `.in('id', ids)` update; both files carry no eslint baseline disable.

---

### P12-booth-floorplan — Booth allocation, floor-plan editor, attendee map — one geometry model, DB-arbitrated conflicts

**Wave 5** · depends on: P9-data-layer, P6-schema-completion

**Owns** (exclusive write access):
- `src/components/BoothAllocation.tsx`
- `src/components/InteractiveMap.tsx`
- `src/lib/floorplan.ts`
- `src/lib/floorplan.test.ts`

**Instruction**

Criterion 7's "booth allocation conflict" test, plus the feature surface's floor-plan editor. Today the floor plan is a hardcoded 3-booth array with **London lat/lng** (`[51.505, -0.09]`) that the renderer ignores in favour of an index grid, Save/Export/Import/Reset have no `onClick`, and `handleBoothAssignment` is called with one argument from both dialog buttons so `circleId` is always undefined and the assign button actually *unassigns*. The attendee map is a separate hand-authored inline SVG pointing at `/maps/floor-1.svg`, a file that does not exist.

**One geometry model** in `src/lib/floorplan.ts`, shared by the organizer editor and the attendee map: booths are `{ id, booth_number, position_x, position_y, size_width, size_height, rotation, floor_level, status, circle_id }` straight from the `booths` table (every one of those columns already exists in 001/006). Plain SVG with pointer events for drag/place — leaflet was removed in P3 because it wants CDN map tiles, the one thing that will not work at the venue, and a venue floor is a fixed coordinate plane with a viewBox.

**Collision has two distinct meanings and both are server-arbitrated:**
1. *Double assignment* — one circle in two booths, or two circles in one booth. P6 added `CREATE UNIQUE INDEX one_booth_per_circle ON booths (circle_id) WHERE circle_id IS NOT NULL`. Assignment is a conditional update — `UPDATE booths SET circle_id = $2 WHERE id = $1 AND circle_id IS NULL RETURNING *` — and zero returned rows means someone else claimed it; surface that as "Booth A-12 was just taken by another organizer", not a generic toast. Client-side checks cannot fix this; two organizers on the floor-plan editor would otherwise both succeed.
2. *Geometric overlap* — P6 added a gist EXCLUDE constraint, so the database rejects an overlapping rectangle with 23P01. The editor pre-checks with a pure AABB scan for instant feedback and surfaces the DB error as the authority. `// ponytail:` O(n) AABB scan over booths on the same floor_level, fine at convention scale; spatial index if a floor exceeds ~2k booths.

`src/lib/floorplan.ts` exports the pure functions: `overlaps(a, b)`, `findCollisions(booth, others)`, `snapToGrid(point, size)`, `toSvgViewBox(booths)`, `exportPlan(booths)` / `importPlan(json)`. **`floorplan.test.ts`** is criterion 7's booth conflict test and covers only these pure functions — no DOM: touching edges do not overlap, one-pixel intrusion does, rotation is out of scope (note it), different `floor_level` never collides, import→export round-trips.

**BoothAllocation** loads and saves real `booths` rows via the P9 hooks scoped to `:eventId`, subscribes with `useRealtimeTable` so concurrent editors see each other, and makes Save/Export/Import/Reset actually work (export is JSON of the booth rows). Status values map to the DB CHECK (`available|reserved|occupied|maintenance`) — the current mock uses `assigned` and `blocked`, both illegal. Assignment picks a circle from accepted applications for the event. Fix the two dialog buttons to pass `circleId`.

**InteractiveMap** reads the same rows read-only plus `venue_locations`, derives floors from `booths.floor_level`, and supports "find this circle's booth" — the actual point of the feature, impossible today. Replace `getDirections`'s `alert()` with a highlight + scroll-to on the SVG.

**Tokens.** These two files hold 22 raw hex literals Tailwind cannot reach — a status map (`#10b981`, `#3b82f6`, `#f59e0b`, `#ef4444`), an 8-entry genre map, `stroke="#666"`, `background:'#f8f9fa'`, `#e5e7eb`, `#1f2937`, `#fbbf24`. Replace with `hsl(var(--success))` / `hsl(var(--warning))` / `hsl(var(--destructive))` / `hsl(var(--border))` / `hsl(var(--muted))` / `hsl(var(--chart-N))`, preferring Tailwind's `fill-*`/`stroke-*` classes where the value is static so dark mode follows automatically. Resolve the arithmetic first: 8 genres vs 5 `--chart-*` tokens — drop genre color-coding for a labelled legend, which reads better at 320px anyway. Remove both eslint baseline disables in the same commit.

**Done when**

`pnpm test src/lib/floorplan.test.ts` passes; `rg -n '51\.505|#[0-9a-fA-F]{6}' src/components/BoothAllocation.tsx src/components/InteractiveMap.tsx` returns nothing; assignment uses a conditional `WHERE circle_id IS NULL` update and renders a named conflict message on zero rows; Save persists and survives reload; no eslint baseline disable remains in either file.

---

### P13-attendee-surface — Attendee surface: catalog, ticket checkout, QR wallet, schedule, guide

**Wave 5** · depends on: P9-data-layer, P6-schema-completion, P5-money-core

**Owns** (exclusive write access):
- `src/components/CircleCatalog.tsx`
- `src/components/TicketingSystem.tsx`
- `src/components/AttendeeRegistration.tsx`
- `src/components/TicketWallet.tsx`
- `src/components/EventSchedule.tsx`
- `src/components/EventGuide.tsx`

**Instruction**

Four screens that currently render invented data, plus the wallet that does not exist. All data via the P9 hooks scoped to `:eventId`; every list gets loading / error / empty via the P7 `<EmptyState/>`; each file drops its P7 eslint baseline disable in the same commit as its rewrite (CircleCatalog 22 violations, EventSchedule 44, EventGuide 42, AttendeeRegistration 31, TicketingSystem 1).

**CircleCatalog** reads **`circle_catalog`** (the P6 view), never the `circles` table — that row holds email, phone, address and both emergency contacts, and a permissive public policy on it would be a data breach rather than a catalog. Rename the mock's `rating: number` (4.8 stars): the DB column `circles.rating` is an age rating (`all_ages|r15|r18`) and a naive mapping would render 'r18' where a star rating is expected — call the local one `popularity` or delete it. `genre`/`fandom` are scalar VARCHARs in the DB, not arrays. Facets: genre, fandom, rating, day, hall/block, has-online-shop — desktop left rail with counts, mobile a single `Filters` button opening a Sheet with applied facets as horizontally scrollable dismissible chips under the search bar. Cards show circle cut, circle name, pen name, **booth code in the mono font** (the field attendees actually navigate by) and genre chips. R18 gating happens at the card level, not just the detail page. Order by `circle_name_sort_key` when the locale is ja (P6 added the column and index — that is what makes 五十音 order correct), by `circle_name` otherwise. staleTime 5min, no realtime. Replace the `alert('Link copied')` share with the clipboard API and a toast.

**One ticket catalog.** `AttendeeRegistration` defines its own `{price, currency}` tier array (general/premium/vip) that contradicts `ticketStore`'s four tiers — the tier list an attendee buys from is not the tier list the organizer administers. Delete the local array; both screens read `tickets` rows for the event. `TicketingSystem` keeps the organizer-side tier admin (create/edit tiers, sales figures from `event_financial_summary`) and **loses its embedded scanner tab** — the scanner is a route at `/e/:eventId/scan` in FocusLayout now, with real `gate_id` and the signed-in staff id instead of the literals `GATE_SCAN_01` / `STAFF_001`.

**Checkout** never writes `payment_status: 'paid'` from the browser (AttendeeRegistration line ~200 does today — attendees mint themselves free tickets). It calls the P5 `purchase_tickets` RPC, which reads the price server-side and is the oversell guard, then hands off to the same gateway redirect P11 built; the webhook flips status and the trigger writes the ledger row. Layout per the Eventbrite/Posh references: tier list left as bordered cards with a `− 0 +` stepper and per-tier fee disclosure, sticky order summary right (on mobile a fixed bottom bar with total + full-width Checkout), sold-out tiers listed but greyed and disabled with the remaining count, totals in `tabular-nums` via `formatMoney` from P5. The checkout button disables on submit. Replace all `alert()` calls with inline field errors.

**TicketWallet** (new, route `/wallet`): the attendee's purchased tickets, one card per `ticket_passes` row, each rendering a real QR image from the pass's `qr_token` using the already-installed `qrcode` package via `QRCodeGenerator.generateQRCode` — which exists and is called from nowhere today, so no QR image is ever rendered anywhere in the app. Cache the pass rows and rendered data-URLs for offline viewing; venue wifi is the stated condition and a wallet that needs the network at the door is useless. Show holder name, tier, day, and order reference.

**EventSchedule** reads `event_schedule` (P6), grouped by day and track, with the jsonb title/body picked by the active locale.

**EventGuide** currently crams the whole attendee app into a 7-across TabsList that cannot render at 320px, and adds three more local mock arrays (`mockCircles`:90, `mockSchedule`:127, `mockAnnouncements`:157) that duplicate the children it already renders. Delete all three arrays and reduce the component to a light landing page for `/e/:eventId` linking to the real routes (`/catalog`, `/map`, `/schedule`, `/tickets`) — the tabs were the workaround for having no router shape, and P8 gave it one.

**Done when**

`rg -rn 'mock|Mock' src/components/{CircleCatalog,TicketingSystem,AttendeeRegistration,EventSchedule,EventGuide}.tsx` returns nothing; CircleCatalog selects from `circle_catalog` and no query in these files selects `email`/`phone`/`address`; checkout calls `purchase_tickets` and never writes `payment_status`; `/wallet` renders a scannable QR whose payload is a `qr_token`; no eslint baseline disable remains in any of the six files; 320px renders with no horizontal scroll.

---

### P14-organizer-ops — Organizer & staff operations: dashboard, financial dashboard, staff roster and tasks, announcements, notifications, queue counters

**Wave 5** · depends on: P9-data-layer, P6-schema-completion, P5-money-core

**Owns** (exclusive write access):
- `src/components/Dashboard.tsx`
- `src/components/FinancialManagement.tsx`
- `src/components/StaffCoordination.tsx`
- `src/components/AnnouncementSystem.tsx`
- `src/components/NotificationCenter.tsx`
- `src/components/QueueStatus.tsx`
- `src/pages/StaffTasks.tsx`

**Instruction**

Six screens of pure mock plus the staff task list. All data via P9 hooks scoped to `:eventId`, all realtime via `useRealtimeTable`, every list gets loading/error/empty from `<EmptyState/>`, and each file drops its P7 eslint baseline disable in the same commit (Dashboard 197 violations, AnnouncementSystem 69, QueueStatus 54, NotificationCenter 48, StaffCoordination 30, FinancialManagement 20).

**Dashboard** — the worst file in the repo and the screen an organizer looks at most. Data: stats from an `event_dashboard` query composed in `queries/dashboard.ts` over circles/booths/purchases/staff plus `event_financial_summary` (never a client-side count — criterion 4); notifications from the `notifications` table; the live attendance number from the **`event_counters` single row** over realtime, not from the raw `ticket_scans` stream (at doors-open that stream fans thousands of messages to every organizer phone on venue wifi). Wire the four quick actions, which are currently `() => console.log('Navigate to …')`, to `navigate()`. Delete the entire AI-slop signature set: the `from-slate-50 to-blue-50` page gradient (:195), the `bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent` page title (:200 and :405 — a plain `text-2xl font-semibold text-foreground` is what an admin page title is), the four pastel gradient stat cards (:230/:245/:261/:277 — flat `bg-card border`, the metric as the loudest element, one accent color reserved for the single most important number), `hover:shadow-lg transition-all duration-300` on every card, and `group-hover:scale-110` (:389). Four equally loud cards means none reads as more important than another. Move the online/offline + last-sync indicator out of this file — P8 renders it once in the topbar.

**FinancialManagement** — delete the `initializeMockData()` call (:57) and every trace of the store-computed summary. KPI row (circle fees collected · ticket revenue · refunds · net, each with a period delta) from `event_financial_summary`; one revenue-over-time chart using `--chart-1`/`--chart-2` for the circle-vs-ticket series; a period segmented control; then the ledger table — Date · type pill (`circle_payment`/`ticket_sale`/`refund`) · payer · method · amount right-aligned in `tabular-nums` · reference — with a sticky total row and Export CSV top-right, per the Mercury reference. Amounts through `formatMoney` with the **event's** currency, never a global IDR/USD toggle. There is no edit and no delete: the ledger is append-only and a correction is a reversing row (P5 enforces this with a trigger, so an edit button would just produce an error dialog). Explicit refresh, no realtime — numbers moving while an organizer reconciles is actively harmful.

**StaffCoordination** — six tabs render empty because the store's initial state is empty arrays and the four primary buttons are `console.log` stubs. Scope down hard to what the brief asks: roster from `staff` joined to `profiles` (invite, role, status, assigned zones — the invite itself needs `auth.admin.inviteUserByEmail` and therefore a server route; ship an "invite by existing account email" path now and add a PROGRESS.md Deferred line for email invitations) and tasks from `staff_tasks` with assign/complete. **Delete the Incidents and Messages tabs** — a chat system is explicitly outside the scope fence; one Deferred line each. Remove the hardcoded `currentUser` (:31) in favour of authStore. Status values must match the DB CHECK (`active|inactive|on_break`), not the store's Title Case.

**`src/pages/StaffTasks.tsx`** (route `/tasks`) — the staff-side task list, its own phone-sized route rather than a tab inside an organizer console: my tasks, priority, due time, location, mark in-progress/complete. The RLS policy allows an assignee to update only status/notes (P6).

**AnnouncementSystem** — compose into and read from `announcements` (jsonb title/body keyed en/ja/id, draft/scheduled/published, audience, pinned). Composed announcements currently vanish on reload and reach nobody. Delete the `metrics`, `social_media` and template surfaces and the literal placeholder string `'Analytics chart would be displayed here'` (:937) — outside the fence, and exactly the kind of text criterion 5 targets. Realtime on the published feed.

**NotificationCenter** — reads `notifications` filtered to `auth.uid()` with realtime; mark-read writes only `read_at`/`archived_at` (the only columns granted). Delete the seven hardcoded `https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=…` placeholder image URLs here and in AnnouncementSystem — a third-party IDE image host baked into components that hangs rather than fails fast offline, and which `grep -rn "Mock"` will not catch despite being mock data on a rendered screen. Replace with initials avatars from the existing `ui/avatar` primitive. Foreground in-app notifications only; Web Push is deferred (needs VAPID keys and a server route) with one PROGRESS.md line.

**QueueStatus** — `const [queues] = useState([...])` with no setter and a `setInterval` that only ticks a timestamp, which reads as live to an operator making crowd decisions. Read `queues` + `event_counters` with realtime. Show queue length, wait estimate, and the admitted counter; alerts derive from thresholds on real rows, not a mock alert array.

**Done when**

`rg -rn 'mock|Mock|trae-api-sg|Analytics chart would be' src/components/{Dashboard,FinancialManagement,StaffCoordination,AnnouncementSystem,NotificationCenter,QueueStatus}.tsx` returns nothing; `rg -n 'bg-gradient-to|bg-clip-text' src/components/Dashboard.tsx` returns nothing; FinancialManagement has no update or delete path and its totals come from `event_financial_summary`; the attendance counter subscribes to `event_counters`, not `ticket_scans`; no eslint baseline disable remains in any of the seven files.

---

### P16-hardening — Close out: full test run, responsive/a11y sweep, README rewritten to match the code, PROGRESS final

**Wave 6** · depends on: P10-offline-scanner, P11-circle-path, P12-booth-floorplan, P13-attendee-surface, P14-organizer-ops

**Owns** (exclusive write access):
- `README.md`
- `PROGRESS.md`
- `src/test/criteria.test.ts`

**Instruction**

The verification pass that makes the eight criteria falsifiable rather than asserted. Owns no component files — where it finds a defect, it fixes it in place and notes the file in PROGRESS.md (by this wave every screen package has landed, so there is no write conflict).

**Criterion 1 — mock data.** Run `grep -rn "Mock\|mockUser\|mock-session" src/` and confirm it returns nothing outside test fixtures. Also run the checks the grep misses: `rg -rn 'trae-api-sg|lorem|Lorem|Comic Frontier 18|Sakura Studios|2500000000|placeholder' src/`, and confirm the localStorage cleanup from P9 actually clears the legacy store keys by loading the app with a seeded `financial-store` key in a jsdom test.

**Criterion 7 — tests.** `pnpm test` must pass with the four required paths present and green: ticket scan valid/already-used/offline-queued (`src/lib/scanQueue.test.ts`, P10), circle application submit + validation (P11), booth allocation conflict (`src/lib/floorplan.test.ts`, P12), role-guard redirect (`src/components/RequireRole.test.tsx`, P8). Plus the contract tests from P4/P5. Add `src/test/criteria.test.ts` only for gaps found — no coverage thresholds, no per-component suites.

**Criterion 6 — phone.** Walk every route at 320 / 375 / 768 / 1440: no horizontal scroll, 44px minimum tap targets, drawer nav below `lg`, keyboard-navigable (tab order, visible focus ring — note P7 fixed the ring, which rendered blue-500 in an orange app), WCAG 2.1 AA contrast on every token pair in both themes. Check the surfaces most likely to fail: the review-queue table (becomes stacked cards), the floor-plan editor, the 7-across tab bars that P8/P13 were supposed to remove, and the scanner in landscape.

**Criterion 5 — no AI slop.** `pnpm lint` must pass with **zero remaining eslint baseline disables** — every screen package was supposed to remove its own; any left means that file was not actually migrated. Then a manual read for what the linter cannot see: leftover gradient backgrounds, seven-different-pastel icon chips, `hover:shadow-lg` on everything, and copy that claims traction the product does not have.

**Criterion 8 — README.** Rewrite it to describe the code as it now is. Every current claim is false or aspirational (PWA/offline, i18n, RBAC, 12 working modules, backend API, tests) — either it is now true and stays, or it is deleted. Include: what the app does, the actual stack, setup (pnpm, `.env.example`, and the explicit step "apply `supabase/migrations/002`–`006` via `supabase db push` — the agents write migrations, they never apply them"), the four roles, how to run tests, how to verify the PWA (`vite preview` or a Vercel preview with DevTools offline — **never** `vite dev`, where service workers behave differently and a green result proves nothing), and a short "Not built" section mirroring PROGRESS.md's Deferred list. No feature table that overstates.

**PROGRESS.md final state.** Done: one line per package. In progress: empty or honest. Blocked: rotate the service role key; apply migrations 002–006; confirm the payment provider (defaulted to Midtrans Snap); supply a real icon source asset if the generated PWA icons look poor at 512; run the six-statement RLS checklist in `supabase/migrations/README.md`; the `--primary` darkening for AA contrast is a visible brand change awaiting a nod. Deferred: staff shifts, incidents, performance metrics, internal chat, Web Push send, email staff invitations, per-gate attendance counters, plus a note that `circle_catalog` is `security_invoker = false` on purpose and any added PII column must be kept out of its projection.

Last: confirm `pnpm build` (`tsc -b && vite build`) exits 0 and `npx tsc --noEmit` still exits 0, as it did at the start.

**Done when**

`grep -rn "Mock\|mockUser\|mock-session" src/` returns nothing outside test fixtures; `pnpm test`, `pnpm lint` (zero baseline disables), `pnpm build` and `npx tsc --noEmit` all exit 0; every README claim is verifiable against a file in the repo; PROGRESS.md lists a Blocked item for each owner action.

---

## UI Spec

Mobbin-grounded layout reference. Implementers build against this rather than
designing admin tables and scanner screens from memory.

# DoujinDesk UI Spec — Mobbin Reference Research

Token note that constrains everything below: `src/index.css` sets `--destructive: 16 100% 50%` — **identical to `--primary`**. Every reference screen here relies on a red/green/amber semantic triad for status. Reject, invalid-scan, and refund cannot be told apart from a primary CTA today. Add `--success`, `--warning`, and a real red `--destructive` in the same `:root` block before building any of these screens; `--chart-1..5` already exist and are usable as-is.

---

## 1. Admin shell — sidebar with event switcher

- [Fibery](https://mobbin.com/screens/e470f040-82a2-44ec-8954-c70e56ce695b) — the switcher is a *compact top-left button* (avatar + workspace name + chevron), not a full-width card. Clicking opens a menu whose first row is the signed-in identity (name + email), then `Switch Workspace ▸` opening a submenu of workspaces with a checkmark on the active one and "Create Workspace" at the bottom. Below the switcher, nav is a flat scrolling list of item rows with small leading icons at ~13px text — no section cards, no boxes.
- [TheyDo](https://mobbin.com/screens/e5f0a333-2c70-4e56-985e-95b789ee699d) — same top-left switcher, but the popover splits workspaces into labelled groups ("Public workspaces" / "Private workspaces") with an eye icon for visibility. Sidebar bottom is pinned: trial/status card, then Invite / Help / Settings / Logout.
- [Coda](https://mobbin.com/screens/a3ef1072-6ee5-4347-aafc-467de278ac50) — workspace name with a coloured letter-avatar at top, nav items grouped under a small-caps `FOLDERS` label, and the topbar carries the search field + notification bell + account avatar while the sidebar carries navigation only.
- [Webflow](https://mobbin.com/screens/e6ef30e7-d8d2-450f-b039-1fd1ccc0bdd3) — the account menu is anchored to an avatar at the top-*right* of the topbar and is separate from the workspace switcher at the top-left of the sidebar. Two distinct affordances, never merged.

**DoujinDesk:** left sidebar `bg-[hsl(var(--sidebar))]`, width 240px, collapsing to a Sheet drawer below `lg`. Top slot = event switcher button showing the event's cover thumbnail + name + `▾`; popover groups by "Upcoming" / "Past" with a check on the current event and `+ Create event` as the last row. Nav groups with small-caps labels: `EVENT` (Dashboard, Circles, Booths, Tickets, Schedule), `OPERATIONS` (Staff, Scanner, Announcements), `MONEY` (Finance). Pinned bottom: role badge + user row. Topbar carries breadcrumb (`Event › Circles`), global search, language switcher (EN/JA/ID), theme toggle, avatar. **The event switcher is not in the topbar** — every reference puts tenant scope in the sidebar and identity in the topbar, and DoujinDesk's whole data model is event-scoped.

## 2. Circle application review queue

- [folk](https://mobbin.com/screens/05291921-da87-43a5-b33d-6a2544c19cb0) — 20+ rows visible at 768px height: ~20px row height, checkbox in a narrow leading column, avatar + name, then flat text columns. Selecting rows spawns a **floating action bar anchored over the table bottom** with the count ("2 people") and inline verb buttons (`Email`, `Enrich`, `Add to group`, `Merge`, `…`, `Cancel`) — not a toolbar that pushes content down.
- [LangChain](https://mobbin.com/screens/781a58fd-58a8-4fc0-88b1-2cebb3a4b4df) — same floating bar pattern, centred, pill-shaped, with an explicit `×` dismiss and a destructive action greyed until valid. Above the table sits a filter row: saved-view dropdown, date range, tab toggle, and a free-text search input that spans the remaining width.
- [Twenty](https://mobbin.com/screens/c961d1ac-e9bd-4f83-bede-c863f49d3f8e) — bulk edit opens a **right-hand inspector panel** over the table (fields for the 3 selected records, Cancel / Apply at the bottom) while selection stays visible on the left. This is the pattern for reviewing one application without leaving the queue.
- [Whop](https://mobbin.com/screens/e9248366-6dd2-48a7-b51f-621bc49f180d) — per-row `⋮` opens a context menu (Edit / Archive / Delete / Duplicate); status rendered as a small pill with a leading dot, not a coloured full cell. Footer reads `Showing 1 to 3 of 3` with first/prev/next/last chevrons.
- [Deel](https://mobbin.com/screens/f58be196-ad4a-408e-b9ca-3882581a13d6) — facet dropdowns as a single horizontal row of pill selects above the table; two-line cells (name + subtitle) for the identity column only.

**DoujinDesk:** status tabs across the top (`Pending 42 · Approved · Waitlist · Rejected`) with counts, then a filter pill row (genre, payment status, submitted date). Table columns: checkbox · circle-cut thumbnail 32px + circle name / PN name as subtitle · genre · booth preference · payment pill · submitted date · `⋮`. Row height 44px (touch), density ~14 rows per viewport. Clicking a row opens a right inspector with the full application, cut preview, and `Approve` / `Waitlist` / `Reject` at its bottom edge; reject requires a reason field. Selecting rows raises the floating bar: `12 selected · Approve · Waitlist · Reject · Export CSV · ×`. Bulk approve must confirm in a dialog naming the count — it writes booth-allocation-eligible rows.

## 3. Financial dashboard

- [Mercury](https://mobbin.com/screens/38664478-d88e-4575-a0b0-78ec6c218ce9) — the best model here. Top strip: a "Net change this month" figure with a delta vs last month, an area chart to its right, and a grouped chart panel; **directly beneath, with no card wrapper, the ledger table** — Date · counterparty (with logo) · Amount (green for in, plain for out) · Account · Method · Attachment. Chart and table share one filter row (Data Views, Filters, Date, Keywords, Amount) plus `Export All` top-right.
- [Monarch](https://mobbin.com/screens/dabe2c23-abd5-4952-9212-e79adbec362e) — Monthly/Quarterly/Yearly segmented control top-right of the chart; below, transactions on the left (2/3) and a **Summary card on the right** (Total Transactions, Average, Largest, Total Amount).
- [7shifts](https://mobbin.com/screens/e7f4ff6e-88da-4978-839d-66550face4ad) — sortable numeric table with a sticky **Total row** at the bottom and variance figures coloured red/green.
- [Kajabi](https://mobbin.com/screens/225fc8ac-1696-4a31-9dfa-2c46c2eb09f8) — three equal KPI cards each containing its own sparkline, above a plain reports list.

**DoujinDesk:** KPI row (Circle fees collected · Ticket revenue · Refunds · Net, each with period delta), one revenue-over-time chart using `--chart-1`/`--chart-2` for circle-vs-ticket series, a period segmented control, then the transaction ledger — Date · Type pill (circle_fee / ticket_sale / refund) · Payer · Method · Amount right-aligned with `tabular-nums` · Reference. Sticky total row. `Export CSV` top-right. Currency per event (IDR/USD) formatted via `Intl.NumberFormat`, never hand-concatenated.

## 4. Ticket purchase and checkout

- [Eventbrite](https://mobbin.com/screens/b73f4809-ee7e-4854-a752-8b56219a45b3) — modal, two-column: tiers left as stacked bordered cards each with name, `− 0 +` stepper on the right, price, "Sales end in 2 days", truncated description with `See more`. The *selected* tier gets a coloured border. Right column is a sticky order summary (line items + Total). Sticky footer: urgency pill ("Few tickets left") on the left, `Check out` primary button on the right.
- [Posh](https://mobbin.com/screens/4e6455be-bc03-4071-a359-eb6919356bd5) — same shape, plus per-tier fee disclosure inline ("$25.00 incl. $3.17 fees") and the total rendered very large in the right column above a single Checkout button. Unselected tiers collapse to a `+` only; the active tier expands to a full stepper.
- [Klook](https://mobbin.com/screens/75c64351-7fef-4198-ac3d-72ec0b2432a4) — date calendar and time chips before quantity; sold-out tiers stay listed but greyed with a "Sold out" label rather than hidden.
- [Kiwi.com](https://mobbin.com/screens/c0457747-45f6-492b-8182-93011c98faac) — numbered step rail across the top for multi-step checkout, with a "Recommended" badge on the middle tier.

**DoujinDesk:** single page, tier list left / sticky summary right; on mobile the summary becomes a fixed bottom bar (total + full-width `Checkout`). Show the fee breakdown per tier, day-1/day-2/both as tiers, sold-out tiers greyed and disabled with remaining count. Total in `tabular-nums`. Idempotency: the checkout button disables on submit and the resulting transaction row is the source of truth for the wallet.

## 5. QR scanner (iOS references)

- [Minna Bank](https://mobbin.com/screens/af8ca811-01fb-454a-99cc-4c0608a3d33e) — full-bleed black camera, four yellow corner brackets defining a square reticle, an animated scan line across it, instruction text pinned at the *top* under a close `×`, torch as a circular white FAB bottom-right. Highest-contrast of the set.
- [Uber](https://mobbin.com/screens/c9df75d3-ad98-407a-b196-516df6283491) — corner brackets, torch centred at the bottom, and critically a text link **"Enter ID instead"** below it. Manual fallback is a first-class control, not buried.
- [PayPal](https://mobbin.com/screens/7720fa67-5720-498d-bc82-b28ad4fc83b1) — segmented tabs above the viewfinder (`Scan` / `Your code` / `Show to Pay`) and "Align QR code in frame" hint *inside* the dark area.
- [Trip.com](https://mobbin.com/screens/05f634b7-46e2-413c-bfe5-2dd1ac05f709) — Album + Light as two labelled icon buttons in a row under the frame.
- [Luma](https://mobbin.com/screens/fb4c1d40-7784-43eb-ab19-b73151e16e84) — the result pattern to copy: a green **"Check In Successful" toast pill drops from the top** while the camera stays live, and a bottom sheet slides up with avatar, name, email, Status, Registration Time, Ticket type, and an `Undo Check In` button plus `…`. The scanner never leaves the screen.

**DoujinDesk:** full-bleed viewfinder, corner brackets, top bar with `×`, event name, and a **sync-state chip** (`Online` / `Offline · 12 queued`) — this is the one addition none of the references need. Torch FAB bottom-right, `Enter ticket ID` text link bottom-centre. Result = top toast + bottom sheet: green for valid (name, tier, ticket ID, Undo), red for already-used showing *when and by whom* it was first scanned, amber for "queued offline — will verify on sync". Keep the camera running; auto-dismiss the sheet after ~2s on success, require tap-to-dismiss on failure. Haptic + audio distinct per outcome — the operator is looking at the queue, not the phone.

## 6. Public circle catalog

- [Etsy](https://mobbin.com/screens/060b84d1-a334-4e7e-94e6-85801de20219) — left rail of collapsible facet groups (Category as a drill-down breadcrumb list, then checkbox and radio groups), with **active facets echoed as removable chips in a row above the grid** plus a `Reset` link and a `Hide filters` toggle. 4-up card grid.
- [Dribbble](https://mobbin.com/screens/80662ab5-1b1b-4927-a12c-ea8140f35bcf) — no left rail: a horizontal row of dropdown pills, a popular-tags chip row above it, and applied filters as dismissible chips with `Clear Filters`. Denser, better for mobile-first.
- [Unity](https://mobbin.com/screens/5b890789-7046-4cd6-8c88-7023df1cce94) — categories with counts (`3D (93)`), Sort-by and Results-per-page selects at top-right of the grid.

**DoujinDesk:** facets = genre, fandom, rating (all-ages / R18), day, hall/block, has-online-shop. Desktop: left rail with counts per facet. Mobile: a single `Filters` button opening a Sheet, with applied facets as horizontally scrollable chips under the search bar. Cards show circle-cut image, circle name, PN, booth code, genre chips — the booth code is the field attendees actually navigate by, so keep it visible and monospace-aligned. R18 gating happens at the card level, not just the detail page.

## 7. Empty, offline, and error states

- [Render](https://mobbin.com/screens/bfbc1823-0781-4138-b3ef-cd7309b8c10e) — no illustration: bold headline "Staging is empty", one explanatory sentence, and **two buttons — primary create + secondary alternative path**. The cleanest, least sloppy version.
- [Remote](https://mobbin.com/screens/33bb4d3b-441a-43d0-b694-51de065708a5) — distinguishes *no data* from *no results*: keeps the column headers and filter row rendered, and says "No results found — Try changing your filters or adjusting your search."
- [Whop](https://mobbin.com/screens/0a36578c-9518-49a7-9dbe-5a156d8e08cc) — "Get your first user" with a single CTA that routes somewhere useful rather than a dead-end.
- [Waymo](https://mobbin.com/screens/66ee96c8-a0e3-401b-a8d2-d7c80dbdaae7) — offline: line-art cloud icon, "Offline" headline, two-line body naming both causes (data / WiFi), `Retry` as a text link. No illustration budget needed.
- [GoPay](https://mobbin.com/screens/95483b32-a4d7-4025-b6e7-64220245eff5) — offline as a *card inside the page* with the topbar intact, and two buttons: `View settings` (secondary outline) + `Retry` (primary).

**DoujinDesk:** one `<EmptyState icon title description action secondaryAction>` component in `src/components/ui/`, used for all of them; no per-screen bespoke markup and no illustrations (nothing to commission, nothing that reads as stock AI art). Always keep table headers and filters mounted when the emptiness is filter-induced, and say which. Offline is a persistent topbar banner plus queued-count chip on the scanner — never a full-screen blocker, because the scanner must keep working while offline.

---

## Risks

- **[Data & state layer]** The RLS recursion in 001 (staff policy self-referencing staff) is not cosmetic — it makes six tables unreadable the instant real auth lands. If the plan sequences 'real auth' before 'RLS repair', every screen goes blank simultaneously and the cause looks like an auth bug rather than a policy bug. Fix the policies in the same migration that introduces the roles table.
- **[Data & state layer]** Deleting mock literals from source does not clear localStorage. Without a version bump on every persisted Zustand store, the repo passes the `grep -rn "Mock"` success criterion while the owner's own browser still renders Sakura Studios and 2.5B IDR. This is the single most likely way criterion 1 gets falsely marked done.
- **[Data & state layer]** Adding TanStack Query is the right call but the failure mode is keeping the old Zustand stores 'temporarily' alongside it. Two caches for the same rows means realtime updates one and not the other, and the divergence shows up as a stale number on the financial dashboard. The store deletions must land in the same commits as the query hooks, not after.
- **[Data & state layer]** React Query's offline mutation persistence looks like it solves the scanner and does not. It cannot survive an app kill mid-queue and has no vocabulary for 'this ticket was already redeemed on another device'. If an implementer reaches for it instead of Dexie + an idempotent RPC, criterion 3 fails in exactly the way the brief warns about — a silent double-admit.
- **[Data & state layer]** Subscribing to raw ticket_validations INSERTs for the live attendance counter will work perfectly in testing and fall over at doors-open on venue wifi: thousands of scans fanned out to every connected organizer phone. The counter-row-plus-trigger design has to be chosen up front; retrofitting it during a live event is not an option.
- **[Data & state layer]** Opening `circles` to anon for the public catalog is a one-line policy that leaks email, phone, address and both emergency contact fields. The column-filtered view is barely more work and is the difference between a catalog and a data breach.
- **[Data & state layer]** Six enum mismatches (circles.application_status, booths.status, staff.status, financial_transactions.transaction_type and status, ticket_purchases.payment_status) each fail as a runtime CHECK violation that the existing code catches and logs to console. They will not show up in `tsc --noEmit` and will not show up until a real row is written. Generating types from the live schema rather than hand-writing src/lib/supabase.ts is what turns these into compile errors.
- **[Data & state layer]** PaymentProcessor collecting raw card numbers is a compliance problem, not just a mock. Anything that keeps that form shape — even wired to a real gateway — drags the project into PCI SAQ-D. The gateway-redirect rewrite needs to be treated as part of the money path, not UI polish.
- **[Database schema &amp; security (Su]** The `.gitignore` `supabase/` + `*.sql` rules mean 001 has never been committed and 002+ never will be. If this is not fixed first, every hour of schema work in this plan lands in an untracked directory and disappears on clone. Highest-priority, lowest-effort item in the lens.
- **[Database schema &amp; security (Su]** RLS as written is not merely permissive, it is broken: the self-referential `staff` policy triggers Postgres 42P17 recursion, and five other tables' policies subquery `staff`. The app appears to work only because nothing is authenticated. The moment real auth lands, every authenticated read of circles/booths/tickets/purchases/transactions starts erroring — auth and the RLS rewrite must ship in the same step, or criterion 1 and 2 fight each other.
- **[Database schema &amp; security (Su]** Column-level GRANT/REVOKE is role-wide, not per-policy. Revoking `UPDATE (application_status)` from `authenticated` blocks organizers too, since they are also `authenticated`. The plan resolves this with BEFORE UPDATE trigger guards rather than RPCs; if an implementer reaches for column REVOKE on a column any role legitimately writes, they will break the organizer path and be tempted to fix it with the service role.
- **[Database schema &amp; security (Su]** `security_invoker = false` on `circle_catalog` is a deliberate RLS bypass. It is correct here because the column projection is the control, but a later `SELECT *` refactor or an added PII column silently makes home addresses public. Needs a comment on the view and a note in PROGRESS.md.
- **[Database schema &amp; security (Su]** The `one_admission_per_pass` partial unique index is the entire offline-conflict guarantee. It also forbids legitimate re-entry (wristband out-and-back), which real conventions do. If the owner needs re-entry, the fix is a `reentry` scan_type outside the index — not dropping the index, which would quietly restore double-admission.
- **[Database schema &amp; security (Su]** `amount DECIMAL(10,2)` overflows on IDR above ~100M. This is a silent-until-production failure: it will not surface in USD testing or in small-value test data, only on the first real ticket-batch or event-total row in Jakarta.
- **[Database schema &amp; security (Su]** The service role key is not currently exposed (Vite ignores non-`VITE_` vars, `.env` is untracked), but there is no mechanical guard. A single `VITE_` prefix added by a future agent ships full database write access in the JS bundle with no error and no test failure. The eslint/grep guard in work item 008 is cheap insurance.
- **[Database schema &amp; security (Su]** `ticket_passes` is one more table than a `quantity` column, and an implementer optimising for diff size may skip it. Without it, an order for five people admits either once or unlimited times — there is no correct middle. This is the one place in this lens where the extra table is not over-engineering.
- **[Database schema &amp; security (Su]** PLAN_PROMPT forbids applying migrations, so none of this is executable before handoff. Every constraint here is verified by reading, not by running. The exclusion constraint syntax (btree_gist + box) and the recursion behaviour in particular deserve a `supabase db lint` or a scratch-project dry run by the owner before the first real deploy.
- **[Database schema &amp; security (Su]** `staffStore.ts` models shifts, incidents, messages and performance metrics that this plan deliberately does not build tables for. If a UI-focused agent wires those screens to Supabase anyway, they will either invent an unreviewed schema or fall back to localStorage and re-break criterion 1. The Deferred list in PROGRESS.md needs to name all four explicitly.
- **[Design system & visual quality]** The Tailwind alpha-value diagnosis is derived from v3 source semantics, not from a compiled stylesheet — node_modules is pruned (`node_modules/postcss` and `node_modules/tailwindcss` are empty; the CLI throws MODULE_NOT_FOUND and a PostCSS harness cannot resolve either package). Before acting on it, `pnpm install` and grep the compiled CSS for `bg-primary\/90` and `ring-ring\/50`. If they turn out to be present, items 1 and 11 shrink to nothing and the rest of the plan is unaffected — but if the diagnosis holds and is skipped, the entire migration writes classes that render nothing.
- **[Design system & visual quality]** Darkening `--primary` from #ff4500 to ~#d63a00 for AA is a visible brand change on a token the owner chose. Present it as a choice (darken --primary, or keep it and add --primary-strong scoped to text-bearing surfaces) rather than committing it silently.
- **[Design system & visual quality]** Deleting the hex `@layer base` block is safe by source-order analysis and by grep (no TS/TSX reads project tokens — only Radix's own vars at select.tsx:109), but it is a 130-line delete that silently breaks every color if the ordering analysis is wrong. Delete it and the `@theme inline` block in a single isolated commit with a screenshot before/after, so it can be reverted independently of the migration.
- **[Design system & visual quality]** Adding success/warning/info invites scope creep into a full status color system with 5 steps each. Cap it at three hues, each with a foreground and one subtle surface, and reuse --chart-1..5 for genre/category. If the genre count (8) forces --chart-6..8, prefer dropping genre color-coding for a labelled legend — it reads better at 320px anyway.
- **[Design system & visual quality]** The app shell migration edits the root element of all 15 routed components at once. If it interleaves with the mock-data-to-Supabase rewrites, both diffs become unreviewable. Land the shell as its own commit before the data work starts, or explicitly after all of it — not during.
- **[Design system & visual quality]** Success criterion 5 says 'verified against real product references, not from memory', and the brief points at Mobbin MCP for admin table and scanner layouts. Mobbin (and Context7, Figma, Supabase) are unauthenticated in this environment, so no reference screenshots were consulted for this analysis — the shell recommendation is reasoned from the codebase and the brief, not from references. Authorize those connectors in an interactive session before designing the review queue, floor-plan editor, and scanner screens.
- **[Design system & visual quality]** The 729-violation count covers class-name palette usage only. It excludes copy quality, iconography consistency, spacing rhythm, and empty/loading/error state coverage — all of which are unbuilt and none of which a find-and-replace touches.
- **[feature completeness]** The offline scanner is the highest-risk item and it is nearly all greenfield: no decode loop, no IndexedDB, no sync, no signed credential, and the ticket format the app issues cannot be parsed by the scanner it ships with. Budget it as a build, not a fix — and build it before the cosmetic work, because criterion 3 is the one an organizer discovers at 9am on event day.
- **[feature completeness]** Role vocabulary and the source of truth for roles is a schema decision the brief flags as ask-worthy: authStore says admin|staff|volunteer|circle|attendee, the brief says organizer|staff|circle|attendee, and the database says nothing at all — every RLS predicate currently infers authority from 'has a row in staff'. Every guard, policy and query written before this is settled will need rewriting.
- **[feature completeness]** The payment provider is the second ask-worthy decision (the brief names payment flow explicitly). Midtrans vs Xendit vs Stripe changes the webhook shape, the ledger row's gateway fields, and whether IDR settles at all. Do not build PaymentProcessor past the redirect boundary until the owner names one.
- **[feature completeness]** 001's RLS is write-blocking, not just permissive-in-the-wrong-places: financial_transactions has no INSERT policy and ticket_purchases has no UPDATE policy. Anyone testing against the live project will see silent zero-row results that look like app bugs. Fix the policies in 002 before wiring any write, or debugging will eat days.
- **[feature completeness]** The migration cannot be applied by the agent — the owner applies it. Everything downstream of migration 002 (auth, guards, ledger, scans, catalog) is blocked on a human step. Sequence the work so there is a green, useful build both before and after the owner runs it, and say plainly in PROGRESS.md which commit needs which migration.
- **[feature completeness]** src/lib/supabase.ts is untyped, so tsc --noEmit passing means nothing about whether queries match the schema — the one real insert in the codebase is broken by twelve phantom columns and the build is green. Generate types early or every 'done' data screen carries the same latent failure.
- **[feature completeness]** Two features are drawn twice from different invented data: the floor plan (BoothAllocation's index grid vs InteractiveMap's inline SVG) and the ticket catalog (ticketStore vs AttendeeRegistration's local array). Converging each pair is cheaper now than after either side gets real data behind it.
- **[feature completeness]** Roughly 300 raw color-class hits across the components (Dashboard 48, QueueStatus 39, AnnouncementSystem 36, NotificationCenter 27) and the literal string 'Analytics chart would be displayed here'. Criterion 5 is a large mechanical sweep that is easy to defer and then rush; folding token fixes into each component's data rewrite costs far less than a separate pass at the end.
- **[feature completeness]** EventGuide, StaffCoordination and AnnouncementSystem contain surfaces outside the scope fence — a Messages/channel system, an incident tracker, an analytics dashboard. The lazy move is deleting them and one line each in PROGRESS.md 'Deferred', not porting them to real tables.
- **[Infrastructure, build, and platfor]** **Do not fix the gitignore and delete `supabase/config.ts` in separate commits.** Narrowing `supabase/` to track migrations, without deleting `config.ts` in the same change, commits the service role key. Sequence matters; this is the single highest-consequence ordering constraint in the whole plan.
- **[Infrastructure, build, and platfor]** **The service role key in `supabase/config.ts` should be treated as compromised regardless.** It has sat in plaintext on disk in a repo directory. Rotating it in the Supabase dashboard is the owner's call, but the plan should say so explicitly rather than assume the ignore rule protected it.
- **[Infrastructure, build, and platfor]** **`NetworkFirst` on any ticket-validity request is the double-admit bug wearing a Workbox costume.** NetworkFirst falls back to cache on network failure, which is exactly "return a stale 200 saying this ticket is valid". Criterion 3 forbids this outcome. The SW runtime caching config must have zero Supabase REST entries — the scanner's offline behaviour lives in the app's Dexie queue, and the SW must stay out of it entirely.
- **[Infrastructure, build, and platfor]** **Caching Supabase responses in the Cache API leaks across users.** The Cache API is origin-scoped, not session-scoped. A cached RLS-filtered response served after logout or a user switch hands one user another's rows, and caching `/auth/v1` puts bearer tokens somewhere any XSS can read. The safe rule is a blanket exclusion of `*.supabase.co` from runtime caching, with a single carve-out for public Storage assets.
- **[Infrastructure, build, and platfor]** **Do not ship Noto Sans JP as a webfont.** The full JA face is multiple megabytes; it would dominate the precache and be downloaded over exactly the connection the PWA exists to survive. System JA fonts (`Hiragino Sans`, `Yu Gothic`, `Noto Sans JP` if already installed) cover the target devices at zero bytes. If the design team pushes for a branded JA face, subsetting is a separate project — say no for now.
- **[Infrastructure, build, and platfor]** **iOS Safari has no Background Sync API.** Staff phones will include iPhones. Any offline design that leans on `SyncManager` works on Android and silently does nothing on iOS. Flush the queue from the app on the `online` event and on app focus — boring, portable, and testable in jsdom.
- **[Infrastructure, build, and platfor]** **Mocking `@supabase/supabase-js` directly is a trap worth naming in the plan.** Hand-mocking the fluent builder (`.from().select().eq().single()`) produces mocks that encode chain *order*, so they break on refactors that change nothing observable. If the plan does not introduce a data-access seam first, whoever writes the tests will reach for this and the suite will be brittle from day one.
- **[Infrastructure, build, and platfor]** **`vite-plugin-pwa`'s dev mode is not the shipping behaviour.** Service workers behave differently under `vite dev` even with `devOptions.enabled`. The offline scanner must be verified against `vite preview` or a Vercel preview deployment with DevTools offline mode — a green result in `vite dev` proves nothing.
- **[Infrastructure, build, and platfor]** **Deleting `api/` removes the Vite dev proxy's target.** If the payment webhook lands as a bare Vercel function, there is no local dev server for it; it can only be exercised via `vercel dev` or a preview deploy against the gateway sandbox. That is an acceptable trade for one endpoint, but it should be a conscious decision recorded in PROGRESS.md, not a surprise discovered mid-integration.
- **[Infrastructure, build, and platfor]** **Treating furigana as "the Japanese translation of the name" is the plausible-looking wrong turn.** 「東方地霊殿」's furigana 「とうほうちれいでん」is a reading aid, not a display alternative — swapping it in for JA users produces gibberish. It must never be routed through i18next, and the plan should say so, because the columns sitting next to each other invite exactly that mistake.
- **[Infrastructure, build, and platfor]** **`noUnusedLocals` + `noUnusedParameters` are on and the build runs `tsc -b`.** Test scaffolding and partially-wired features will fail the build on unused variables, not just warn. Worth knowing before someone spends an afternoon confused; keep the strictness, just expect it.
- **[Infrastructure, build, and platfor]** **Icon generation needs a real source asset.** The only existing icon is a 453-byte `favicon.svg`. Producing 192/512/maskable/apple-touch PNGs from it may look bad at large sizes — maskable especially, which needs a 40% safe zone. This is a design input the infrastructure work depends on and cannot manufacture.
