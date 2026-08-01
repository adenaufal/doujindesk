# DoujinDesk — Progress

Branch: `feat/functional-rebuild`. Brief: `PLAN_PROMPT.md`. Plan: `PLAN.md`.

Every package appends one line under **Done** when it lands. Only `P1-repo-hygiene`
and `P16-hardening` restructure this file.

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

## In progress

- Wave 1 — `P2-rls-foundation`, `P3-platform`, `P7-design-system`
- Wave 2 — `P4-scan-contract` landed; `P5-money-core`, `P15-i18n` outstanding

## Blocked

- **Migrations cannot be applied from here.** `.env` points at a live Supabase
  project (`iaieygnykpwckdwkhcqc`). Every `supabase/migrations/00N_*.sql` this plan
  produces is written and committed but never run. Applying them is the owner's
  call: `supabase db push`, after review.
- **Owner must rotate the Supabase service role key.** It sat in plaintext in
  `supabase/config.ts` on disk; treat it as compromised regardless of the
  gitignore. It was never committed (verified: `git log --all -S 'service_role'`
  is empty) and the file is now deleted, but the key is long-lived (`exp` 2035),
  it was readable by anything with filesystem access, and rotation is cheap.

- **`pnpm build` cannot run yet — `node_modules` is pruned.** `node_modules/react/`
  and `node_modules/@types/*/` are empty directories, so `tsc -b` fails with seven
  `TS2688 Cannot find type definition file` errors before it reaches any source.
  Pre-existing and unrelated to any source change; it clears the moment
  `P3-platform` runs `pnpm install`. Until then no package can honestly report a
  green build.

## Deferred

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
