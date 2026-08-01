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

## In progress

- Wave 1 — `P2-rls-foundation`, `P3-platform`, `P7-design-system`

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

- Staff shift scheduling — outside the scope fence.
- Incident tracking — outside the scope fence.
- Staff performance metrics — outside the scope fence.
- Internal staff chat / messaging — outside the scope fence (the brief names "no
  chat system" explicitly).
- Web Push *send* — needs VAPID keys and a server route to hold the private half.
  In-app notifications cover the same jobs without either.
