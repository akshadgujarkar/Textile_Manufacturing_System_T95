-- ============================================================================
-- Migration 0001: Foundation, Domains, Sequences & Helper Functions
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- lets exclusion constraints combine "=" on ids with range overlap

-- Custom domain types enforcing exact arithmetic across all tables
CREATE DOMAIN qty_t   AS numeric(14,3);      -- 3 decimal places for physical weights / lengths (kg, m, pcs)
CREATE DOMAIN money_t AS numeric(14,2);      -- 2 decimal places for financial amounts (INR)
CREATE DOMAIN rate_t  AS numeric(12,4);      -- 4 decimal places for unit prices & valuation rates

-- Who is acting in this transaction (set by the application with SET LOCAL app.user_id = ...)
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS bigint
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.user_id', true), '')::bigint $$;

-- Sequence generator for human-readable codes: PREFIX-YY-000123 (YY = Indian-calendar year of creation)
CREATE OR REPLACE FUNCTION make_code(prefix text, seq regclass) RETURNS text
LANGUAGE sql AS
$$ SELECT prefix || '-' || to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YY')
          || '-' || lpad(nextval(seq)::text, 6, '0') $$;

-- Sequences for standard business entities (gaps allowed)
CREATE SEQUENCE IF NOT EXISTS seq_order_no;
CREATE SEQUENCE IF NOT EXISTS seq_po_no;
CREATE SEQUENCE IF NOT EXISTS seq_receipt_no;
CREATE SEQUENCE IF NOT EXISTS seq_lot_code;
CREATE SEQUENCE IF NOT EXISTS seq_job_no;
CREATE SEQUENCE IF NOT EXISTS seq_roll_code;
CREATE SEQUENCE IF NOT EXISTS seq_dispatch_no;
CREATE SEQUENCE IF NOT EXISTS seq_payment_ref;

-- Gap-free document numbers (Tax Invoices). One row per series per fiscal year (April–March).
CREATE TABLE IF NOT EXISTS doc_sequence (
  series       text   NOT NULL,
  fiscal_year  text   NOT NULL,
  last_no      bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (series, fiscal_year)
);

CREATE OR REPLACE FUNCTION next_doc_no(p_series text, p_date date) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_start int := CASE WHEN extract(month FROM p_date) >= 4 THEN extract(year FROM p_date)::int
                      ELSE extract(year FROM p_date)::int - 1 END;
  v_fy    text := v_start || '-' || lpad(((v_start + 1) % 100)::text, 2, '0');
  v_no    bigint;
BEGIN
  INSERT INTO doc_sequence (series, fiscal_year, last_no) VALUES (p_series, v_fy, 1)
  ON CONFLICT (series, fiscal_year) DO UPDATE SET last_no = doc_sequence.last_no + 1
  RETURNING last_no INTO v_no;       -- row lock is held until the caller's transaction ends => no gaps
  RETURN p_series || '/' || v_fy || '/' || lpad(v_no::text, 6, '0');
END $$;

-- ---------- Generic trigger functions (attached later, per table) ----------

-- Touch timestamp and user attribution
CREATE OR REPLACE FUNCTION trg_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := app_current_user_id();
  RETURN NEW;
END $$;

-- Touch timestamp, user attribution, and optimistic-concurrency version increment
CREATE OR REPLACE FUNCTION trg_touch_versioned() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := app_current_user_id();
  NEW.version    := OLD.version + 1;
  RETURN NEW;
END $$;

-- Universal physical deletion block (INV-10 / BR-1)
CREATE OR REPLACE FUNCTION trg_block_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are never deleted (deactivate / cancel / reverse instead)', TG_TABLE_NAME
    USING ERRCODE = 'BR001';
END $$;

-- Append-only mutation block for ledgers
CREATE OR REPLACE FUNCTION trg_block_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed (post a reversal instead)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'BR001';
END $$;

-- Only the columns named in trigger arguments may change on UPDATE; everything else is immutable
CREATE OR REPLACE FUNCTION trg_only_columns_may_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - TG_ARGV) IS DISTINCT FROM (to_jsonb(OLD) - TG_ARGV) THEN
    RAISE EXCEPTION 'Only % may be changed on %', array_to_string(TG_ARGV, ', '), TG_TABLE_NAME
      USING ERRCODE = 'BR003';
  END IF;
  RETURN NEW;
END $$;

-- Table-driven state machine catalog (rows seeded later). Column must be named "status".
CREATE TABLE IF NOT EXISTS status_transition (
  entity_name  text NOT NULL,
  from_status  text,                 -- NULL = initial state (INSERT)
  to_status    text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_status_transition
  ON status_transition (entity_name, COALESCE(from_status, ''), to_status);

-- State transition validator trigger function
CREATE OR REPLACE FUNCTION trg_enforce_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_from text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_from := NULL;
  ELSIF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  ELSE
    v_from := OLD.status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM status_transition
                  WHERE entity_name = TG_ARGV[0]
                    AND from_status IS NOT DISTINCT FROM v_from
                    AND to_status   = NEW.status) THEN
    RAISE EXCEPTION 'Invalid % status change: % -> %', TG_ARGV[0], COALESCE(v_from, '(new)'), NEW.status
      USING ERRCODE = 'BR002';
  END IF;
  RETURN NEW;
END $$;

-- Child rows may only be added/changed/removed while the parent document is still a draft
CREATE OR REPLACE FUNCTION trg_parent_must_be_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_row jsonb; v_status text;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  EXECUTE format('SELECT status FROM %I WHERE %I = $1', TG_ARGV[0], TG_ARGV[1])
     INTO v_status USING (v_row ->> TG_ARGV[2])::bigint;
  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION '% can only be changed while its % is draft', TG_TABLE_NAME, TG_ARGV[0]
      USING ERRCODE = 'BR003';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
