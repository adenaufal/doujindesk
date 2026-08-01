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
