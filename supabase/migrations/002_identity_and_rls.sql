-- 002_identity_and_rls.sql
-- DoujinDesk — identity, roles, non-recursive RLS helpers, and the write policies 001 forgot.
--
-- WHY THIS MIGRATION EXISTS
-- 001:212-215 defines the staff SELECT policy as an EXISTS subquery over the very
-- table it protects, with the inner alias shadowing the outer on both sides. So the
-- second predicate is the tautology `staff.event_id = staff.event_id` AND the policy
-- on `staff` reads `staff`.
-- Postgres raises 42P17 "infinite recursion detected in policy for relation staff".
-- circles(185), booths(194), tickets(200), ticket_purchases(205) and
-- financial_transactions(218) all subquery `staff`, so the first authenticated read
-- fails on six tables at once and reads like an auth bug.
--
-- The fix is SECURITY DEFINER helpers: they read past RLS, so they can never re-enter
-- a policy. HARD RULE FROM HERE ON: no CREATE POLICY body may reference public.staff
-- directly. Only the helper bodies below do. That rule is grep-checkable:
--     rg -n 'FROM public\.staff' supabase/migrations/*.sql
-- and every hit must be inside a function body.
--
-- 001 is never edited. This migration is written and committed, NOT applied —
-- see supabase/migrations/README.md.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Preflight: 001 shipped `staff` as a loose contact list. Hardening it below
--    adds NOT NULL and UNIQUE, which fail with an opaque error on dirty data.
--    Fail early with an actionable message instead.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    n_null int;
    n_dup  int;
BEGIN
    SELECT count(*) INTO n_null FROM public.staff WHERE user_id IS NULL;

    SELECT count(*) INTO n_dup FROM (
        SELECT event_id, user_id
        FROM public.staff
        WHERE user_id IS NOT NULL
        GROUP BY event_id, user_id
        HAVING count(*) > 1
    ) d;

    IF n_null > 0 OR n_dup > 0 THEN
        RAISE EXCEPTION
            'public.staff has % row(s) with NULL user_id and % duplicate (event_id, user_id) pair(s). Link each staff row to an auth.users id and remove duplicates, then re-run 002.',
            n_null, n_dup;
    END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 1. Identity
-- ---------------------------------------------------------------------------

-- Four roles, matching the brief. authStore's fifth ('volunteer'/'admin') is an
-- event-scoped job title, not an account role — it lives on public.staff.role.
DO $$
BEGIN
    CREATE TYPE public.app_role AS ENUM ('organizer', 'staff', 'circle', 'attendee');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
    id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email              text NOT NULL,
    display_name       text,
    avatar_url         text,
    role               public.app_role NOT NULL DEFAULT 'attendee',
    locale             text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ja', 'id')),
    notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Backfill: everyone who already signed up gets the least-privileged role.
INSERT INTO public.profiles (id, email, display_name, avatar_url)
SELECT u.id,
       coalesce(u.email, ''),
       coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name'),
       u.raw_user_meta_data ->> 'avatar_url'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Profile row is created by trigger, never by the client. The requested role is
-- read from signup metadata but anything that is not 'circle' or 'attendee' is
-- coerced to 'attendee' — self-service signup must never mint an organizer.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    requested text;
BEGIN
    requested := NEW.raw_user_meta_data ->> 'role';

    INSERT INTO public.profiles (id, email, display_name, avatar_url, role, locale)
    VALUES (
        NEW.id,
        coalesce(NEW.email, ''),
        coalesce(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name'),
        NEW.raw_user_meta_data ->> 'avatar_url',
        CASE WHEN requested IN ('circle', 'attendee') THEN requested::public.app_role
             ELSE 'attendee'::public.app_role END,
        CASE WHEN NEW.raw_user_meta_data ->> 'locale' IN ('en', 'ja', 'id')
             THEN NEW.raw_user_meta_data ->> 'locale'
             ELSE 'en' END
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ---------------------------------------------------------------------------
-- 2. Membership — public.staff becomes the per-event membership table
-- ---------------------------------------------------------------------------

-- 001 allowed any free-text role. Demote anything unrecognised (least privilege)
-- before the CHECK lands; promoting on a guess would be the wrong direction.
UPDATE public.staff
   SET role = 'volunteer'
 WHERE role NOT IN ('organizer', 'coordinator', 'scanner', 'volunteer');

ALTER TABLE public.staff ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS invited_by  uuid REFERENCES auth.users(id);
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_event_user_unique;
ALTER TABLE public.staff ADD  CONSTRAINT staff_event_user_unique UNIQUE (event_id, user_id);

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE public.staff ADD  CONSTRAINT staff_role_check
    CHECK (role IN ('organizer', 'coordinator', 'scanner', 'volunteer'));

CREATE INDEX IF NOT EXISTS idx_staff_event_role ON public.staff(event_id, role);


-- ---------------------------------------------------------------------------
-- 3. Helpers — this is what breaks the recursion
--
-- SECURITY DEFINER  → executes as the owner, so it reads past RLS and never
--                     re-enters a policy.
-- STABLE            → one evaluation per statement, not per row.
-- SET search_path = '' → immune to a caller-planted schema; every identifier
--                     inside is fully qualified.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid());
$$;

-- The `created_by` arm is load-bearing, not a convenience. An organizer who has
-- just INSERTed an event has no row in public.staff yet, so a membership-only
-- predicate would lock them out of their own draft event, its circle
-- applications, its booths and its tiers — the review queue would render empty
-- and look like an RLS bug. Fixed once here rather than in six policies.
-- ponytail: the creator is implicit staff instead of a real roster row, so they
-- do not appear in the staff list. Upgrade path is an AFTER INSERT trigger on
-- events that seeds a `role='organizer'` staff row from the creator's profile.
CREATE OR REPLACE FUNCTION public.is_event_staff(p_event uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.staff s
        WHERE s.event_id = p_event
          AND s.user_id  = (SELECT auth.uid())
          AND s.status   = 'active'
    ) OR EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id = p_event
          AND e.created_by = (SELECT auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.is_event_organizer(p_event uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.staff s
        WHERE s.event_id = p_event
          AND s.user_id  = (SELECT auth.uid())
          AND s.status   = 'active'
          AND s.role     = 'organizer'
    ) OR EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id = p_event
          AND e.created_by = (SELECT auth.uid())
    );
$$;

-- Only used by the profiles SELECT policy. It exists so that policy does not
-- have to name public.staff itself — see the HARD RULE at the top of this file.
CREATE OR REPLACE FUNCTION public.manages_profile(p_profile uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.staff s
        WHERE s.user_id = p_profile
          AND public.is_event_organizer(s.event_id)
    );
$$;

-- Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE on every new function to
-- anon and authenticated *explicitly*, so revoking from PUBLIC alone leaves those
-- grants standing. Name all three.
REVOKE EXECUTE ON FUNCTION public.current_app_role()       FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_event_staff(uuid)     FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_event_organizer(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manages_profile(uuid)    FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()        FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_app_role()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_staff(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_organizer(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.manages_profile(uuid)     TO authenticated;

-- anon deliberately gets no EXECUTE. Every public-read policy below is written
-- as a separate `TO anon` policy whose predicate calls no helper, so anon never
-- trips a permission-denied inside a policy it cannot see. Predicate evaluation
-- order is not guaranteed, so `status <> 'draft' OR is_event_staff(id)` in a
-- shared anon+authenticated policy would be a coin flip, not an optimisation.


-- ---------------------------------------------------------------------------
-- 4. Schema gaps 001 left open
-- ---------------------------------------------------------------------------

-- "Day 1" and a ticket validity window are meaningless without this the moment a
-- Tokyo organizer and a Jakarta scanner disagree about what `now()` means.
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Jakarta';
-- No CHECK: a valid-IANA-name test needs a subquery over pg_timezone_names,
-- which CHECK constraints forbid. The app writes this from a fixed select list.

-- 001 gave every table `updated_at DEFAULT NOW()` and no trigger, so it freezes
-- at insert time and every "last modified" column in the app is a lie.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'events', 'circles', 'booths', 'tickets',
        'ticket_purchases', 'staff', 'financial_transactions', 'profiles'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
        EXECUTE format(
            'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
    END LOOP;
END $$;

-- A circle owner must be able to edit their own application and nothing that
-- decides money or admission. A WITH CHECK on user_id cannot express that —
-- it only stops ownership reassignment — and a column-level REVOKE would block
-- organizers too, since they are also `authenticated`. So: a BEFORE UPDATE guard.
--
-- SECURITY INVOKER on purpose: `current_user` must stay the *caller's* role.
-- Under PostgREST that is 'authenticated' or 'anon'; inside a SECURITY DEFINER
-- RPC (004's purchase/review functions) or on a service-role connection (the
-- payment webhook) it is not, and those paths legitimately write these columns.
--
-- ponytail: reverts silently instead of raising, so a client PATCH that echoes
-- an unchanged status still succeeds. Upgrade path if the silence confuses
-- someone: RAISE when NEW IS DISTINCT FROM OLD on any guarded column.
CREATE OR REPLACE FUNCTION public.circles_guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    IF public.is_event_organizer(NEW.event_id) THEN
        RETURN NEW;
    END IF;

    NEW.user_id            := OLD.user_id;
    NEW.event_id           := OLD.event_id;
    NEW.circle_code        := OLD.circle_code;
    NEW.application_status := OLD.application_status;
    NEW.payment_status     := OLD.payment_status;
    NEW.total_amount       := OLD.total_amount;
    NEW.booth_number       := OLD.booth_number;
    NEW.sells_commission   := OLD.sells_commission;
    NEW.notes              := OLD.notes;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS circles_guard_privileged_columns ON public.circles;
CREATE TRIGGER circles_guard_privileged_columns
    BEFORE UPDATE ON public.circles
    FOR EACH ROW EXECUTE FUNCTION public.circles_guard_privileged_columns();
-- Name sorts before 004's total_amount recompute trigger, so the guard restores
-- the old amount and the recompute then derives the authoritative one.


-- ---------------------------------------------------------------------------
-- 5. Drop every policy 001 created, by its exact name
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Events are viewable by everyone"                        ON public.events;
DROP POLICY IF EXISTS "Events can be created by authenticated users"           ON public.events;
DROP POLICY IF EXISTS "Events can be updated by creator"                       ON public.events;

DROP POLICY IF EXISTS "Circles are viewable by event staff and circle owner"   ON public.circles;
DROP POLICY IF EXISTS "Circles can be created by authenticated users"          ON public.circles;
DROP POLICY IF EXISTS "Circles can be updated by owner"                        ON public.circles;

DROP POLICY IF EXISTS "Booths are viewable by everyone"                        ON public.booths;
DROP POLICY IF EXISTS "Booths can be managed by event staff"                   ON public.booths;

DROP POLICY IF EXISTS "Tickets are viewable by everyone"                       ON public.tickets;
DROP POLICY IF EXISTS "Tickets can be managed by event staff"                  ON public.tickets;

DROP POLICY IF EXISTS "Ticket purchases are viewable by purchaser and event staff" ON public.ticket_purchases;
DROP POLICY IF EXISTS "Ticket purchases can be created by authenticated users"     ON public.ticket_purchases;

DROP POLICY IF EXISTS "Staff are viewable by event staff"                      ON public.staff;

DROP POLICY IF EXISTS "Financial transactions are viewable by event staff"     ON public.financial_transactions;


-- ---------------------------------------------------------------------------
-- 6. Policies, rewritten
--    Every predicate that needs event authority calls a helper. None of them
--    names public.staff. `(SELECT auth.uid())` is wrapped so the planner caches
--    it once per statement instead of once per row.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- profiles ------------------------------------------------------------------
CREATE POLICY profiles_select ON public.profiles
    FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()) OR public.manages_profile(id));

CREATE POLICY profiles_update_self ON public.profiles
    FOR UPDATE TO authenticated
    USING      (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- No INSERT policy: public.handle_new_user() is the only door.
-- No DELETE policy: profiles die with their auth.users row (ON DELETE CASCADE).

-- events --------------------------------------------------------------------
CREATE POLICY events_select_public ON public.events
    FOR SELECT TO anon
    USING (status <> 'draft');

CREATE POLICY events_select_auth ON public.events
    FOR SELECT TO authenticated
    USING (status <> 'draft' OR public.is_event_staff(id));

CREATE POLICY events_insert_organizer ON public.events
    FOR INSERT TO authenticated
    WITH CHECK (created_by = (SELECT auth.uid()) AND public.current_app_role() = 'organizer');

-- WITH CHECK re-tests authority against the post-update row. It does NOT hard-stop
-- reassigning `created_by`: is_event_organizer is STABLE, so it reads the statement
-- snapshot and still sees the old creator. Deliberately not guarded further — an
-- organizer who can do this can already achieve the same thing by inserting a
-- `role='organizer'` staff row, so it grants no authority they lack.
CREATE POLICY events_update_organizer ON public.events
    FOR UPDATE TO authenticated
    USING      (public.is_event_organizer(id))
    WITH CHECK (public.is_event_organizer(id));

-- circles -------------------------------------------------------------------
CREATE POLICY circles_select ON public.circles
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_event_staff(event_id));

CREATE POLICY circles_insert_owner ON public.circles
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 001's owner UPDATE had USING only, so a circle owner could PATCH themselves to
-- application_status='accepted'. WITH CHECK closes ownership reassignment; the
-- BEFORE UPDATE guard above closes the status/money columns.
CREATE POLICY circles_update_owner ON public.circles
    FOR UPDATE TO authenticated
    USING      (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY circles_update_organizer ON public.circles
    FOR UPDATE TO authenticated
    USING      (public.is_event_organizer(event_id))
    WITH CHECK (public.is_event_organizer(event_id));

-- No DELETE policy: applications are withdrawn by status, not erased.

-- booths --------------------------------------------------------------------
CREATE POLICY booths_select_public ON public.booths
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft'));

CREATE POLICY booths_select_auth ON public.booths
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft')
        OR public.is_event_staff(event_id)
    );

-- 001 let any staff row manage booths. A volunteer must not be able to move a
-- booth or reprice a tier; allocation is an organizer decision.
CREATE POLICY booths_write_organizer ON public.booths
    FOR ALL TO authenticated
    USING      (public.is_event_organizer(event_id))
    WITH CHECK (public.is_event_organizer(event_id));

-- tickets -------------------------------------------------------------------
CREATE POLICY tickets_select_public ON public.tickets
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft'));

CREATE POLICY tickets_select_auth ON public.tickets
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft')
        OR public.is_event_staff(event_id)
    );

CREATE POLICY tickets_write_organizer ON public.tickets
    FOR ALL TO authenticated
    USING      (public.is_event_organizer(event_id))
    WITH CHECK (public.is_event_organizer(event_id));

-- staff ---------------------------------------------------------------------
CREATE POLICY staff_select ON public.staff
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_event_staff(event_id));

CREATE POLICY staff_insert_organizer ON public.staff
    FOR INSERT TO authenticated
    WITH CHECK (public.is_event_organizer(event_id));

CREATE POLICY staff_update_organizer ON public.staff
    FOR UPDATE TO authenticated
    USING      (public.is_event_organizer(event_id))
    WITH CHECK (public.is_event_organizer(event_id));

CREATE POLICY staff_delete_organizer ON public.staff
    FOR DELETE TO authenticated
    USING (public.is_event_organizer(event_id));

-- ticket_purchases ----------------------------------------------------------
-- event_id is denormalised onto this table by 004; until then event authority is
-- derived through the tier. Replace this predicate with `is_event_staff(event_id)`
-- when 004 lands. Reading public.tickets here cannot recurse: tickets' own
-- policies call helpers only.
CREATE POLICY ticket_purchases_select ON public.ticket_purchases
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = ticket_id AND public.is_event_staff(t.event_id)
        )
    );

-- No write policies at all. 004's purchase_tickets() RPC is the only door;
-- 001's "created by authenticated users" INSERT policy let the browser decide
-- quantity, total_amount and payment_status.

-- financial_transactions ----------------------------------------------------
-- 001 exposed event revenue to every volunteer. Ledger reads are organizer-only,
-- and there is deliberately no INSERT/UPDATE/DELETE policy — 004 makes the table
-- append-only and writes it from a trigger.
CREATE POLICY financial_transactions_select_organizer ON public.financial_transactions
    FOR SELECT TO authenticated
    USING (public.is_event_organizer(event_id));


-- ---------------------------------------------------------------------------
-- 7. Grants
--    001:223-229 grants every privilege on all seven tables to `authenticated`.
--    That set includes TRUNCATE, which is NOT subject to row-level security: one
--    `truncate` call from the browser and the event is gone, policies intact.
--    Replace with the narrowest verb set each table's policies actually use.
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.events                 FROM authenticated;
REVOKE ALL ON public.circles                FROM authenticated;
REVOKE ALL ON public.booths                 FROM authenticated;
REVOKE ALL ON public.tickets                FROM authenticated;
REVOKE ALL ON public.ticket_purchases       FROM authenticated;
REVOKE ALL ON public.staff                  FROM authenticated;
REVOKE ALL ON public.financial_transactions FROM authenticated;
REVOKE ALL ON public.profiles               FROM authenticated, anon;

GRANT SELECT, INSERT, UPDATE         ON public.events           TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.circles          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booths           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff            TO authenticated;
GRANT SELECT                         ON public.ticket_purchases TO authenticated;
GRANT SELECT                         ON public.financial_transactions TO authenticated;

-- profiles: column-level UPDATE grant is the mechanism that stops self-promotion.
-- `role` and `email` are simply not grantable to the client, so no policy has to
-- defend them and no organizer path is collaterally blocked by a table-wide
-- REVOKE UPDATE. Role changes are an owner/service-role operation.
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, locale, notification_prefs)
    ON public.profiles TO authenticated;

-- anon keeps the read-only grants 001 gave it (events, tickets, booths) and gains
-- nothing. It is explicitly denied profiles.

COMMIT;
