-- 004_money.sql
-- DoujinDesk — the money path: server-priced purchases, derived circle fees, and a
-- ledger the browser cannot write, cannot edit and cannot erase.
--
-- WHY THIS MIGRATION EXISTS (success criterion 4)
-- "Every circle payment and ticket sale writes an immutable transaction row, and
--  every total on screen derives from those rows."
--
-- Today none of that is true:
--   * The browser decides `payment_status = 'paid'` and sends its own
--     `total_amount`; nothing on the server disagrees.
--   * `financial_transactions.amount` is DECIMAL(10,2). That caps at 99,999,999.99.
--     In USD test data you never see it. The first real ticket batch priced in IDR
--     hits it — 1,200 tickets at Rp 150,000 is Rp 180,000,000 — and the INSERT
--     fails with `numeric field overflow` at the worst possible moment.
--   * Nothing stops an UPDATE or DELETE on the ledger.
--
-- The three mechanisms below, in order of how much they matter:
--   1. `financial_transactions_immutable()` — a BEFORE UPDATE OR DELETE trigger
--      that unconditionally raises. RLS does not constrain the table owner or the
--      service role; a trigger does. This is the only thing that makes "immutable"
--      a fact rather than an aspiration.
--   2. Ledger rows are INSERTed by AFTER UPDATE triggers on `circles` and
--      `ticket_purchases`, never by a client. There is no INSERT policy and no
--      INSERT grant for anon or authenticated.
--   3. `event_financial_summary` — a `security_invoker` view. The dashboard reads
--      this instead of pulling rows and reducing them in a component.
--
-- Depends on 002 (helpers, guards) and 003 (`ticket_passes`). Never edits 001.
-- Written and committed, NOT applied — see supabase/migrations/README.md.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Preflight
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF to_regclass('public.ticket_passes') IS NULL THEN
        RAISE EXCEPTION
            'public.ticket_passes is missing. Apply 003_scanning.sql before 004_money.sql — purchase_tickets() issues one pass per admitted person.';
    END IF;

    IF to_regprocedure('public.is_event_organizer(uuid)') IS NULL THEN
        RAISE EXCEPTION
            'public.is_event_organizer(uuid) is missing. Apply 002_identity_and_rls.sql before 004_money.sql.';
    END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 1. Ticket tiers — widen the money column, describe the sale, freeze inventory
-- ---------------------------------------------------------------------------

-- 001: price DECIMAL(10,2). Same overflow story as the ledger, one order of
-- magnitude closer: a Rp 100,000,000 VIP package is absurd, a Rp 250,000 ticket
-- is not — but the column type is shared with `total_amount` arithmetic, so widen
-- it here and keep every money column in this schema at numeric(12,2) or wider.
ALTER TABLE public.tickets ALTER COLUMN price TYPE numeric(12,2);

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS currency         text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS early_bird_price numeric(12,2);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS early_bird_end   timestamptz;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS age_restriction  text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS requires_id      boolean NOT NULL DEFAULT false;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS valid_from       timestamptz;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS valid_until      timestamptz;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS sort_order       int NOT NULL DEFAULT 0;

-- Currency is event-scoped. Backfill from the event, then make it required so no
-- tier can ever be sold in an unnamed currency.
UPDATE public.tickets t
   SET currency = e.currency
  FROM public.events e
 WHERE e.id = t.event_id
   AND t.currency IS NULL;

UPDATE public.tickets SET currency = 'IDR' WHERE currency IS NULL;

ALTER TABLE public.tickets ALTER COLUMN currency SET NOT NULL;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_currency_check;
ALTER TABLE public.tickets ADD  CONSTRAINT tickets_currency_check
    CHECK (currency IN ('IDR', 'USD'));

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_age_restriction_check;
ALTER TABLE public.tickets ADD  CONSTRAINT tickets_age_restriction_check
    CHECK (age_restriction IS NULL OR age_restriction IN ('all_ages', 'adult'));

-- The oversell invariant, stated once in the schema so no code path can violate
-- it. purchase_tickets() below relies on this being enforced, not merely checked.
UPDATE public.tickets SET quantity_sold = quantity_available
 WHERE quantity_sold > quantity_available;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_not_oversold;
ALTER TABLE public.tickets ADD  CONSTRAINT tickets_not_oversold
    CHECK (quantity_sold <= quantity_available);

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_early_bird_needs_end;
ALTER TABLE public.tickets ADD  CONSTRAINT tickets_early_bird_needs_end
    CHECK (early_bird_price IS NULL OR early_bird_end IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_tickets_event_sort ON public.tickets(event_id, sort_order);

-- Inventory is derived, not declared. `quantity_sold` moves only inside
-- purchase_tickets()'s oversell guard, which runs SECURITY DEFINER as the table
-- owner and is therefore unaffected by this grant. Postgres cannot subtract a
-- column from a table-wide UPDATE grant, so the table-wide grant is revoked and
-- re-issued per column — the same mechanism 002 used on profiles.role.
--
-- `price` is deliberately still grantable, which is a conscious departure from the
-- plan's `REVOKE UPDATE (quantity_sold, price)`. Column grants apply to every
-- `authenticated` role including organizers, so revoking price would leave the
-- organizer's tier editor with no door at all — while closing nothing: policy
-- `tickets_write_organizer` (002) already restricts every UPDATE on this table to
-- organizers, and purchase_tickets() reads the price out of this table server-side
-- so a client-supplied price is never trusted anywhere in the system.
REVOKE UPDATE ON public.tickets FROM authenticated;
GRANT  UPDATE (
    ticket_type, price, quantity_available, sale_start, sale_end, description,
    benefits, status, currency, early_bird_price, early_bird_end, age_restriction,
    requires_id, valid_from, valid_until, sort_order
) ON public.tickets TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. Orders
-- ---------------------------------------------------------------------------

-- Denormalised on purpose. The scanner, the RLS predicate and the ledger trigger
-- all need the event without a join through `tickets`; 002's ticket_purchases
-- SELECT policy says so in a comment and is replaced at the bottom of this file.
ALTER TABLE public.ticket_purchases ADD COLUMN IF NOT EXISTS event_id        uuid REFERENCES public.events(id);
ALTER TABLE public.ticket_purchases ADD COLUMN IF NOT EXISTS unit_price      numeric(12,2);
ALTER TABLE public.ticket_purchases ADD COLUMN IF NOT EXISTS currency        text;
ALTER TABLE public.ticket_purchases ADD COLUMN IF NOT EXISTS order_reference text;
ALTER TABLE public.ticket_purchases ADD COLUMN IF NOT EXISTS cancelled_at    timestamptz;
ALTER TABLE public.ticket_purchases ADD COLUMN IF NOT EXISTS refunded_at     timestamptz;

-- 001: total_amount DECIMAL(10,2). A 500-seat block at Rp 250,000 is Rp 125,000,000
-- and overflows. numeric(14,2) holds a whole convention's gate in rupiah.
ALTER TABLE public.ticket_purchases ALTER COLUMN total_amount TYPE numeric(14,2);

UPDATE public.ticket_purchases tp
   SET event_id = t.event_id,
       currency = coalesce(tp.currency, t.currency)
  FROM public.tickets t
 WHERE t.id = tp.ticket_id
   AND tp.event_id IS NULL;

-- Left nullable if (and only if) the backfill could not resolve an event, which
-- means an orphaned order row. SET NOT NULL would abort the whole migration on
-- one piece of demo junk; the RPC below always writes it.
DO $$
DECLARE n_orphan int;
BEGIN
    SELECT count(*) INTO n_orphan FROM public.ticket_purchases WHERE event_id IS NULL;
    IF n_orphan = 0 THEN
        ALTER TABLE public.ticket_purchases ALTER COLUMN event_id SET NOT NULL;
    ELSE
        RAISE WARNING
            'ticket_purchases.event_id left nullable: % row(s) reference a ticket tier that no longer exists. Clean them up and run: ALTER TABLE public.ticket_purchases ALTER COLUMN event_id SET NOT NULL;',
            n_orphan;
    END IF;
END $$;

ALTER TABLE public.ticket_purchases DROP CONSTRAINT IF EXISTS ticket_purchases_order_reference_key;
ALTER TABLE public.ticket_purchases ADD  CONSTRAINT ticket_purchases_order_reference_key UNIQUE (order_reference);

ALTER TABLE public.ticket_purchases DROP CONSTRAINT IF EXISTS ticket_purchases_currency_check;
ALTER TABLE public.ticket_purchases ADD  CONSTRAINT ticket_purchases_currency_check
    CHECK (currency IS NULL OR currency IN ('IDR', 'USD'));

-- NOTE ON `status`: the plan asks for a `status` column here with the domain
-- ('pending','paid','cancelled','refunded'). 001 already ships `payment_status`
-- with exactly that domain. Two columns holding the same state on an order table
-- diverge — and when they do, the ledger trigger below fires on one of them while
-- the UI reads the other, which is a silent accounting bug rather than a visible
-- one. `payment_status` is the single canonical order state. Downstream packages:
-- write payment_status, not status.

CREATE INDEX IF NOT EXISTS idx_ticket_purchases_event   ON public.ticket_purchases(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_pending ON public.ticket_purchases(event_id, created_at DESC)
    WHERE payment_status = 'pending';


-- ---------------------------------------------------------------------------
-- 3. purchase_tickets() — the only door into an order
--
-- 002 grants `authenticated` SELECT and nothing else on ticket_purchases, and
-- leaves it with no write policy. This function is the entire write path.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purchase_tickets(
    p_ticket_id    uuid,
    p_quantity     int,
    p_holder_names text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid        uuid := (SELECT auth.uid());
    v_now        timestamptz := now();
    v_order_id   uuid := gen_random_uuid();
    v_price      numeric(12,2);
    v_early      numeric(12,2);
    v_early_end  timestamptz;
    v_currency   text;
    v_event      uuid;
    v_sale_start timestamptz;
    v_sale_end   timestamptz;
    v_valid_from timestamptz;
    v_valid_till timestamptz;
    v_unit       numeric(12,2);
    v_total      numeric(14,2);
    v_ref        text;
    v_name       text;
    v_email      text;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'purchase_tickets: authentication required'
            USING ERRCODE = '28000';
    END IF;

    IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 20 THEN
        RAISE EXCEPTION 'purchase_tickets: quantity must be between 1 and 20, got %', p_quantity
            USING ERRCODE = '22023';
    END IF;

    -- The oversell guard is this one statement. The WHERE clause both selects the
    -- row and asserts the invariant, and UPDATE takes a row lock, so two
    -- concurrent buyers for the last seat serialise here: the loser matches zero
    -- rows. No advisory lock, no SELECT ... FOR UPDATE, no read-then-write race.
    UPDATE public.tickets t
       SET quantity_sold = t.quantity_sold + p_quantity
     WHERE t.id = p_ticket_id
       AND t.status = 'active'
       AND t.quantity_sold + p_quantity <= t.quantity_available
    RETURNING t.price, t.early_bird_price, t.early_bird_end, t.currency, t.event_id,
              t.sale_start, t.sale_end, t.valid_from, t.valid_until
      INTO v_price, v_early, v_early_end, v_currency, v_event,
           v_sale_start, v_sale_end, v_valid_from, v_valid_till;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase_tickets: tier % is sold out, not on sale, or does not exist', p_ticket_id
            USING ERRCODE = '23514';
    END IF;

    IF (v_sale_start IS NOT NULL AND v_now < v_sale_start)
       OR (v_sale_end IS NOT NULL AND v_now > v_sale_end) THEN
        RAISE EXCEPTION 'purchase_tickets: tier % is outside its sale window', p_ticket_id
            USING ERRCODE = '23514';
    END IF;

    -- Price is read out of the table, never off the request. Early bird is a
    -- timestamptz comparison, so it is absolute-time and needs no conversion —
    -- events.timezone governs how a date is *rendered* and where a "day 1"
    -- boundary falls, not whether an instant precedes another instant.
    v_unit := CASE
                WHEN v_early IS NOT NULL AND v_early_end IS NOT NULL AND v_now < v_early_end
                THEN v_early
                ELSE v_price
              END;
    v_total := v_unit * p_quantity;

    v_ref := 'DD-' || to_char(v_now, 'YYMMDD') || '-'
             || upper(substr(replace(v_order_id::text, '-', ''), 1, 6));

    SELECT p.display_name, p.email INTO v_name, v_email
      FROM public.profiles p WHERE p.id = v_uid;

    INSERT INTO public.ticket_purchases (
        id, ticket_id, event_id, user_id, quantity, unit_price, total_amount,
        currency, payment_status, order_reference, attendee_name, attendee_email
    ) VALUES (
        v_order_id, p_ticket_id, v_event, v_uid, p_quantity, v_unit, v_total,
        v_currency, 'pending', v_ref, v_name, v_email
    );

    -- One scannable pass per admitted person. 001's single check_in_time on the
    -- order admits a party of five either once or without limit; there is no
    -- correct middle without a row per head.
    INSERT INTO public.ticket_passes (purchase_id, event_id, tier_id, holder_name, valid_from, valid_until)
    SELECT v_order_id, v_event, p_ticket_id,
           nullif(btrim(coalesce(p_holder_names[g], '')), ''),
           v_valid_from, v_valid_till
      FROM generate_series(1, p_quantity) AS g;

    -- No ledger row here on purpose: the order is `pending`. The row is written by
    -- ledger_from_ticket_purchase() when payment actually lands.
    RETURN jsonb_build_object(
        'purchase_id',     v_order_id,
        'order_reference', v_ref,
        'quantity',        p_quantity,
        'unit_price',      v_unit,
        'total_amount',    v_total,
        'currency',        v_currency,
        'payment_status',  'pending'
    );
END $$;

REVOKE EXECUTE ON FUNCTION public.purchase_tickets(uuid, int, text[]) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.purchase_tickets(uuid, int, text[]) TO authenticated;


-- ---------------------------------------------------------------------------
-- 4. Circle pricing — the fee is derived from the organizer's price sheet
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_pricing (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id          uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    space_type        text NOT NULL CHECK (space_type IN (
                          'circle_space_1', 'circle_space_2', 'circle_space_4',
                          'circle_booth_a', 'circle_booth_b')),
    price             numeric(12,2) NOT NULL DEFAULT 0,
    addon_table_price numeric(12,2) NOT NULL DEFAULT 0,
    addon_chair_price numeric(12,2) NOT NULL DEFAULT 0,
    addon_power_price numeric(12,2) NOT NULL DEFAULT 0,
    extra_pass_price  numeric(12,2) NOT NULL DEFAULT 0,
    currency          text NOT NULL DEFAULT 'IDR' CHECK (currency IN ('IDR', 'USD')),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (event_id, space_type)
);

ALTER TABLE public.event_pricing ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON public.event_pricing;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.event_pricing
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- anon has no EXECUTE on the 002 helpers, so its policy calls none (002 §3).
DROP POLICY IF EXISTS event_pricing_select_public ON public.event_pricing;
CREATE POLICY event_pricing_select_public ON public.event_pricing
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft'));

DROP POLICY IF EXISTS event_pricing_select_auth ON public.event_pricing;
CREATE POLICY event_pricing_select_auth ON public.event_pricing
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'draft')
        OR public.is_event_staff(event_id)
    );

DROP POLICY IF EXISTS event_pricing_write_organizer ON public.event_pricing;
CREATE POLICY event_pricing_write_organizer ON public.event_pricing
    FOR ALL TO authenticated
    USING      (public.is_event_organizer(event_id))
    WITH CHECK (public.is_event_organizer(event_id));

GRANT SELECT                         ON public.event_pricing TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_pricing TO authenticated;

-- 001: circles.total_amount DECIMAL(10,2) — a Rp 500,000 space is fine, the sum of
-- a 400-circle event reported anywhere is not. Widen for consistency with the rest.
ALTER TABLE public.circles ALTER COLUMN total_amount TYPE numeric(12,2);

-- The client's `total_amount` is discarded and recomputed from the organizer's
-- price sheet on every INSERT and UPDATE. Client-supplied prices are the money
-- leak; this closes it without another RPC and without the form having to know
-- what anything costs.
CREATE OR REPLACE FUNCTION public.circles_set_total_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    p public.event_pricing%ROWTYPE;
BEGIN
    IF NEW.space_type IS NULL THEN
        NEW.total_amount := 0;
        RETURN NEW;
    END IF;

    SELECT * INTO p
      FROM public.event_pricing ep
     WHERE ep.event_id = NEW.event_id
       AND ep.space_type = NEW.space_type;

    IF NOT FOUND THEN
        -- The organizer has not published a price for this space type yet. Zero,
        -- not the client's number: an unpriced application is free to submit and
        -- shows as unpaid, which is recoverable. Trusting the browser is not.
        NEW.total_amount := 0;
        RETURN NEW;
    END IF;

    NEW.total_amount :=
          p.price
        + CASE WHEN NEW.additional_table THEN p.addon_table_price ELSE 0 END
        + CASE WHEN NEW.additional_chair THEN p.addon_chair_price ELSE 0 END
        + CASE WHEN NEW.additional_power THEN p.addon_power_price ELSE 0 END
        -- exhibitor_passes is 1..4 and the first pass is included in the space fee.
        + (greatest(coalesce(NEW.exhibitor_passes, 1) - 1, 0) * p.extra_pass_price);

    RETURN NEW;
END $$;

-- Name matters: BEFORE triggers fire in name order, and
-- `circles_guard_privileged_columns` (002) sorts first — it restores OLD.total_amount
-- for a non-organizer, and this trigger then derives the authoritative figure over
-- the top of it. Reversing the order would let a guarded revert win.
DROP TRIGGER IF EXISTS circles_set_total_amount ON public.circles;
CREATE TRIGGER circles_set_total_amount
    BEFORE INSERT OR UPDATE ON public.circles
    FOR EACH ROW EXECUTE FUNCTION public.circles_set_total_amount();


-- ---------------------------------------------------------------------------
-- 5. The ledger — widened, described, and made immutable for real
-- ---------------------------------------------------------------------------

-- 001: amount DECIMAL(10,2), i.e. a ceiling of Rp 99,999,999.99 — under
-- USD 6,500. Every ticket_sale row for a mid-sized Indonesian event exceeds it.
ALTER TABLE public.financial_transactions ALTER COLUMN amount TYPE numeric(14,2);

-- `currency` already exists as VARCHAR(3) NOT NULL in 001, unconstrained. The rest
-- of the schema restricts to two currencies; so does this now.
ALTER TABLE public.financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_currency_check;
ALTER TABLE public.financial_transactions ADD  CONSTRAINT financial_transactions_currency_check
    CHECK (currency IN ('IDR', 'USD'));

ALTER TABLE public.financial_transactions
    ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'credit';
ALTER TABLE public.financial_transactions
    ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.financial_transactions
    ADD COLUMN IF NOT EXISTS reference_table text;
ALTER TABLE public.financial_transactions
    ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.financial_transactions
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.financial_transactions
    ADD COLUMN IF NOT EXISTS reverses_transaction_id uuid REFERENCES public.financial_transactions(id);

ALTER TABLE public.financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_direction_check;
ALTER TABLE public.financial_transactions ADD  CONSTRAINT financial_transactions_direction_check
    CHECK (direction IN ('credit', 'debit'));

-- Any pre-existing row that encoded an outflow as a negative amount is normalised
-- to the sign-in-direction convention before the CHECK lands. This runs before the
-- immutability trigger is created below, which is the only window in which the
-- table is ever writable again.
UPDATE public.financial_transactions
   SET amount = abs(amount), direction = 'debit'
 WHERE amount < 0;

ALTER TABLE public.financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_amount_nonneg;
ALTER TABLE public.financial_transactions ADD  CONSTRAINT financial_transactions_amount_nonneg
    CHECK (amount >= 0);
-- Sign lives in `direction`, never in `amount`. A ledger with both is a ledger
-- where -100 debit and 100 credit both exist and nobody knows which convention a
-- given row followed.

-- Payment webhooks retry. This is what makes a replayed callback a no-op.
ALTER TABLE public.financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_idempotency_key_key;
ALTER TABLE public.financial_transactions ADD  CONSTRAINT financial_transactions_idempotency_key_key
    UNIQUE (idempotency_key);

-- `occurred_at` is when the money moved; `created_at` is when we heard about it.
-- They differ by however long the gateway took, which is exactly the window an
-- end-of-day reconciliation argues about. Backfill the existing rows.
-- The column was just added, so every existing row currently reads "the money
-- moved at migration time". Point it back at the only timestamp those rows have.
UPDATE public.financial_transactions SET occurred_at = created_at WHERE created_at IS NOT NULL;

-- transaction_type stays as 001 declared it:
--   circle_payment | ticket_sale | refund | expense | commission
-- Downstream writers use those exact five. The Zustand financialStore's invented
-- 'payment'/'fee' values are not in the CHECK and never were.

CREATE INDEX IF NOT EXISTS idx_financial_transactions_event_occurred
    ON public.financial_transactions(event_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_reference
    ON public.financial_transactions(reference_table, reference_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type_status
    ON public.financial_transactions(transaction_type, status);

-- Immutability, literally --------------------------------------------------
--
-- RLS is not enough and never was. Policies do not apply to the table owner, do
-- not apply to the service role the payment webhook uses, and do not apply to
-- anything a future migration does with a bare UPDATE. A trigger applies to all
-- of them. Corrections are reversing entries, not edits.
--
-- ponytail: this also blocks DELETE via ON DELETE CASCADE, so an event that has
-- taken money can no longer be deleted — `events.status = 'cancelled'` is the
-- supported way to retire one. Upgrade path if a hard delete is ever genuinely
-- needed: a `SET LOCAL doujindesk.ledger_unlock` guard read by this function, set
-- only inside a deliberate archival migration. Do not add it for convenience.
CREATE OR REPLACE FUNCTION public.financial_transactions_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION
        'financial_transactions is append-only: % on transaction % is not permitted. Post a reversing entry (reverses_transaction_id) instead.',
        TG_OP, coalesce(OLD.id::text, '(unknown)')
        USING ERRCODE = 'restrict_violation';
END $$;

-- 002 put a set_updated_at BEFORE UPDATE trigger on this table. Nothing can update
-- the table any more, so it is dead weight that only confuses the next reader.
DROP TRIGGER IF EXISTS set_updated_at ON public.financial_transactions;

DROP TRIGGER IF EXISTS financial_transactions_immutable ON public.financial_transactions;
CREATE TRIGGER financial_transactions_immutable
    BEFORE UPDATE OR DELETE ON public.financial_transactions
    FOR EACH ROW EXECUTE FUNCTION public.financial_transactions_immutable();

-- Belt as well as braces: no write privilege, no write policy, no write.
-- (TRUNCATE is not subject to RLS *or* to row triggers, which is why REVOKE ALL
--  rather than REVOKE INSERT, UPDATE, DELETE.)
REVOKE ALL ON public.financial_transactions FROM authenticated, anon;
GRANT  SELECT ON public.financial_transactions TO authenticated;
-- 002 already created the only policy: financial_transactions_select_organizer.
-- There is deliberately no INSERT, UPDATE or DELETE policy on this table anywhere
-- in the schema. Do not add one.


-- ---------------------------------------------------------------------------
-- 6. Ledger rows are written by triggers, never by a browser
--
-- SECURITY DEFINER because `authenticated` has no INSERT privilege on the ledger
-- (see above) and a trigger function runs as the calling user by default. The
-- function owner is the table owner, so it also passes RLS.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_from_ticket_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_currency text;
    v_original uuid;
BEGIN
    v_currency := coalesce(
        NEW.currency,
        (SELECT e.currency FROM public.events e WHERE e.id = NEW.event_id),
        'IDR');

    IF NEW.payment_status = 'paid' THEN
        INSERT INTO public.financial_transactions (
            event_id, transaction_type, reference_table, reference_id,
            amount, currency, direction, status, occurred_at,
            description, idempotency_key, created_by)
        VALUES (
            NEW.event_id, 'ticket_sale', 'ticket_purchases', NEW.id,
            NEW.total_amount, v_currency, 'credit', 'completed', now(),
            'Ticket order ' || coalesce(NEW.order_reference, NEW.id::text),
            'ticket_sale:' || NEW.id::text, NEW.user_id)
        ON CONFLICT (idempotency_key) DO NOTHING;

    ELSIF NEW.payment_status = 'refunded' AND OLD.payment_status = 'paid' THEN
        SELECT ft.id INTO v_original
          FROM public.financial_transactions ft
         WHERE ft.reference_table = 'ticket_purchases'
           AND ft.reference_id = NEW.id
           AND ft.transaction_type = 'ticket_sale'
         ORDER BY ft.occurred_at DESC
         LIMIT 1;

        INSERT INTO public.financial_transactions (
            event_id, transaction_type, reference_table, reference_id,
            amount, currency, direction, status, occurred_at,
            description, idempotency_key, reverses_transaction_id)
        VALUES (
            NEW.event_id, 'refund', 'ticket_purchases', NEW.id,
            NEW.total_amount, v_currency, 'debit', 'completed', now(),
            'Refund of ticket order ' || coalesce(NEW.order_reference, NEW.id::text),
            'ticket_refund:' || NEW.id::text, v_original)
        ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    RETURN NULL;  -- AFTER trigger; return value is ignored
END $$;

-- ponytail: the idempotency key is one-per-order-per-direction, so an order that
-- cycles paid → refunded → paid → refunded posts only the first pair. That is the
-- right default (it makes a retried webhook a no-op) and the wrong one for a
-- genuine re-sale. Upgrade path: append a monotonic attempt counter kept on
-- ticket_purchases to the key. Not built — no flow in this product re-sells a
-- refunded order.
DROP TRIGGER IF EXISTS ledger_from_ticket_purchase ON public.ticket_purchases;
CREATE TRIGGER ledger_from_ticket_purchase
    AFTER UPDATE ON public.ticket_purchases
    FOR EACH ROW
    WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
    EXECUTE FUNCTION public.ledger_from_ticket_purchase();


CREATE OR REPLACE FUNCTION public.ledger_from_circle_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_currency text;
    v_original uuid;
BEGIN
    SELECT e.currency INTO v_currency FROM public.events e WHERE e.id = NEW.event_id;
    v_currency := coalesce(v_currency, 'IDR');

    IF NEW.payment_status = 'paid' THEN
        INSERT INTO public.financial_transactions (
            event_id, transaction_type, reference_table, reference_id,
            amount, currency, direction, status, occurred_at,
            description, idempotency_key, created_by)
        VALUES (
            NEW.event_id, 'circle_payment', 'circles', NEW.id,
            NEW.total_amount, v_currency, 'credit', 'completed', now(),
            'Circle fee ' || coalesce(NEW.circle_code, NEW.circle_name),
            'circle_payment:' || NEW.id::text, NEW.user_id)
        ON CONFLICT (idempotency_key) DO NOTHING;

    ELSIF NEW.payment_status = 'refunded' AND OLD.payment_status = 'paid' THEN
        SELECT ft.id INTO v_original
          FROM public.financial_transactions ft
         WHERE ft.reference_table = 'circles'
           AND ft.reference_id = NEW.id
           AND ft.transaction_type = 'circle_payment'
         ORDER BY ft.occurred_at DESC
         LIMIT 1;

        INSERT INTO public.financial_transactions (
            event_id, transaction_type, reference_table, reference_id,
            amount, currency, direction, status, occurred_at,
            description, idempotency_key, reverses_transaction_id)
        VALUES (
            NEW.event_id, 'refund', 'circles', NEW.id,
            NEW.total_amount, v_currency, 'debit', 'completed', now(),
            'Refund of circle fee ' || coalesce(NEW.circle_code, NEW.circle_name),
            'circle_refund:' || NEW.id::text, v_original)
        ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS ledger_from_circle_payment ON public.circles;
CREATE TRIGGER ledger_from_circle_payment
    AFTER UPDATE ON public.circles
    FOR EACH ROW
    WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
    EXECUTE FUNCTION public.ledger_from_circle_payment();


-- ---------------------------------------------------------------------------
-- 7. event_financial_summary — where every figure on the dashboard comes from
--
-- security_invoker = true (PG15+) so the view is read under the caller's RLS,
-- i.e. financial_transactions_select_organizer still applies. Without it a view
-- runs as its owner and quietly hands event revenue to every logged-in attendee.
--
-- Criterion 4 forbids a client-side reduce over transaction rows. This is the
-- replacement: the organizer dashboard SELECTs from here.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.event_financial_summary;
CREATE VIEW public.event_financial_summary
WITH (security_invoker = true) AS
SELECT
    ft.event_id,
    ft.currency,
    ft.transaction_type,
    ft.direction,
    count(*) FILTER (WHERE ft.status = 'completed')                       AS transaction_count,
    coalesce(sum(ft.amount) FILTER (WHERE ft.status = 'completed'), 0)    AS total_amount,
    -- Signed by direction, so a consumer can sum straight down the column and get
    -- net revenue without knowing which transaction_types are outflows.
    coalesce(sum(CASE WHEN ft.direction = 'credit' THEN ft.amount ELSE -ft.amount END)
             FILTER (WHERE ft.status = 'completed'), 0)                   AS net_amount,
    coalesce(sum(ft.amount) FILTER (WHERE ft.status = 'pending'), 0)      AS pending_amount,
    max(ft.occurred_at) FILTER (WHERE ft.status = 'completed')            AS last_transaction_at
FROM public.financial_transactions ft
GROUP BY ft.event_id, ft.currency, ft.transaction_type, ft.direction;

GRANT SELECT ON public.event_financial_summary TO authenticated;


-- ---------------------------------------------------------------------------
-- 8. ticket_purchases SELECT policy, now that event_id exists
--    002 wrote this predicate through a join on `tickets` and left a comment
--    saying to replace it here.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS ticket_purchases_select ON public.ticket_purchases;
CREATE POLICY ticket_purchases_select ON public.ticket_purchases
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_event_staff(event_id));

COMMIT;
