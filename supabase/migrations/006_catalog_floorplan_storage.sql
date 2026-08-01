-- 006_catalog_floorplan_storage.sql
-- DoujinDesk — the public catalog surface, database-arbitrated booth collision,
-- and two storage buckets that actually enforce their own limits.
--
-- WHY THIS MIGRATION EXISTS
--   1. The catalog is public. `circles` is not: that row carries `email`, `phone`,
--      `address`, `emergency_contact_name`, `emergency_contact_phone` and the
--      co-representative's contact details. A permissive public SELECT policy on
--      `circles` would publish every one of them. A projected view is the fix, and
--      **the projection is the access control** — see the COMMENT below.
--   2. Nothing stops one circle from holding two booths, and nothing stops two
--      booths from occupying the same square metre. Collision detection written in
--      the editor is advisory; two organizers on two laptops both pass it.
--   3. The 5MB check in the application form is client-side, so it is bypassed by
--      one `curl`. A `file_size_limit` on the bucket row is not.
--
-- Depends on 002 (helpers), 005 (`circle_name_sort_key`, the per-event
-- `circle_code` unique). Never edits 001. Written and committed, NOT applied —
-- see supabase/migrations/README.md.
--
-- NOTE FOR THE OWNER: section 4 writes to the `storage` schema. If `supabase db
-- push` reports `permission denied for schema storage`, run that section alone
-- from the dashboard SQL editor, which connects with the required ownership.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Preflight — the two new booth constraints can fail on existing data
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    n_dup int;
    n_overlap int;
BEGIN
    IF to_regclass('public.circles') IS NULL THEN
        RAISE EXCEPTION 'public.circles is missing. Apply 001 → 005 before 006.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'circles'
          AND column_name = 'circle_name_sort_key'
    ) THEN
        RAISE EXCEPTION
            'public.circles.circle_name_sort_key is missing. Apply 005_operations.sql before 006 — circle_catalog projects it.';
    END IF;

    SELECT count(*) INTO n_dup FROM (
        SELECT circle_id FROM public.booths
         WHERE circle_id IS NOT NULL
         GROUP BY circle_id HAVING count(*) > 1
    ) d;

    IF n_dup > 0 THEN
        RAISE EXCEPTION
            '% circle(s) are allocated more than one booth. Clear the extra booths (set circle_id = NULL) and re-run 006.',
            n_dup;
    END IF;

    SELECT count(*) INTO n_overlap
      FROM public.booths a
      JOIN public.booths b
        ON b.id <> a.id
       AND b.event_id = a.event_id
       AND b.floor_level IS NOT DISTINCT FROM a.floor_level
       AND a.position_x IS NOT NULL AND a.position_y IS NOT NULL
       AND a.size_width IS NOT NULL AND a.size_height IS NOT NULL
       AND b.position_x IS NOT NULL AND b.position_y IS NOT NULL
       AND b.size_width IS NOT NULL AND b.size_height IS NOT NULL
       AND a.position_x + 0.01 < b.position_x + b.size_width  - 0.01
       AND b.position_x + 0.01 < a.position_x + a.size_width  - 0.01
       AND a.position_y + 0.01 < b.position_y + b.size_height - 0.01
       AND b.position_y + 0.01 < a.position_y + a.size_height - 0.01;

    IF n_overlap > 0 THEN
        RAISE EXCEPTION
            '% overlapping booth pair(s) already exist on the floor plan. Separate them and re-run 006 — the exclusion constraint cannot be added while they overlap.',
            n_overlap;
    END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 1. public.circle_catalog — the only circle data anon ever sees
--
--    security_invoker = false (the default, stated for the reader): the view runs
--    as its owner and therefore reads past `circles`' owner-scoped RLS. That is
--    the entire point — anon has no policy on `circles` and never gets one.
--    security_barrier = true stops a caller from pushing a cheap, leaky function
--    into the WHERE clause and having it evaluated before the filters below.
--
--    booth_number comes from `booths.circle_id`, not from `circles.booth_number`.
--    One source of truth; `one_booth_per_circle` below is what makes the LEFT JOIN
--    single-valued.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.circle_catalog;
CREATE VIEW public.circle_catalog
WITH (security_invoker = false, security_barrier = true) AS
SELECT
    c.id,
    c.event_id,
    c.circle_code,
    c.circle_name,
    c.circle_name_furigana,
    c.circle_name_sort_key,
    c.pen_name,
    c.fandom,
    c.genre,
    c.rating,
    c.product_types,
    c.description,
    c.works_description,
    c.circle_cut_file_url,
    c.sample_works_images,
    c.social_media_twitter,
    c.social_media_pixiv,
    c.social_media_website,
    c.social_media_instagram,
    c.marketplace_link,
    b.booth_number
FROM public.circles c
JOIN public.events e ON e.id = c.event_id
LEFT JOIN public.booths b ON b.circle_id = c.id
WHERE c.application_status = 'accepted'
  AND e.status <> 'draft';

COMMENT ON VIEW public.circle_catalog IS
    'Public circle catalog. THE COLUMN LIST IS THE ACCESS CONTROL. This view runs as its owner and reads past circles RLS, so anon sees exactly what is projected here and nothing else. Never write SELECT * into this view, and never add email, phone, address, postal_code, country, co_rep_name, co_rep_email, co_rep_phone, emergency_contact_name, emergency_contact_phone, notes, review_notes, total_amount or payment_status. description and works_description are circle-authored catalog copy and are intentionally public.';

GRANT SELECT ON public.circle_catalog TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. Floor plan — geometry the database arbitrates
-- ---------------------------------------------------------------------------

-- btree_gist lets a gist index carry plain-equality columns (uuid, int) alongside
-- the geometric one, which is what makes "same event, same floor, overlapping box"
-- expressible as a single constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.booths
    ADD COLUMN IF NOT EXISTS rotation numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS label    text;

ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS floor_plan jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.events.floor_plan IS
    'Canvas dimensions, background image and grid settings for the floor-plan editor. One editor does not need a floor_plans table.';

-- The server half of collision detection, part one: a circle holds at most one
-- booth. Partial so unallocated booths (circle_id IS NULL) do not collide.
CREATE UNIQUE INDEX IF NOT EXISTS one_booth_per_circle
    ON public.booths (circle_id)
    WHERE circle_id IS NOT NULL;

-- Part two: geometric overlap is rejected by the database, and the editor merely
-- surfaces the 23P01 it gets back. Two organizers on two laptops cannot both pass
-- a client-side check and both win.
--
-- The 0.01 inset is deliberate and load-bearing. `box && box` treats boxes that
-- merely touch as overlapping, and convention floor plans are laid out edge to
-- edge — without the inset, placing A-02 flush against A-01 would be rejected and
-- the constraint would be unusable. Coordinates are numeric(8,2), so 0.01 is one
-- representable unit: two booths must genuinely interpenetrate to be refused.
--
-- Any NULL among position/size yields a NULL box, and an exclusion constraint
-- ignores NULL keys — so a booth that has not been placed on the canvas yet is
-- exempt, which is what an editor needs.
ALTER TABLE public.booths DROP CONSTRAINT IF EXISTS booths_no_overlap;
ALTER TABLE public.booths ADD  CONSTRAINT booths_no_overlap
    EXCLUDE USING gist (
        event_id    WITH =,
        floor_level WITH =,
        box(
            point((position_x + 0.01)::float8,               (position_y + 0.01)::float8),
            point((position_x + size_width - 0.01)::float8,  (position_y + size_height - 0.01)::float8)
        ) WITH &&
    );

-- `booths.circle_id` is now the single source of truth for allocation.
COMMENT ON COLUMN public.circles.booth_number IS
    'DEPRECATED as a writable field. booths.circle_id is the single source of truth for allocation; read the allocated number from public.circle_catalog.booth_number. Kept only so pre-005 rows are not lost.';

COMMENT ON CONSTRAINT booths_no_overlap ON public.booths IS
    'Rejects two booths sharing floor space on the same floor of the same event with SQLSTATE 23P01. The floor-plan editor should surface that error, not re-implement the check.';


-- ---------------------------------------------------------------------------
-- 3. Storage buckets
--
--    Two buckets, not one. `circle-public` feeds the catalog and is world
--    readable; `circle-private` holds anything with PII in it and is reachable
--    only through a signed URL. Splitting them at the bucket boundary means the
--    public/private decision is made once, by the upload path, instead of by a
--    policy that has to be right on every object.
--
--    file_size_limit and allowed_mime_types live on the bucket row because the
--    form's 5MB / image-only check runs in the browser and is bypassed by one
--    curl against the same endpoint.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('circle-public',  'circle-public',  true,  5242880,
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
    ('circle-private', 'circle-private', false, 10485760,
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
    SET public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- 4. storage.objects policies — the owner-folder pattern
--
--    Object key layout is `${auth.uid()}/${uuid}.${ext}`. The first path segment
--    is the owner, so `(storage.foldername(name))[1] = auth.uid()::text` is the
--    whole ownership test and it needs no extra table.
--
--    P11 changes the form's upload path from `sample-works/<random>` to this
--    layout. Both halves are required: without the policies every upload 403s,
--    without the path change anyone can overwrite another circle's artwork.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS circle_public_read     ON storage.objects;
DROP POLICY IF EXISTS circle_public_insert   ON storage.objects;
DROP POLICY IF EXISTS circle_public_update   ON storage.objects;
DROP POLICY IF EXISTS circle_public_delete   ON storage.objects;
DROP POLICY IF EXISTS circle_private_select  ON storage.objects;
DROP POLICY IF EXISTS circle_private_insert  ON storage.objects;
DROP POLICY IF EXISTS circle_private_update  ON storage.objects;
DROP POLICY IF EXISTS circle_private_delete  ON storage.objects;

-- circle-public: world readable, owner writable.
CREATE POLICY circle_public_read ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'circle-public');

CREATE POLICY circle_public_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'circle-public'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY circle_public_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'circle-public'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    )
    WITH CHECK (
        bucket_id = 'circle-public'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY circle_public_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'circle-public'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

-- circle-private: owner only, in every verb including SELECT. anon gets nothing,
-- so a signed URL is the only way in.
--
-- ponytail: an organizer reviewing an application cannot read the applicant's
-- private files from the browser — there is no cheap way to prove "organizer of
-- the event this object belongs to" from an object key alone. Nothing writes to
-- this bucket yet, so nothing is blocked today. Upgrade path when something does:
-- key objects as `${event_id}/${uid}/${file}` and add
-- `public.is_event_organizer(((storage.foldername(name))[1])::uuid)` as a second
-- SELECT policy.
CREATE POLICY circle_private_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'circle-private'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY circle_private_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'circle-private'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY circle_private_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'circle-private'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    )
    WITH CHECK (
        bucket_id = 'circle-private'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY circle_private_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'circle-private'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

COMMIT;
