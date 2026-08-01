# supabase/migrations

Every schema change in this project is a numbered file here. **Agents write them.
The owner applies them.** Nothing in this directory has been run against the live
project (`.env` points at it), and no agent is permitted to run
`supabase db push`, `supabase db reset`, or any SQL against a remote.

## Apply order

| File | What it does | Written by |
|---|---|---|
| `001_initial_schema.sql` | The original seven tables. **Never edit this file.** Its RLS policies are broken (see below) and are replaced, not amended. | pre-existing |
| `002_identity_and_rls.sql` | `profiles` + `app_role`, `staff` hardened into a membership table, four `SECURITY DEFINER` helpers, every 001 policy dropped and rewritten, `GRANT ALL` removed, `updated_at` triggers, `events.timezone`. | P2 |
| `003_scanning.sql` | `ticket_passes`, append-only `ticket_scans`, `redeem_tickets()`. | P4 |
| `004_money.sql` | Ticket tier + order columns, `purchase_tickets()`, immutable ledger. | P5 |
| `005_*`, `006_*` | Circle lifecycle, operations tables, public catalog view, storage policies. | P6 |

Apply in numeric order:

```bash
supabase db push          # owner only, after reading the diff
```

`002` is the blocker for everything else. Until it is applied, the first
authenticated read of `circles`, `booths`, `tickets`, `ticket_purchases`,
`financial_transactions` or `staff` fails with:

```
42P17: infinite recursion detected in policy for relation "staff"
```

because 001's `staff` SELECT policy subqueries `staff`, and the other five tables
subquery `staff` too. It looks like an auth bug. It is a policy bug.

### If `002` aborts

It opens with a preflight `DO` block that raises if `public.staff` has rows with a
`NULL user_id` or duplicate `(event_id, user_id)` pairs — both of which `001`
permitted and both of which the new `NOT NULL` / `UNIQUE` constraints forbid.
Reconcile those rows (link each to an `auth.users` id, delete duplicates) and
re-run. The whole migration is one transaction, so a failure leaves nothing behind.

## The invariant `002` establishes

**No `CREATE POLICY` body may reference `public.staff`.** Event authority is only
ever expressed through the `SECURITY DEFINER` helpers, which read past RLS and so
can never re-enter a policy:

| Helper | True when the caller… |
|---|---|
| `public.current_app_role() → app_role` | — returns their account role from `profiles` |
| `public.is_event_staff(uuid)` | has an `active` `staff` row on the event, **or** created it |
| `public.is_event_organizer(uuid)` | has an `active` `staff` row with `role='organizer'`, **or** created it |
| `public.manages_profile(uuid)` | organizes any event the given profile staffs |

Both `is_event_*` helpers treat `events.created_by` as membership. Without that
arm, an organizer who has just created an event has no `staff` row yet and is
locked out of their own draft event, its applications, booths and tiers — which
renders as an empty review queue, not as a permission error.

Grep-checkable, and worth checking before every future migration:

```bash
rg -n 'FROM public\.staff|JOIN public\.staff' supabase/migrations/*.sql
```

Every hit must sit inside a function body. A hit inside a `CREATE POLICY` is the
42P17 bug coming back.

## Verification checklist

Paste these into the Supabase SQL editor **after** applying `002`. They are six
statements, not a test framework — they catch the failure mode that actually
matters, which is a policy that silently allows everything and reads as working.

Substitute four real UUIDs first:

- `:owner_a` — a `circle`-role user who owns a circle row
- `:owner_b` — a different `circle`-role user who owns a different circle row in the same event
- `:attendee` — any `attendee`-role user
- `:organizer` — a user with a `public.staff` row (`role='organizer'`, `status='active'`) on that event

Each block rolls back. Nothing here writes.

```sql
-- 1. A circle owner cannot read another circle owner's application row.
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":":owner_a","role":"authenticated"}';
  SET LOCAL role authenticated;
  DO $$
  DECLARE n int;
  BEGIN
    SELECT count(*) INTO n FROM public.circles WHERE user_id <> auth.uid();
    IF n > 0 THEN
      RAISE EXCEPTION 'FAIL 1: circle owner can see % foreign circle row(s)', n;
    END IF;
    RAISE NOTICE 'PASS 1: circles are owner-scoped';
  END $$;
ROLLBACK;
```

```sql
-- 2. A circle owner cannot approve themselves.
--    RLS lets the UPDATE through (they own the row); the BEFORE UPDATE guard
--    restores application_status, so the value must be unchanged afterwards.
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":":owner_a","role":"authenticated"}';
  SET LOCAL role authenticated;
  DO $$
  DECLARE before_status text; after_status text; cid uuid;
  BEGIN
    SELECT id, application_status INTO cid, before_status
      FROM public.circles WHERE user_id = auth.uid() LIMIT 1;

    UPDATE public.circles
       SET application_status = 'accepted', payment_status = 'paid', total_amount = 0
     WHERE id = cid;

    SELECT application_status INTO after_status FROM public.circles WHERE id = cid;

    IF after_status = 'accepted' AND before_status <> 'accepted' THEN
      RAISE EXCEPTION 'FAIL 2: circle owner self-approved (% -> %)', before_status, after_status;
    END IF;
    RAISE NOTICE 'PASS 2: application_status held at %', after_status;
  END $$;
ROLLBACK;
```

```sql
-- 3. An attendee sees zero ledger rows. 001 showed event revenue to every
--    staff row; 002 narrows it to organizers.
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":":attendee","role":"authenticated"}';
  SET LOCAL role authenticated;
  DO $$
  DECLARE n int;
  BEGIN
    SELECT count(*) INTO n FROM public.financial_transactions;
    IF n > 0 THEN
      RAISE EXCEPTION 'FAIL 3: attendee reads % ledger row(s)', n;
    END IF;
    RAISE NOTICE 'PASS 3: ledger is organizer-only';
  END $$;
ROLLBACK;
```

```sql
-- 4. The recursion is gone. This is the statement that raises 42P17 today.
--    Run it against all six previously-affected tables.
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":":attendee","role":"authenticated"}';
  SET LOCAL role authenticated;
  DO $$
  DECLARE t text; n int;
  BEGIN
    FOREACH t IN ARRAY ARRAY['circles','booths','tickets','ticket_purchases',
                             'financial_transactions','staff'] LOOP
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      RAISE NOTICE 'PASS 4: % readable (% row(s) visible)', t, n;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL 4: % on public.% — %', SQLSTATE, t, SQLERRM;
  END $$;
ROLLBACK;
```

```sql
-- 5. The organizer path still works — a policy that blocks everything passes
--    tests 1-4 and is just as broken.
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":":organizer","role":"authenticated"}';
  SET LOCAL role authenticated;
  DO $$
  DECLARE cid uuid; n int;
  BEGIN
    SELECT c.id INTO cid
      FROM public.circles c
     WHERE public.is_event_organizer(c.event_id)
     LIMIT 1;

    IF cid IS NULL THEN
      RAISE EXCEPTION 'FAIL 5: organizer sees no circle in their own event';
    END IF;

    UPDATE public.circles SET application_status = 'accepted' WHERE id = cid;
    GET DIAGNOSTICS n = ROW_COUNT;

    IF n <> 1 THEN
      RAISE EXCEPTION 'FAIL 5: organizer UPDATE affected % row(s)', n;
    END IF;

    PERFORM 1 FROM public.circles WHERE id = cid AND application_status = 'accepted';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FAIL 5: guard trigger reverted an organizer write';
    END IF;
    RAISE NOTICE 'PASS 5: organizer can review circles in their own event';
  END $$;
ROLLBACK;
```

```sql
-- 6. The public surface survives. anon must still read published events, and
--    must not read drafts.
BEGIN;
  SET LOCAL role anon;
  DO $$
  DECLARE n_pub int; n_draft int;
  BEGIN
    SELECT count(*) INTO n_pub   FROM public.events WHERE status <> 'draft';
    SELECT count(*) INTO n_draft FROM public.events WHERE status  = 'draft';
    IF n_draft > 0 THEN
      RAISE EXCEPTION 'FAIL 6: anon reads % draft event(s)', n_draft;
    END IF;
    RAISE NOTICE 'PASS 6: anon reads % published event(s), 0 drafts', n_pub;
  END $$;
ROLLBACK;
```

If check 5 fails while 1-4 pass, the policies are too tight, not too loose — that
is the failure this checklist exists to catch alongside the permissive one.

## Notes for later migrations

- `ticket_purchases`' SELECT policy derives event authority through
  `public.tickets` because `event_id` does not exist on that table until `004`.
  When `004` denormalises it, replace the subquery with
  `public.is_event_staff(event_id)`.
- The `circles_guard_privileged_columns` trigger is `SECURITY INVOKER` on purpose:
  it reads `current_user`, and only bypasses for roles that are not
  `authenticated`/`anon` (a `SECURITY DEFINER` RPC, or a service-role
  connection). Any future RPC that legitimately writes `application_status` or
  `payment_status` must be `SECURITY DEFINER` or it will be silently reverted.
- Column-level `GRANT`/`REVOKE` is role-wide, not per-policy. `profiles.role` and
  `profiles.email` are ungranted to `authenticated` rather than defended by a
  policy. Do not reach for `REVOKE UPDATE (col)` on a column any authenticated
  role legitimately writes — organizers are `authenticated` too, and the escape
  hatch people reach for next is the service role key.
