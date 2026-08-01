# DoujinDesk Rebuild — Plan Prompt

The prompt below is the single task brief handed to the planning and
implementation agents. It is written to be given whole, up front.

---

## Role & audience

You are working on **DoujinDesk**, a convention management platform for doujin
and comic events (Comiket-style: circles apply for booths, organizers review
and allocate, attendees buy tickets and browse a catalog).

The output is read and run by the repo owner, a solo developer shipping this to
real convention organizers in Indonesia and Japan. They will operate it during a
live event, on venue wifi, from a phone. Correctness at the scanner and the
money paths matters more than breadth of screens.

## Starting state — what is actually true

The README describes a finished product. The code is a demo skeleton. Verified
as of this brief:

| README claim | Reality |
|---|---|
| PWA, offline-first, service workers | No manifest, no service worker. `dexie` is a dependency and is never imported. |
| Multi-language (EN/JA/ID) | No i18n library, no translation files, all strings hardcoded English. |
| Supabase auth, RBAC | `src/stores/authStore.ts` returns `'mock-session-token'` and infers role from the email string. No route guards — every route in `src/App.tsx` is public. |
| 12 feature modules | 12 components render hardcoded arrays. Only `CircleApplicationForm.tsx` and `CircleManagement.tsx` call Supabase. |
| Backend API | `api/routes/auth.ts` — every handler returns HTTP 501. |
| Tests | None. |

What is real and worth keeping:

- `supabase/migrations/001_initial_schema.sql` — a sound relational schema
  (events, circles, booths, tickets, …). Extend it; do not rewrite it.
- `src/index.css` — a complete design token set (orange `--primary`,
  indigo `--secondary`, radius, shadow, sidebar scale). Components ignore it and
  hardcode `blue-50`/`indigo-100`/`gray-900` instead. The tokens are the design
  system; make the components obey them.
- `src/components/ui/*` — 17 shadcn/ui primitives, correctly wired to tokens.
- TypeScript strict build passes (`npx tsc --noEmit`, exit 0). Keep it passing.

## Goal

DoujinDesk runs a real convention end to end: circles apply and pay, organizers
review and allocate booths, attendees buy tickets, staff scan those tickets at
the door on unreliable wifi, and the public browses a catalog. Every screen
reads and writes real data through Supabase under row-level security.

This is an end state, not a sequence. Choose the order yourself.

## Success criteria

Falsifiable, in priority order. Earlier items block later ones.

1. **No mock data reaches a rendered screen.** `grep -rn "Mock\|mockUser\|mock-session" src/` returns nothing outside test fixtures.
2. **Auth is real.** Supabase Auth session, four roles (`organizer`, `staff`, `circle`, `attendee`), route guards that redirect unauthenticated users, and RLS policies that make a stolen anon key useless — a circle owner can read only their own application row.
3. **The scanner works offline.** A staff member scans 50 tickets with the network off; scans queue in IndexedDB and reconcile on reconnect; a ticket already used offline is rejected on sync with a visible conflict, not silently double-admitted.
4. **Money is auditable.** Every circle payment and ticket sale writes an immutable transaction row. Financial totals are derived from those rows, never from component state.
5. **The UI does not read as AI-generated.** No `blue-50`→`indigo-100` gradients, no raw `gray-*`/hex, no Lorem ipsum. Every color traces to a token in `src/index.css`. Verified against real product references, not from memory.
6. **It works on a phone.** 320px to 1440px, no horizontal scroll, 44px tap targets, drawer navigation, keyboard-navigable, WCAG 2.1 AA contrast.
7. **The critical paths have tests.** Vitest + Testing Library covering: ticket scan (valid / already-used / offline-queued), circle application submit + validation, booth allocation conflict, and role-guard redirect. `npm test` passes.
8. **The README describes the code.** Every remaining claim is true, or deleted.

## Constraints

**Stack — extend, don't swap.** React 18, Vite, TypeScript, Tailwind + shadcn/ui,
Zustand, React Router 7, Supabase. Adding a library is fine when it earns its
place (i18n, PWA, test runner, data fetching). Replacing a working one is not.

**Database — write migrations, never apply them.** `.env` holds credentials for
a live Supabase project. Emit new files under `supabase/migrations/` and leave
applying them to the owner. Do not run destructive SQL, do not `db reset`, do
not edit `001_initial_schema.sql` in place — add `002_`, `003_` on top.

**Secrets stay put.** Never print, commit, or move the contents of `.env`. The
service role key belongs only in server-side code.

**Reach for what exists before adding.** The token set, the `ui/` primitives,
the existing schema, and the installed dependencies cover most of this. Prefer a
platform feature to a dependency, and a dependency already in
`package.json` to a new one. Where you deliberately take a shortcut with a known
ceiling, leave a `// ponytail:` comment naming the ceiling and the upgrade path.

**Scope fence.** Convention management only. No chat system, no CMS, no plugin
architecture, no multi-tenant billing, no admin-configurable workflow engine.
If you find something worth building that is outside this fence, write one line
about it in `PROGRESS.md` under "Deferred" and move on.

**Ambiguity.** Make routine calls yourself — naming, file layout, which
component owns which state. Stop and ask only when two readings of this brief
would produce materially different work, such as a choice that changes the
database schema or the payment flow.

## Feature surface

Grouped by who uses it. Depth over count: a module that genuinely works beats
three that render.

**Organizer** — multi-event switching; circle application review queue with
accept/reject/waitlist and bulk actions; booth floor-plan editor and allocation
with collision detection; financial dashboard from transaction rows; staff roster
and task assignment; announcement composer.

**Circle** — application form with save-as-draft, circle-cut upload, and payment;
status tracking; booth assignment view.

**Attendee** — ticket purchase across tiers; QR ticket wallet; public circle
catalog with genre/fandom/rating filters; interactive floor map; schedule.

**Staff** — offline-capable ticket scanner; live queue and attendance counters;
task list.

**Cross-cutting** — PWA install and offline shell; i18n EN/JA/ID; IDR/USD with
per-event currency; push and in-app notifications; dark mode.

## Deliverables

- Working code on a branch, committed in coherent steps.
- `supabase/migrations/00N_*.sql` for every schema change.
- `PROGRESS.md`, kept current: Done / In progress / Blocked / Deferred.
- `README.md` rewritten to match the code.
- `.env.example` listing every variable, with no values.

## Working agreement

Work end to end without check-ins. Commit after each step that leaves the build
green. Keep `PROGRESS.md` current as you go — it is how the owner picks the work
back up, and how a later agent avoids redoing yours.

When delegating: give search and exploration to cheaper models, keep the harder
reasoning for schema design, RLS policy, and offline conflict resolution. Do not
spawn a subagent to check work you just did.

---

## Reference material

Point agents at these rather than describing them:

- `supabase/migrations/001_initial_schema.sql` — the schema contract.
- `src/index.css` — the design token contract. Nothing outside it is a legal color.
- `src/components/ui/` — the component vocabulary.
- **Mobbin MCP** (`search_screens`, `search_flows`, `search_sections`) — real product
  screenshots for any layout being designed. Look at the images; do not design
  admin tables or scanner screens from memory.
- **frontend-expert skills** — `design-tokens`, `ui-components`, `responsive-ui`,
  `anti-ai-slop`, `ui-feel`, `accessibility`, `app-shell-routing`.
- **Context7 MCP** — current docs for any library API before writing against it.
