-- 005_operations.sql
-- DoujinDesk — circle lifecycle, 五十音 sort keys, and the five operations tables
-- the feature surface needs but 001 never created.
--
-- WHY THIS MIGRATION EXISTS
--   1. `CircleApplicationForm` spreads ~15 keys that are not columns, so the app's
--      only real write fails with PGRST204 before it reaches RLS. Half of this file
--      is closing that gap and giving "save as draft" a representable state.
--   2. `circle_code` carries a *global* UNIQUE in 001. Every convention restarts at
--      A-01, so the second event to use the app cannot allocate its own codes.
--   3. Nothing stops one user filing unlimited applications for one event.
--   4. Postgres orders kanji by code point. A Comiket-style catalog is ordered
--      五十音, which needs a folded kana key maintained next to the name.
--   5. staff tasks, announcements, notifications, schedule, queues and the live
--      attendance counter have no tables at all.
--
-- Depends on 002 (helpers, `set_updated_at`, `circles_guard_privileged_columns`),
-- 003 (`ticket_scans`, for the counter trigger) and 004 (money columns).
-- Never edits 001. Written and committed, NOT applied — see
-- supabase/migrations/README.md.
--
-- HARD RULE INHERITED FROM 002: no CREATE POLICY body may name public.staff.
-- Event authority is only ever `public.is_event_staff` / `public.is_event_organizer`.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Preflight
--
--    Two constraints below can fail on existing data. Fail with a sentence
--    somebody can act on rather than with a constraint name.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    n_dup int;
BEGIN
    IF to_regprocedure('public.is_event_organizer(uuid)') IS NULL THEN
        RAISE EXCEPTION
            'public.is_event_organizer(uuid) is missing. Apply 002_identity_and_rls.sql before 005_operations.sql.';
    END IF;

    IF to_regclass('public.ticket_scans') IS NULL THEN
        RAISE EXCEPTION
            'public.ticket_scans is missing. Apply 003_scanning.sql before 005_operations.sql — event_counters is maintained by a trigger on it.';
    END IF;

    SELECT count(*) INTO n_dup FROM (
        SELECT event_id, user_id
        FROM public.circles
        WHERE user_id IS NOT NULL
        GROUP BY event_id, user_id
        HAVING count(*) > 1
    ) d;

    IF n_dup > 0 THEN
        RAISE EXCEPTION
            'public.circles has % (event_id, user_id) pair(s) with more than one application. One user gets one application per event; merge or delete the extras and re-run 005.',
            n_dup;
    END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 1. Circles — the columns the application form already sends
--
--    Canonical spellings are `space_type`, `social_media_twitter`,
--    `social_media_pixiv`, `social_media_website`. The form's `space_preference`,
--    `twitter`, `pixiv`, `website`, `space_size` and `currency` are NOT added as
--    second columns — P11 renames them in the form. Two spellings for one field
--    is how a value ends up written to one and read from the other.
-- ---------------------------------------------------------------------------

ALTER TABLE public.circles
    ADD COLUMN IF NOT EXISTS postal_code             text,
    ADD COLUMN IF NOT EXISTS country                 text,
    ADD COLUMN IF NOT EXISTS co_rep_name             text,
    ADD COLUMN IF NOT EXISTS co_rep_email            text,
    ADD COLUMN IF NOT EXISTS co_rep_phone            text,
    ADD COLUMN IF NOT EXISTS description             text,
    ADD COLUMN IF NOT EXISTS works_description       text,
    ADD COLUMN IF NOT EXISTS previous_participation  boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS social_media_instagram  text,
    ADD COLUMN IF NOT EXISTS commission_rate         numeric(5,2),
    ADD COLUMN IF NOT EXISTS submitted_at            timestamptz,
    ADD COLUMN IF NOT EXISTS reviewed_at             timestamptz,
    ADD COLUMN IF NOT EXISTS reviewed_by             uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS review_notes            text,
    ADD COLUMN IF NOT EXISTS waitlist_position       int,
    ADD COLUMN IF NOT EXISTS circle_name_sort_key    text;

-- 001 declared `sells_commission DECIMAL(5,2) DEFAULT 0`. The form, both TS types
-- and CircleManagement all treat it as a flag. The rate moves to
-- `commission_rate` above; a non-zero legacy value becomes true and carries its
-- own number across.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'circles'
          AND column_name = 'sells_commission' AND data_type <> 'boolean'
    ) THEN
        UPDATE public.circles
           SET commission_rate = sells_commission
         WHERE sells_commission IS NOT NULL AND sells_commission > 0;

        ALTER TABLE public.circles ALTER COLUMN sells_commission DROP DEFAULT;
        ALTER TABLE public.circles ALTER COLUMN sells_commission
            TYPE boolean USING (coalesce(sells_commission, 0) > 0);
        ALTER TABLE public.circles ALTER COLUMN sells_commission SET DEFAULT false;
    END IF;
END $$;

ALTER TABLE public.circles DROP CONSTRAINT IF EXISTS circles_commission_rate_check;
ALTER TABLE public.circles ADD  CONSTRAINT circles_commission_rate_check
    CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100));

-- Save-as-draft has no representable state in 001's CHECK. Lifecycle:
--   draft → submitted → under_review → accepted | rejected | waitlisted
-- `pending` is 001's default and its rows still exist, so it stays in the domain
-- as the legacy synonym for `submitted`. New writers use `draft`/`submitted`.
-- The column DEFAULT is deliberately left at 001's 'pending': flipping it to
-- 'draft' would make any INSERT that forgets the field invisible to the review
-- queue, which is a silent failure rather than a loud one.
ALTER TABLE public.circles DROP CONSTRAINT IF EXISTS circles_application_status_check;
ALTER TABLE public.circles ADD  CONSTRAINT circles_application_status_check
    CHECK (application_status IN (
        'draft', 'submitted', 'pending', 'under_review',
        'accepted', 'rejected', 'waitlisted'));

-- A draft has no code yet, and the code an organizer allocates (A-01) is theirs to
-- assign — not something the applicant's browser invents. 001 made it NOT NULL,
-- which is why the form currently generates `C123456AB` junk.
ALTER TABLE public.circles ALTER COLUMN circle_code DROP NOT NULL;

-- Global UNIQUE → per-event UNIQUE. Every convention restarts at A-01.
ALTER TABLE public.circles DROP CONSTRAINT IF EXISTS circles_circle_code_key;
ALTER TABLE public.circles DROP CONSTRAINT IF EXISTS circles_event_code_unique;
ALTER TABLE public.circles ADD  CONSTRAINT circles_event_code_unique
    UNIQUE (event_id, circle_code);

-- One application per user per event. Without it a single account can flood the
-- review queue, and "my application" stops being a single row the UI can show.
ALTER TABLE public.circles DROP CONSTRAINT IF EXISTS circles_event_user_unique;
ALTER TABLE public.circles ADD  CONSTRAINT circles_event_user_unique
    UNIQUE (event_id, user_id);


-- ---------------------------------------------------------------------------
-- 2. 五十音 sort key
--
--    Postgres's default collation sorts kanji by code point, which puts 亜 before
--    渋谷 for no reason a reader would recognise. Catalogs are ordered by reading,
--    so fold the furigana to a single kana form and sort on that.
--
--    translate() with a matched 86-character pair is the whole implementation:
--    U+30A1..U+30F6 (ァ..ヶ) maps 1:1 onto U+3041..U+3096 (ぁ..ゖ).
--
--    ponytail: halfwidth katakana (U+FF66..U+FF9F) and the prolonged sound mark ー
--    are not folded, so ﾊﾂﾈ sorts apart from はつね. Upgrade path is one more
--    translate() pair — deliberately skipped because every input path in this app
--    is a form field an organizer can fix, not a bulk import.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.kana_sort_key(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = ''
AS $$
    SELECT lower(btrim(translate(
        p_text,
        'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ',
        'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ'
    )));
$$;

REVOKE EXECUTE ON FUNCTION public.kana_sort_key(text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.kana_sort_key(text) TO authenticated;


-- ---------------------------------------------------------------------------
-- 3. Circle lifecycle stamps + sort key, maintained by trigger
--
--    Name matters. BEFORE triggers fire in name order:
--      circles_guard_privileged_columns (002) → reverts what a non-organizer may
--                                               not change
--      circles_set_total_amount         (004) → derives the fee
--      circles_stamp_lifecycle          (005) → stamps submitted/reviewed and the
--                                               sort key, over the top of both
--    Reversing that order would let the guard revert a stamp it never saw.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.circles_stamp_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.circle_name_sort_key := coalesce(
        public.kana_sort_key(nullif(btrim(coalesce(NEW.circle_name_furigana, '')), '')),
        public.kana_sort_key(coalesce(NEW.circle_name, '')));

    IF TG_OP = 'INSERT' THEN
        IF NEW.application_status <> 'draft' THEN
            NEW.submitted_at := coalesce(NEW.submitted_at, now());
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.application_status IS DISTINCT FROM OLD.application_status THEN
        IF OLD.application_status = 'draft' AND NEW.application_status <> 'draft' THEN
            NEW.submitted_at := coalesce(NEW.submitted_at, now());
        END IF;

        IF NEW.application_status IN ('accepted', 'rejected', 'waitlisted') THEN
            NEW.reviewed_at := coalesce(NEW.reviewed_at, now());
            NEW.reviewed_by := coalesce(NEW.reviewed_by, (SELECT auth.uid()));
        END IF;
    END IF;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS circles_stamp_lifecycle ON public.circles;
CREATE TRIGGER circles_stamp_lifecycle
    BEFORE INSERT OR UPDATE ON public.circles
    FOR EACH ROW EXECUTE FUNCTION public.circles_stamp_lifecycle();

-- Backfill for rows that predate the column.
UPDATE public.circles
   SET circle_name_sort_key = coalesce(
           public.kana_sort_key(nullif(btrim(coalesce(circle_name_furigana, '')), '')),
           public.kana_sort_key(coalesce(circle_name, '')))
 WHERE circle_name_sort_key IS NULL;


-- ---------------------------------------------------------------------------
-- 4. The field-permission guard, extended
--
--    PLAN.md asks for a new `enforce_circle_field_permissions()` BEFORE UPDATE
--    trigger here. 002 already ships exactly that trigger under the name
--    `circles_guard_privileged_columns`, and its name is load-bearing (see the
--    ordering note above). A second trigger doing the same job would fight it, so
--    this is a CREATE OR REPLACE of the 002 function — 002's *file* is untouched.
--
--    One behaviour change beyond the new columns: an applicant must be able to
--    press Submit. That is the single transition draft → submitted; every other
--    application_status move is still reverted for a non-organizer.
--
--    SECURITY INVOKER on purpose (002): `current_user` must stay the caller's
--    role, so a SECURITY DEFINER RPC or a service-role connection passes through.
--
--    ponytail: still reverts silently rather than raising, so a PATCH that echoes
--    an unchanged status succeeds. Upgrade path unchanged from 002 — RAISE when
--    NEW IS DISTINCT FROM OLD on a guarded column.
-- ---------------------------------------------------------------------------

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

    NEW.user_id          := OLD.user_id;
    NEW.event_id         := OLD.event_id;
    NEW.circle_code      := OLD.circle_code;
    NEW.payment_status   := OLD.payment_status;
    NEW.total_amount     := OLD.total_amount;
    NEW.booth_number     := OLD.booth_number;
    NEW.sells_commission := OLD.sells_commission;
    NEW.commission_rate  := OLD.commission_rate;
    NEW.notes            := OLD.notes;

    -- Organizer-only review fields (005).
    NEW.reviewed_at       := OLD.reviewed_at;
    NEW.reviewed_by       := OLD.reviewed_by;
    NEW.review_notes      := OLD.review_notes;
    NEW.waitlist_position := OLD.waitlist_position;
    NEW.submitted_at      := OLD.submitted_at;

    -- The one status transition an applicant owns.
    IF NOT (OLD.application_status = 'draft' AND NEW.application_status = 'submitted') THEN
        NEW.application_status := OLD.application_status;
    END IF;

    RETURN NEW;
END $$;

-- Recreate the trigger so a fresh database that only ever runs 005 still has it.
DROP TRIGGER IF EXISTS circles_guard_privileged_columns ON public.circles;
CREATE TRIGGER circles_guard_privileged_columns
    BEFORE UPDATE ON public.circles
    FOR EACH ROW EXECUTE FUNCTION public.circles_guard_privileged_columns();


-- ---------------------------------------------------------------------------
-- 5. Circle indexes — the two orderings every screen actually asks for
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_circles_queue
    ON public.circles(event_id, application_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circles_catalog_filter
    ON public.circles(event_id, rating, genre);
CREATE INDEX IF NOT EXISTS idx_circles_sort_key
    ON public.circles(event_id, circle_name_sort_key);

COMMENT ON COLUMN public.circles.circle_name_sort_key IS
    'Derived by circles_stamp_lifecycle from circle_name_furigana (falling back to circle_name), katakana folded to hiragana. Order catalogs by this, never by circle_name.';


-- ---------------------------------------------------------------------------
-- 6. staff_tasks
--
--    assigned_to is a uuid[] with a GIN index rather than a join table. At one
--    event's scale a join table buys nothing and costs a round trip on every
--    read; `auth.uid() = ANY(assigned_to)` is directly expressible in a policy.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.staff_tasks (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title        text NOT NULL,
    description  text,
    category     text NOT NULL DEFAULT 'operations' CHECK (category IN (
                     'setup', 'operations', 'security', 'customer_service',
                     'cleanup', 'emergency')),
    priority     text NOT NULL DEFAULT 'medium' CHECK (priority IN (
                     'low', 'medium', 'high', 'critical')),
    status       text NOT NULL DEFAULT 'pending' CHECK (status IN (
                     'pending', 'in_progress', 'completed', 'cancelled')),
    due_at       timestamptz,
    location     text,
    assigned_to  uuid[] NOT NULL DEFAULT '{}',
    created_by   uuid REFERENCES auth.users(id),
    completed_at timestamptz,
    completed_by uuid REFERENCES auth.users(id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_tasks_event    ON public.staff_tasks(event_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned ON public.staff_tasks USING gin (assigned_to);

ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON public.staff_tasks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.staff_tasks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS staff_tasks_select ON public.staff_tasks;
CREATE POLICY staff_tasks_select ON public.staff_tasks
    FOR SELECT TO authenticated
    USING (public.is_event_staff(event_id));

DROP POLICY IF EXISTS staff_tasks_write_organizer ON public.staff_tasks;
CREATE POLICY staff_tasks_write_organizer ON public.staff_tasks
    FOR ALL TO authenticated
    USING      (public.is_event_organizer(event_id))
    WITH CHECK (public.is_event_organizer(event_id));

-- ponytail: an assignee can edit any column of their own task, not just move it
-- to `completed`. Column-level REVOKE cannot express "only status" here because
-- organizers are `authenticated` too and would lose the task editor. Upgrade path
-- is a BEFORE UPDATE guard shaped like circles_guard_privileged_columns. Left as
-- is: this is an intra-team surface, not a trust boundary.
DROP POLICY IF EXISTS staff_tasks_update_assignee ON public.staff_tasks;
CREATE POLICY staff_tasks_update_assignee ON public.staff_tasks
    FOR UPDATE TO authenticated
    USING      ((SELECT auth.uid()) = ANY (assigned_to))
    WITH CHECK ((SELECT auth.uid()) = ANY (assigned_to));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_tasks TO authenticated;


-- ---------------------------------------------------------------------------
-- 7. announcements
--
--    title/body are jsonb keyed {en, ja, id}. One row per announcement, no
--    translation join table: the three locales are a fixed set, and a join table
--    turns every read into a fan-in the composer then has to reassemble.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.announcements (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title      jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(title) = 'object'),
    body       jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(body)  = 'object'),
    severity   text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    audience   text[] NOT NULL DEFAULT '{public}'
                   CHECK (audience <@ ARRAY['public', 'circle', 'staff', 'attendee']),
    status     text NOT NULL DEFAULT 'draft' CHECK (status IN (
                   'draft', 'scheduled', 'published', 'archived')),
    publish_at timestamptz,
    expires_at timestamptz,
    pinned     boolean NOT NULL DEFAULT false,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_event
    ON public.announcements(event_id, status, pinned DESC, publish_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON public.announcements;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.announcements
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- anon holds no EXECUTE on the 002 helpers, so its policy calls none (002 §3).
DROP POLICY IF EXISTS announcements_select_public ON public.announcements;
CREATE POLICY announcements_select_public ON public.announcements
    FOR SELECT TO anon
    USING (
        status = 'published'
        AND 'public' = ANY (audience)
        AND (expires_at IS NULL OR expires_at > now())
        AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft')
    );

DROP POLICY IF EXISTS announcements_select_auth ON public.announcements;
CREATE POLICY announcements_select_auth ON public.announcements
    FOR SELECT TO authenticated
    USING (
        (status = 'published' AND (expires_at IS NULL OR expires_at > now()))
        OR public.is_event_staff(event_id)
    );

DROP POLICY IF EXISTS announcements_write_organizer ON public.announcements;
CREATE POLICY announcements_write_organizer ON public.announcements
    FOR ALL TO authenticated
    USING      (public.is_event_organizer(event_id))
    WITH CHECK (public.is_event_organizer(event_id));

GRANT SELECT                         ON public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;


-- ---------------------------------------------------------------------------
-- 8. notifications
--
--    Per-user inbox. There is deliberately **no INSERT policy and no INSERT
--    grant**: with one, any authenticated account could post into any other
--    account's inbox. Rows arrive only from the fan-out trigger below (and from
--    future SECURITY DEFINER writers).
--
--    title/body are jsonb like announcements rather than the plain text PLAN.md
--    lists. The fan-out would otherwise have to pick a locale per recipient at
--    write time, freezing the text in whatever language they preferred that day.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    category        text NOT NULL DEFAULT 'announcement' CHECK (category IN (
                        'announcement', 'application', 'payment', 'booth',
                        'ticket', 'task', 'system')),
    title           jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(title) = 'object'),
    body            jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(body)  = 'object'),
    data            jsonb NOT NULL DEFAULT '{}'::jsonb,
    announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
    read_at         timestamptz,
    archived_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- The inbox badge query. Partial, because the unread set is the only one that is
-- read on every page load.
CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON public.notifications(user_id, created_at DESC)
    WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON public.notifications(user_id, created_at DESC);

-- Re-publishing an announcement must not re-deliver it.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_per_announcement
    ON public.notifications(user_id, announcement_id)
    WHERE announcement_id IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON public.notifications;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS notifications_select_self ON public.notifications;
CREATE POLICY notifications_select_self ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notifications_update_self ON public.notifications;
CREATE POLICY notifications_update_self ON public.notifications
    FOR UPDATE TO authenticated
    USING      (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notifications_delete_self ON public.notifications;
CREATE POLICY notifications_delete_self ON public.notifications
    FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Column grants are the native way to say "you may mark it read and nothing
-- else". Unlike the profiles/tickets cases in 002 and 004 there is no organizer
-- path through this table, so a role-wide column grant collaterally blocks
-- nobody. `updated_at` is written by the trigger, which is not subject to the
-- statement's column privileges.
REVOKE ALL ON public.notifications FROM authenticated, anon;
GRANT SELECT, DELETE ON public.notifications TO authenticated;
GRANT UPDATE (read_at, archived_at) ON public.notifications TO authenticated;


-- Fan-out. The only writer of notifications in this migration.
--
-- `FROM public.staff` appears here inside a FUNCTION BODY, which the 002 hard
-- rule permits — the rule bans it inside CREATE POLICY, where it recurses.
CREATE OR REPLACE FUNCTION public.announcements_fan_out()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.notifications (user_id, event_id, category, title, body, announcement_id, data)
    SELECT DISTINCT u.user_id, NEW.event_id, 'announcement', NEW.title, NEW.body, NEW.id,
           jsonb_build_object('severity', NEW.severity, 'pinned', NEW.pinned)
    FROM (
        SELECT s.user_id FROM public.staff s
         WHERE s.event_id = NEW.event_id AND s.status = 'active'
           AND 'staff' = ANY (NEW.audience)
        UNION
        SELECT c.user_id FROM public.circles c
         WHERE c.event_id = NEW.event_id AND c.application_status = 'accepted'
           AND 'circle' = ANY (NEW.audience)
        UNION
        SELECT tp.user_id FROM public.ticket_purchases tp
         WHERE tp.event_id = NEW.event_id AND tp.payment_status = 'paid'
           AND 'attendee' = ANY (NEW.audience)
    ) u
    WHERE u.user_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    RETURN NULL;
END $$;

-- `public` audience deliberately produces no inbox rows: it is shown on the
-- announcements page to everyone including anon, and fanning it out would post a
-- row per attendee for something they can already see.
--
-- ponytail: synchronous fan-out inside the organizer's UPDATE. A 5,000-attendee
-- event makes "Publish" take a second or two. Upgrade path is pg_cron or an edge
-- function draining a queue table; not built, because the alternative costs a
-- worker and this is one statement.
DROP TRIGGER IF EXISTS announcements_fan_out ON public.announcements;
CREATE TRIGGER announcements_fan_out
    AFTER INSERT OR UPDATE ON public.announcements
    FOR EACH ROW
    WHEN (NEW.status = 'published')
    EXECUTE FUNCTION public.announcements_fan_out();

REVOKE EXECUTE ON FUNCTION public.announcements_fan_out() FROM public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 9. event_schedule
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_schedule (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title       jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(title) = 'object'),
    description jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(description) = 'object'),
    starts_at   timestamptz NOT NULL,
    ends_at     timestamptz,
    location    text,
    track       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_event_schedule_time ON public.event_schedule(event_id, starts_at);

ALTER TABLE public.event_schedule ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON public.event_schedule;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.event_schedule
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS event_schedule_select_public ON public.event_schedule;
CREATE POLICY event_schedule_select_public ON public.event_schedule
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft'));

DROP POLICY IF EXISTS event_schedule_select_auth ON public.event_schedule;
CREATE POLICY event_schedule_select_auth ON public.event_schedule
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft')
        OR public.is_event_staff(event_id)
    );

DROP POLICY IF EXISTS event_schedule_write_organizer ON public.event_schedule;
CREATE POLICY event_schedule_write_organizer ON public.event_schedule
    FOR ALL TO authenticated
    USING      (public.is_event_organizer(event_id))
    WITH CHECK (public.is_event_organizer(event_id));

GRANT SELECT                         ON public.event_schedule TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_schedule TO authenticated;


-- ---------------------------------------------------------------------------
-- 10. queues — live wait times, written by staff, read by everyone
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.queues (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id             uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name                 text NOT NULL,
    location             text,
    type                 text NOT NULL DEFAULT 'entry' CHECK (type IN (
                             'entry', 'circle', 'merchandise', 'food', 'service')),
    capacity             int,
    status               text NOT NULL DEFAULT 'open' CHECK (status IN (
                             'open', 'paused', 'closed')),
    current_length       int NOT NULL DEFAULT 0 CHECK (current_length >= 0),
    current_wait_minutes int NOT NULL DEFAULT 0 CHECK (current_wait_minutes >= 0),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queues_event ON public.queues(event_id, status);

ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON public.queues;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.queues
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS queues_select_public ON public.queues;
CREATE POLICY queues_select_public ON public.queues
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft'));

DROP POLICY IF EXISTS queues_select_auth ON public.queues;
CREATE POLICY queues_select_auth ON public.queues
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft')
        OR public.is_event_staff(event_id)
    );

-- Any active staffer updates a queue length; that is the job at the door. Only an
-- organizer creates or removes one.
DROP POLICY IF EXISTS queues_update_staff ON public.queues;
CREATE POLICY queues_update_staff ON public.queues
    FOR UPDATE TO authenticated
    USING      (public.is_event_staff(event_id))
    WITH CHECK (public.is_event_staff(event_id));

DROP POLICY IF EXISTS queues_insert_organizer ON public.queues;
CREATE POLICY queues_insert_organizer ON public.queues
    FOR INSERT TO authenticated
    WITH CHECK (public.is_event_organizer(event_id));

DROP POLICY IF EXISTS queues_delete_organizer ON public.queues;
CREATE POLICY queues_delete_organizer ON public.queues
    FOR DELETE TO authenticated
    USING (public.is_event_organizer(event_id));

GRANT SELECT                         ON public.queues TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.queues TO authenticated;


-- ---------------------------------------------------------------------------
-- 11. event_counters — one row per event, and the reason it exists
--
--     At doors-open a raw INSERT subscription on ticket_scans fans thousands of
--     realtime messages to every organizer phone on venue wifi — O(scans × clients).
--     One counter row is O(clients). The dashboard and QueueStatus subscribe here.
--
--     ponytail: one counter row per event, no per-gate breakdown, and every
--     admitted scan takes a row lock on it. At convention scan rates that is
--     nothing; if organizers ever need per-door numbers or the row becomes hot,
--     split the PK to (event_id, gate_id) and sum on read.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_counters (
    event_id       uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    admitted_count int NOT NULL DEFAULT 0,
    queue_total    int NOT NULL DEFAULT 0,
    updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_counters_select_staff ON public.event_counters;
CREATE POLICY event_counters_select_staff ON public.event_counters
    FOR SELECT TO authenticated
    USING (public.is_event_staff(event_id));

-- No write policy and no write grant: both counters are trigger-derived.
REVOKE ALL ON public.event_counters FROM authenticated, anon;
GRANT SELECT ON public.event_counters TO authenticated;

-- Seed a row per existing event so a subscriber has something to attach to.
INSERT INTO public.event_counters (event_id)
SELECT e.id FROM public.events e
ON CONFLICT (event_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bump_event_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- `reentry` scans are excluded on purpose: they resolve to result='admitted'
    -- too, and counting them would inflate the headcount every time somebody
    -- steps out for lunch. This mirrors one_admission_per_pass (003), which is
    -- also scoped to scan_type='entry'.
    IF NEW.result = 'admitted' AND NEW.scan_type = 'entry' THEN
        INSERT INTO public.event_counters (event_id, admitted_count, updated_at)
        VALUES (NEW.event_id, 1, now())
        ON CONFLICT (event_id) DO UPDATE
            SET admitted_count = event_counters.admitted_count + 1,
                updated_at     = now();
    END IF;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS bump_event_counter ON public.ticket_scans;
CREATE TRIGGER bump_event_counter
    AFTER INSERT ON public.ticket_scans
    FOR EACH ROW EXECUTE FUNCTION public.bump_event_counter();

REVOKE EXECUTE ON FUNCTION public.bump_event_counter() FROM public, anon, authenticated;

-- queue_total is the same idea for the other number on the dashboard: recomputed
-- from `queues` rather than incremented, because a queue length is set to an
-- absolute value by a staffer, not nudged.
CREATE OR REPLACE FUNCTION public.roll_up_queue_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_event uuid := coalesce(NEW.event_id, OLD.event_id);
BEGIN
    INSERT INTO public.event_counters (event_id, queue_total, updated_at)
    VALUES (
        v_event,
        (SELECT coalesce(sum(q.current_length), 0)
           FROM public.queues q
          WHERE q.event_id = v_event AND q.status = 'open'),
        now())
    ON CONFLICT (event_id) DO UPDATE
        SET queue_total = excluded.queue_total,
            updated_at  = now();
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS roll_up_queue_total ON public.queues;
CREATE TRIGGER roll_up_queue_total
    AFTER INSERT OR UPDATE OR DELETE ON public.queues
    FOR EACH ROW EXECUTE FUNCTION public.roll_up_queue_total();

REVOKE EXECUTE ON FUNCTION public.roll_up_queue_total() FROM public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 12. Realtime
--
--     Realtime is opt-in per table and this is the step that gets forgotten —
--     the subscription simply never fires and the screen looks merely stale.
--     Each ALTER is its own DO block: one already-published table must not stop
--     the rest.
--
--     REPLICA IDENTITY FULL is what makes a filtered subscription on a non-PK
--     column (`event_id=eq.…`, `user_id=eq.…`) work on UPDATE and DELETE — the
--     default REPLICA IDENTITY only ships the primary key in the old tuple.
--     event_counters is keyed by event_id already, so it does not need it.
--
--     ponytail: FULL logs the entire old row to WAL on every UPDATE. On `circles`
--     (wide, with a text[] and a jsonb neighbour) that is the largest write
--     amplification in this schema. Upgrade path if WAL volume ever matters: drop
--     FULL on circles and have the client subscribe unfiltered per event channel.
-- ---------------------------------------------------------------------------

-- Spelled out one statement per table rather than looped, so that
-- `rg 'ALTER PUBLICATION supabase_realtime' supabase/migrations/` shows a reader
-- exactly which tables are live without expanding an array.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.queues;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.circles;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.booths;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_counters;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.queues        REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.announcements REPLICA IDENTITY FULL;
ALTER TABLE public.circles       REPLICA IDENTITY FULL;
ALTER TABLE public.booths        REPLICA IDENTITY FULL;
-- event_counters is keyed by event_id, so the default replica identity already
-- ships the column a filtered subscription needs.

COMMIT;
