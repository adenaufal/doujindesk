# DoujinDesk — Progress

Branch: `feat/functional-rebuild`. Brief: `PLAN_PROMPT.md`. Plan: `PLAN.md`.

Every package appends one line under **Done** when it lands. Only `P1-repo-hygiene`
and `P16-hardening` restructure this file.

## Done

- Planning — audited the codebase across 5 lenses, researched UX references on
  Mobbin, generated and merged 3 competing architecture proposals into `PLAN.md`
  (16 packages, 7 waves).

## In progress

- Wave 0 — `P1-repo-hygiene`

## Blocked

- **Migrations cannot be applied from here.** `.env` points at a live Supabase
  project (`iaieygnykpwckdwkhcqc`). Every `supabase/migrations/00N_*.sql` this plan
  produces is written and committed but never run. Applying them is the owner's
  call: `supabase db push`, after review.
- **Rotate the service role key.** It sat in plaintext in `supabase/config.ts` in
  the working tree. It was never committed (verified: `git log --all -S
  'service_role'` is empty), so this is precaution rather than incident response —
  but the key is long-lived (`exp` 2035) and rotation is cheap.

## Deferred

- Nothing yet. Anything found outside the scope fence in `PLAN_PROMPT.md` gets one
  line here rather than an implementation.
