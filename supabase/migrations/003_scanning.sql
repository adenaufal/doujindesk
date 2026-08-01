-- 003_scanning.sql
-- DoujinDesk — the scan contract: one pass per admitted person, an append-only
-- scan log, and an idempotent redemption RPC.
--
-- WHY THIS MIGRATION EXISTS
-- 001 hangs a single nullable `check_in_time` on the *order* (ticket_purchases).
-- An order for five people therefore admits either once or unlimited times; there
-- is no correct middle without a row per admitted person. `ticket_passes` is that
-- row, and it is the one place in this plan where an extra table is not
-- over-engineering.
--
-- Two constraints below carry the entire offline story. Everything the scanner UI
-- and the Dexie queue do is a presentation of them:
--   1. UNIQUE (client_scan_id)      → replaying the IndexedDB queue is idempotent.
--   2. one_admission_per_pass       → double admission is impossible in the
--                                     database, not in application logic.
-- Success criterion 3 ("a ticket already used offline is rejected on sync with a
-- visible conflict, never a silent double-admit") is enforced by (2). The 23505
-- it raises IS the conflict; redeem_tickets turns it into a `duplicate` row that
-- names the device, gate and time of the winning scan.
--
-- 001 is never edited. Depends on 002 (public.is_event_staff, events.timezone).
-- Written and committed, NOT applied — see supabase/migrations/README.md.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ticket_passes — one scannable pass per admitted person
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_passes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id uuid NOT NULL REFERENCES public.ticket_purchases(id) ON DELETE CASCADE,
    event_id    uuid NOT NULL REFERENCES public.events(id),
    -- Opaque. Carries no row id and no PII, unlike today's
    -- `QR_${purchaseId}_${Date.now()}`, which is guessable from one leaked code
    -- and hands the scanner a primary key it has no business trusting.
    qr_token    uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    holder_name text,
    tier_id     uuid REFERENCES public.tickets(id),
    valid_from  timestamptz,
    valid_until timestamptz,
    revoked_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_passes_event_id    ON public.ticket_passes(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_passes_purchase_id ON public.ticket_passes(purchase_id);


-- ---------------------------------------------------------------------------
-- 2. ticket_scans — append-only log of every scan, including the failures
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_scans (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id       uuid NOT NULL REFERENCES public.events(id),
    -- Nullable on purpose: an unknown code still gets logged. A gate that reads
    -- nothing and a gate that reads garbage look identical without this.
    pass_id        uuid REFERENCES public.ticket_passes(id),
    scanned_code   text NOT NULL,
    scan_type      text NOT NULL DEFAULT 'entry' CHECK (scan_type IN ('entry', 'exit', 'reentry')),
    result         text NOT NULL CHECK (result IN (
                       'admitted', 'duplicate', 'not_found', 'unpaid',
                       'revoked', 'wrong_event', 'outside_window')),
    gate_id        text,
    device_id      text NOT NULL,
    scanned_by     uuid REFERENCES auth.users(id),
    scanned_at     timestamptz NOT NULL,                  -- device clock, at scan time
    synced_at      timestamptz NOT NULL DEFAULT now(),    -- server clock, at upload
    offline        boolean NOT NULL DEFAULT false,
    client_scan_id uuid NOT NULL,
    conflict_with  uuid REFERENCES public.ticket_scans(id)
);

-- (1) Idempotent replay. Flaky venue wifi retrying the same batch four times
--     produces one row, not four, and redeem_tickets returns the stored answer.
ALTER TABLE public.ticket_scans DROP CONSTRAINT IF EXISTS ticket_scans_client_scan_id_key;
ALTER TABLE public.ticket_scans ADD  CONSTRAINT ticket_scans_client_scan_id_key UNIQUE (client_scan_id);

-- (2) The whole offline guarantee. Two phones offline both admit pass X; on sync
--     the second INSERT raises 23505 and becomes a visible `duplicate`.
--
-- ponytail: this also blocks legitimate re-entry (wristband out-and-back), which
-- real conventions do. The upgrade path is the `reentry` scan_type, which sits
-- OUTSIDE this partial index and therefore already works. NEVER drop the index to
-- "fix" re-entry — that silently restores double-admission and criterion 3 fails
-- with no error anywhere.
CREATE UNIQUE INDEX IF NOT EXISTS one_admission_per_pass
    ON public.ticket_scans (pass_id)
    WHERE result = 'admitted' AND scan_type = 'entry';

CREATE INDEX IF NOT EXISTS idx_ticket_scans_event_time ON public.ticket_scans(event_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_pass       ON public.ticket_scans(pass_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_device     ON public.ticket_scans(device_id, synced_at);


-- ---------------------------------------------------------------------------
-- 3. The response shape, built in exactly one place
--
-- Seven keys, always all seven, nulls where they do not apply. The Dexie queue,
-- the scanner UI and the criterion-3 tests are all written against this object,
-- so a fresh scan and a replayed scan must be byte-identical — which they are,
-- because both go through here.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.scan_result_json(s public.ticket_scans)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'client_scan_id',         s.client_scan_id,
        'result',                 s.result,
        'scan_id',                s.id,
        'admitted_at',            CASE WHEN s.result = 'admitted' THEN s.scanned_at END,
        'conflicting_device',     (SELECT w.device_id  FROM public.ticket_scans w WHERE w.id = s.conflict_with),
        'conflicting_scanned_at', (SELECT w.scanned_at FROM public.ticket_scans w WHERE w.id = s.conflict_with),
        'conflicting_gate',       (SELECT w.gate_id    FROM public.ticket_scans w WHERE w.id = s.conflict_with)
    );
$$;


-- ---------------------------------------------------------------------------
-- 4. redeem_tickets — the only door into ticket_scans
--
-- Takes an array so an offline flush of 50 scans is one round trip on the worst
-- connection this app will ever see. Every item is authorised independently:
-- trusting the batch would let one forged item ride along on a legitimate one.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.redeem_tickets(p_scans jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_item        jsonb;
    v_out         jsonb := '[]'::jsonb;
    v_client_id   uuid;
    v_event_id    uuid;
    v_code        text;
    v_scanned_at  timestamptz;
    v_scan_type   text;
    v_offline     boolean;
    v_pass        public.ticket_passes;
    v_event       public.events;
    v_row         public.ticket_scans;
    v_win         public.ticket_scans;
    v_result      text;
    v_paid        boolean;
    v_valid_from  timestamptz;
    v_valid_until timestamptz;
BEGIN
    IF p_scans IS NULL OR jsonb_typeof(p_scans) <> 'array' THEN
        RAISE EXCEPTION 'redeem_tickets expects a JSON array of scans, got %',
            coalesce(jsonb_typeof(p_scans), 'null');
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_scans) LOOP
        v_client_id  := (v_item ->> 'client_scan_id')::uuid;
        v_event_id   := (v_item ->> 'event_id')::uuid;
        v_code       := v_item ->> 'qr_token';
        v_scanned_at := coalesce((v_item ->> 'scanned_at')::timestamptz, now());
        v_scan_type  := coalesce(v_item ->> 'scan_type', 'entry');
        v_offline    := coalesce((v_item ->> 'offline')::boolean, false);

        IF v_client_id IS NULL OR v_event_id IS NULL OR v_code IS NULL
           OR coalesce(v_item ->> 'device_id', '') = '' THEN
            RAISE EXCEPTION
                'each scan needs client_scan_id, event_id, qr_token and device_id';
        END IF;

        -- Authority. A scanner-role staffer is allowed here; anyone else is not.
        -- Raising aborts the whole batch on purpose: a caller who is not staff for
        -- this event gets nothing, not a partially-honoured queue.
        IF NOT public.is_event_staff(v_event_id) THEN
            RAISE EXCEPTION 'not authorised to scan for event %', v_event_id
                USING ERRCODE = '42501';
        END IF;

        -- Replay fast path.
        SELECT * INTO v_row FROM public.ticket_scans t WHERE t.client_scan_id = v_client_id;
        IF FOUND THEN
            v_out := v_out || public.scan_result_json(v_row);
            CONTINUE;
        END IF;

        -- Manual entry means a human types the code, so the cast can fail. A typo
        -- is not_found, not a 500 that kills the other 49 scans in the batch.
        BEGIN
            SELECT * INTO v_pass FROM public.ticket_passes p WHERE p.qr_token = v_code::uuid;
        EXCEPTION WHEN invalid_text_representation THEN
            v_pass := NULL;
        END;

        IF v_pass.id IS NULL THEN
            v_result := 'not_found';
        ELSIF v_pass.event_id <> v_event_id THEN
            v_result := 'wrong_event';
        ELSIF v_pass.revoked_at IS NOT NULL THEN
            v_result := 'revoked';
        ELSE
            -- Lock the parent order so a concurrent refund cannot land between the
            -- paid check and the admission.
            SELECT (tp.payment_status = 'paid') INTO v_paid
              FROM public.ticket_purchases tp
             WHERE tp.id = v_pass.purchase_id
               FOR UPDATE;

            SELECT * INTO v_event FROM public.events e WHERE e.id = v_pass.event_id;

            -- Window, evaluated in the event's own timezone. Without this a Tokyo
            -- organizer and a Jakarta scanner disagree about which day it is, and
            -- the first scan of day 2 is rejected for nine hours.
            v_valid_from := coalesce(
                v_pass.valid_from,
                date_trunc('day', v_event.start_date AT TIME ZONE v_event.timezone)
                    AT TIME ZONE v_event.timezone);
            v_valid_until := coalesce(
                v_pass.valid_until,
                (date_trunc('day', v_event.end_date AT TIME ZONE v_event.timezone)
                    + interval '1 day') AT TIME ZONE v_event.timezone);

            IF NOT coalesce(v_paid, false) THEN
                v_result := 'unpaid';
            ELSIF v_scanned_at < v_valid_from OR v_scanned_at >= v_valid_until THEN
                v_result := 'outside_window';
            ELSE
                v_result := 'admitted';
            END IF;
        END IF;

        BEGIN
            INSERT INTO public.ticket_scans (
                event_id, pass_id, scanned_code, scan_type, result,
                gate_id, device_id, scanned_by, scanned_at, offline, client_scan_id)
            VALUES (
                v_event_id, v_pass.id, v_code, v_scan_type, v_result,
                v_item ->> 'gate_id', v_item ->> 'device_id', (SELECT auth.uid()),
                v_scanned_at, v_offline, v_client_id)
            RETURNING * INTO v_row;
        EXCEPTION WHEN unique_violation THEN
            -- Two ways to get here. Distinguish by looking, not by constraint name:
            -- index names are the kind of thing a later migration renames.
            SELECT * INTO v_row FROM public.ticket_scans t WHERE t.client_scan_id = v_client_id;

            IF NOT FOUND THEN
                -- one_admission_per_pass. This pass was already admitted, by this
                -- device before an app restart or by another phone entirely. Log
                -- the attempt as a duplicate pointing at the scan that won.
                SELECT * INTO v_win
                  FROM public.ticket_scans w
                 WHERE w.pass_id = v_pass.id
                   AND w.result = 'admitted'
                   AND w.scan_type = 'entry'
                 LIMIT 1;

                BEGIN
                    INSERT INTO public.ticket_scans (
                        event_id, pass_id, scanned_code, scan_type, result,
                        gate_id, device_id, scanned_by, scanned_at, offline,
                        client_scan_id, conflict_with)
                    VALUES (
                        v_event_id, v_pass.id, v_code, v_scan_type, 'duplicate',
                        v_item ->> 'gate_id', v_item ->> 'device_id', (SELECT auth.uid()),
                        v_scanned_at, v_offline, v_client_id, v_win.id)
                    RETURNING * INTO v_row;
                EXCEPTION WHEN unique_violation THEN
                    -- Concurrent flush of the same queue (the `online` event and
                    -- app focus can both fire). Whoever landed first is the answer.
                    SELECT * INTO v_row FROM public.ticket_scans t
                     WHERE t.client_scan_id = v_client_id;
                END;
            END IF;
        END;

        v_out := v_out || public.scan_result_json(v_row);
    END LOOP;

    RETURN v_out;
END $$;


-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.ticket_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_scans  ENABLE ROW LEVEL SECURITY;

-- An attendee reads their own passes and nobody else's: qr_token IS the
-- credential, so a leaky SELECT here is a free ticket.
-- The ticket_purchases subquery is safe — that table's policies call helpers and
-- never name ticket_passes, so there is no cycle. And no predicate in this file
-- names public.staff directly; the 002 hard rule holds.
CREATE POLICY ticket_passes_select ON public.ticket_passes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.ticket_purchases tp
             WHERE tp.id = purchase_id AND tp.user_id = (SELECT auth.uid())
        )
        OR public.is_event_staff(event_id)
    );

-- No INSERT/UPDATE/DELETE policy: passes are minted by 004's purchase_tickets().

CREATE POLICY ticket_scans_select ON public.ticket_scans
    FOR SELECT TO authenticated
    USING (public.is_event_staff(event_id));

-- No write policy, and the grant is revoked as well. Without the REVOKE a
-- scanner-role staffer could INSERT a row with result='admitted' by hand and walk
-- someone past the door; the RPC is the only door precisely so the two unique
-- constraints above cannot be routed around.


-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.ticket_passes FROM authenticated, anon;
REVOKE ALL ON public.ticket_scans  FROM authenticated, anon;

GRANT SELECT ON public.ticket_passes TO authenticated;
GRANT SELECT ON public.ticket_scans  TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.ticket_scans  FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ticket_passes FROM authenticated, anon;

-- Supabase's default privileges grant EXECUTE on new functions to anon and
-- authenticated explicitly, so revoking from PUBLIC alone leaves them standing.
REVOKE EXECUTE ON FUNCTION public.redeem_tickets(jsonb)                  FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scan_result_json(public.ticket_scans)  FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.redeem_tickets(jsonb) TO authenticated;
-- scan_result_json stays private: redeem_tickets is SECURITY DEFINER and calls it
-- as the owner. Nothing else has a reason to.


-- ---------------------------------------------------------------------------
-- 7. Realtime — the live attendance counter and the organizer's conflict feed
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_scans;
EXCEPTION
    WHEN duplicate_object THEN NULL;   -- already published
    WHEN undefined_object THEN NULL;   -- no supabase_realtime publication (local psql)
END $$;

COMMIT;
