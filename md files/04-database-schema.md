# 04 — Database Schema (PostgreSQL DDL)

**Project:** Textile Manufacturing System — Everest Textile Mills
**Database:** PostgreSQL 15+ (single instance, single schema `public`) — see `02-database-technology-selection.md`
**Depends on:** `01-requirements-analysis.md` (FR / BR / A / Q IDs) and `03-entity-relationship-design.md` (46 entities, INV-1…INV-11, state machines §8)
**Scope:** complete, implementation-ready DDL: tables, columns, types, constraints, integrity triggers, seed data.
**Companion documents:** `05-data-flow-and-transactions.md` (how the application uses this schema) and `06-query-and-index-strategy.md` (views and all performance indexes).

> **Verification status:** this DDL has been written and reviewed by hand but **not executed** against a live PostgreSQL server in the environment that produced it. Run Section 12 (smoke test) on a scratch database before treating it as final; fix-ups, if any, belong in the first migration.

---

## 1. Decisions adopted for the blocking open questions

Doc 01 §11 lists Q1, Q3, Q6, Q7, Q9 as blocking. They are still unanswered, so Phase 4 proceeds with the following **explicit, reversible defaults**. Each one says what changes if the answer differs.

| Q | Default adopted in this schema | If the mill answers differently |
|---|---|---|
| **Q3** Yarn without an order? | Allowed. `goods_receipt_item.earmarked_order_id` is nullable; reservations are a separate table. | Make the column `NOT NULL` (one-line migration). |
| **Q6** Material valuation | **Weighted-average cost per yarn item**, kept in `yarn_stock_balance.avg_cost`. Every issue movement snapshots that cost; material cost is recognised at **issue** (consumption basis, as doc 03 §10). The rate on the receipt line (`unit_rate`) feeds the average. Supplier bills do **not** re-value stock (price differences are visible in a variance view, doc 06). | Per-lot cost: add `receipt_item_id` on issue movements (column already exists) and a per-lot balance. FIFO: same plus a consumption order. No new entity. |
| **Q7** Wage allocation | Wages are **plant-level indirect cost**: one `cost_entry` (`cost_type='wage'`, `order_id NULL`) per approved wage record. Per-order / per-roll shares are *allocated in a view* pro-rata to output (doc 06). | Hours-based allocation: write several `cost_entry` rows per wage record with `order_id` set (the table already allows it) and, if needed, add a small `job_labour` table. |
| **Q9** Stage routing and roll identity | Yarn can be issued to **any** job (normally the first stage). A **roll is produced by exactly one job** (normally the final stage); there is no parent-roll link. The DB does **not** enforce stage order (`process_stage.sequence_hint` is advisory). | Add `fabric_roll.parent_roll_id` or a roll↔job link table (doc 03 §13). |
| **Q1** Who enters output | `production_log.operator_id` and `fabric_roll.operator_id` are **nullable** (the person who typed it is always recorded in `created_by`). | Sensors: same tables, higher write rate (doc 06 §9). |
| Q5, Q8, Q12, Q13, Q14 | Q5: several dispatches per invoice and several invoices per order supported. Q8: no tax columns yet (additive later; the schema keeps `total_amount` as the payable amount). Q12: severity is a fixed three-value set. Q13: `roll_code` is a printable/scannable text code. Q14: no physical deletion anywhere; retention is an archival decision for doc 08. | — |

### 1.1 Deliberate differences from doc 03

| # | Difference | Reason |
|---|---|---|
| 1 | `goods_receipt.received_by` **not created**; `created_by` already records the gate user | Avoids two columns that must always be equal |
| 2 | `qc_defect.qty_or_position` split into `defect_count` and `position_note` | One column held two different meanings |
| 3 | Added `yarn_stock_balance.avg_cost`, `goods_receipt_item.unit_rate`, `goods_receipt_item.challan_quantity` | Valuation (Q6) and challan reconciliation (Q4) |
| 3a | Added `client_request_id` to `yarn_stock_movement` (required for manual issue / return / adjustment) and to `fabric_roll` | Doc 03 listed the duplicate-submit guard only on receipts, production logs and payments; workflow simulation (doc 05) showed a retried *issue* or *roll creation* would otherwise double-post |
| 4 | Added tables `status_transition` and `doc_sequence` | Table-driven state machines (doc 03 §8) and gap-free invoice numbers |
| 5 | Added job transition `interrupted → completed` | Doc 03 §8.2 says a breakdown needing a different machine "ends the job"; `cancelled` would wrongly hide produced output |
| 6 | `invoice.invoice_no` is **assigned at issue**, nullable while draft | Gap-free numbering without wasting numbers on discarded drafts |
| 7 | `buyer_payment` and `machine_status_event` are "ledgers with one controlled update" (reversal flag / closing `ended_at`) | Doc 03 lists them as append-only but also needs `reversed` and "close an open event"; the carve-out is enforced by trigger so nothing else can change |
| 8 | `invoice.total_amount` and `supplier_bill.total_amount` are **maintained by trigger** from their lines | Header can never disagree with lines (no hand-typed totals) |

---

## 2. Conventions

| Topic | Rule |
|---|---|
| Naming | `snake_case`. Table names are **singular, exactly as in doc 03** (`customer_order`, `fabric_roll`, …) so every document and the ER diagrams use identical identifiers. (Doc 02 §6 mentioned plural table names; since doc 03 then used singular names throughout, singular is kept — a naming-only decision.) |
| Keys | `bigint GENERATED ALWAYS AS IDENTITY` surrogate primary keys; link tables use composite keys. Human codes (`order_no`, `roll_code`, …) are separate `UNIQUE` columns. |
| Money / quantity | Domains `money_t = numeric(14,2)`, `qty_t = numeric(14,3)`, `rate_t = numeric(12,4)`. No `float` anywhere. |
| Time | `timestamptz` everywhere (stored UTC); business dates are `date` in the plant's calendar (IST). Set `ALTER DATABASE <db> SET timezone = 'UTC'`. |
| Status columns | `text` + `CHECK (... IN (...))` (not `ENUM`) because adding a status later is a one-line constraint change rather than an enum migration. Transitions are enforced by the `status_transition` table (Section 3). |
| Deletes | FKs use PostgreSQL's default `NO ACTION` (equivalent to `RESTRICT` for non-deferrable FKs). Physical deletes are blocked by trigger on every business table (Section 10). |
| Who did it | `created_by` / `updated_by` default to `app_current_user_id()`, which reads the transaction-local setting `app.user_id`. The application issues `SET LOCAL app.user_id = <id>` as the first statement of **every** transaction. If it is missing, `created_by NOT NULL` makes the insert fail — an anonymous write is impossible. |
| Optional context | `SET LOCAL app.reason = '...'` (mandatory by policy for cancellations, voids, adjustments) and `SET LOCAL app.source = 'screen:gate-entry'` are copied into `audit_log`. |
| Concurrency token | Editable transactional tables carry `version int`. A trigger increments it on every `UPDATE`; the application updates with `WHERE id = $1 AND version = $2` and treats 0 rows as a conflict. |
| Error codes | Business-rule violations raise custom SQLSTATEs `BR001…BR011` (Section 11) so the application can map them to friendly messages without parsing text. |
| Code generation | Per-type PostgreSQL sequences produce `PREFIX-YY-000123` codes (gaps allowed). **Invoices** use `doc_sequence` (row-locked counter, gap-free, assigned at issue). |
| Where indexes live | **This document:** primary keys and every `UNIQUE` / partial-unique / exclusion constraint that *enforces a rule*. **Doc 06:** all additional indexes (FK-support and query-driven), each justified against a named query. |

---

## 3. Migration 0001 — extensions, domains, helper functions

```sql
-- 0001_foundation.sql
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- lets exclusion constraints combine "=" on ids with range overlap

CREATE DOMAIN qty_t   AS numeric(14,3);
CREATE DOMAIN money_t AS numeric(14,2);
CREATE DOMAIN rate_t  AS numeric(12,4);

-- Who is acting in this transaction (set by the application with SET LOCAL app.user_id = ...)
CREATE FUNCTION app_current_user_id() RETURNS bigint
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.user_id', true), '')::bigint $$;

-- PREFIX-YY-000123 business codes (YY = Indian-calendar year of creation)
CREATE FUNCTION make_code(prefix text, seq regclass) RETURNS text
LANGUAGE sql AS
$$ SELECT prefix || '-' || to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YY')
          || '-' || lpad(nextval(seq)::text, 6, '0') $$;

CREATE SEQUENCE seq_order_no;
CREATE SEQUENCE seq_po_no;
CREATE SEQUENCE seq_receipt_no;
CREATE SEQUENCE seq_lot_code;
CREATE SEQUENCE seq_job_no;
CREATE SEQUENCE seq_roll_code;
CREATE SEQUENCE seq_dispatch_no;
CREATE SEQUENCE seq_payment_ref;

-- Gap-free document numbers (invoices). One row per series per fiscal year (April–March).
CREATE TABLE doc_sequence (
  series       text   NOT NULL,
  fiscal_year  text   NOT NULL,
  last_no      bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (series, fiscal_year)
);

CREATE FUNCTION next_doc_no(p_series text, p_date date) RETURNS text
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

-- updated_at / updated_by
CREATE FUNCTION trg_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := app_current_user_id();
  RETURN NEW;
END $$;

-- same + optimistic-concurrency counter
CREATE FUNCTION trg_touch_versioned() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := app_current_user_id();
  NEW.version    := OLD.version + 1;
  RETURN NEW;
END $$;

CREATE FUNCTION trg_block_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are never deleted (deactivate / cancel / reverse instead)', TG_TABLE_NAME
    USING ERRCODE = 'BR001';
END $$;

CREATE FUNCTION trg_block_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed (post a reversal instead)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'BR001';
END $$;

-- Only the columns named in the trigger arguments may change on UPDATE; everything else is immutable.
CREATE FUNCTION trg_only_columns_may_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - TG_ARGV) IS DISTINCT FROM (to_jsonb(OLD) - TG_ARGV) THEN
    RAISE EXCEPTION 'Only % may be changed on %', array_to_string(TG_ARGV, ', '), TG_TABLE_NAME
      USING ERRCODE = 'BR003';
  END IF;
  RETURN NEW;
END $$;

-- Table-driven state machine (rows seeded in Section 9). Column must be named "status".
CREATE TABLE status_transition (
  entity_name  text NOT NULL,
  from_status  text,                 -- NULL = initial state (INSERT)
  to_status    text NOT NULL
);
CREATE UNIQUE INDEX uq_status_transition
  ON status_transition (entity_name, COALESCE(from_status, ''), to_status);

CREATE FUNCTION trg_enforce_transition() RETURNS trigger LANGUAGE plpgsql AS $$
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

-- Child rows may only be added/changed/removed while the parent document is still a draft.
-- Args: parent table, parent PK column, child FK column.
CREATE FUNCTION trg_parent_must_be_draft() RETURNS trigger LANGUAGE plpgsql AS $$
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
```

---

## 4. Migration 0002 — access, people and master data

```sql
-- 0002_masters.sql

CREATE TABLE role (
  role_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_name   text NOT NULL UNIQUE,
  description text
);

CREATE TABLE app_user (
  user_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username       text    NOT NULL,
  password_hash  text    NOT NULL,                 -- output of argon2id/bcrypt only; never a plaintext password
  employee_id    bigint,                           -- FK added below (employee is created next)
  is_active      boolean NOT NULL DEFAULT true,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     bigint REFERENCES app_user (user_id),       -- NULL only for the bootstrap 'system' user
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     bigint REFERENCES app_user (user_id)
);
CREATE UNIQUE INDEX uq_app_user_username ON app_user (lower(username));
CREATE UNIQUE INDEX uq_app_user_employee ON app_user (employee_id) WHERE employee_id IS NOT NULL;   -- 1 : 0..1

CREATE TABLE user_role (
  user_id    bigint NOT NULL REFERENCES app_user (user_id) ON DELETE CASCADE,
  role_id    bigint NOT NULL REFERENCES role (role_id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by bigint DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE employee (
  employee_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_code text    NOT NULL UNIQUE,
  full_name     text    NOT NULL,
  designation   text,
  pay_basis     text    NOT NULL CHECK (pay_basis IN ('daily', 'monthly', 'piece_rate')),
  pay_rate      money_t NOT NULL CHECK (pay_rate >= 0),     -- SENSITIVE: column-level privileges in doc 07
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);
ALTER TABLE app_user ADD CONSTRAINT fk_app_user_employee
  FOREIGN KEY (employee_id) REFERENCES employee (employee_id);

CREATE TABLE unit_of_measure (
  unit_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_code   text NOT NULL UNIQUE,            -- 'kg', 'm', 'pcs'
  description text
);

CREATE TABLE supplier (
  supplier_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  contact     text,
  tax_id      text,                            -- optional (Q8); not validated here
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);
CREATE UNIQUE INDEX uq_supplier_name ON supplier (lower(name));

CREATE TABLE buyer (
  buyer_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  contact     text,
  tax_id      text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);
CREATE UNIQUE INDEX uq_buyer_name ON buyer (lower(name));

CREATE TABLE yarn_type (
  yarn_type_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL UNIQUE,
  specification text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

CREATE TABLE colour (
  colour_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

CREATE TABLE yarn_item (                               -- the stockable thing: yarn type x colour
  yarn_item_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  yarn_type_id  bigint NOT NULL REFERENCES yarn_type (yarn_type_id),
  colour_id     bigint NOT NULL REFERENCES colour (colour_id),
  unit_id       bigint NOT NULL REFERENCES unit_of_measure (unit_id),
  reorder_level qty_t  NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),   -- low-stock threshold (FR-1.3)
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_yarn_item UNIQUE (yarn_type_id, colour_id)
);

CREATE TABLE fabric_product (
  product_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL UNIQUE,
  specification text,
  unit_id       bigint NOT NULL REFERENCES unit_of_measure (unit_id),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_fabric_product_unit UNIQUE (product_id, unit_id)       -- target of composite FK from order_item
);

CREATE TABLE process_stage (
  stage_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL UNIQUE,                  -- spinning, weaving, dyeing
  sequence_hint smallint,                              -- advisory only (Q9)
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

CREATE TABLE machine (
  machine_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  machine_code text   NOT NULL UNIQUE,
  stage_id     bigint NOT NULL REFERENCES process_stage (stage_id),
  description  text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_machine_stage UNIQUE (machine_id, stage_id)            -- target of composite FK from production_job
);

CREATE TABLE shift (
  shift_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  starts_at  time NOT NULL,
  ends_at    time NOT NULL,                            -- may be earlier than starts_at (night shift crosses midnight)
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

CREATE TABLE defect_type (
  defect_type_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           text NOT NULL UNIQUE,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);
```

---

## 5. Migration 0003 — orders, purchasing, gate entry, billing from suppliers

Created in dependency order: orders first (because gate-entry lines can earmark an order), then purchase orders and receipts.

```sql
-- 0003_orders_and_purchasing.sql

-- ===================== Customer orders =====================
CREATE TABLE customer_order (
  order_id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_no               text   NOT NULL UNIQUE DEFAULT make_code('ORD', 'seq_order_no'),
  buyer_id               bigint NOT NULL REFERENCES buyer (buyer_id),
  order_date             date   NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  promised_delivery_date date,
  status                 text   NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'confirmed', 'cancelled', 'closed')),
  confirmed_at           timestamptz,
  cancelled_at           timestamptz,
  cancelled_by           bigint REFERENCES app_user (user_id),
  cancel_reason          text,
  version                int    NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_order_promised_after_order CHECK (promised_delivery_date IS NULL OR promised_delivery_date >= order_date),
  CONSTRAINT ck_order_confirmed_has_date   CHECK (status = 'draft' OR status = 'cancelled' OR promised_delivery_date IS NOT NULL),   -- FR-4.3
  CONSTRAINT ck_order_cancel_reason        CHECK (status <> 'cancelled' OR (cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL)),
  CONSTRAINT uq_order_buyer UNIQUE (order_id, buyer_id)       -- target of composite FK from dispatch
);

CREATE TABLE order_item (
  order_item_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      bigint   NOT NULL REFERENCES customer_order (order_id),
  line_no       smallint NOT NULL CHECK (line_no > 0),
  product_id    bigint   NOT NULL,
  colour_id     bigint   NOT NULL REFERENCES colour (colour_id),
  ordered_qty   qty_t    NOT NULL CHECK (ordered_qty > 0),
  unit_id       bigint   NOT NULL,
  agreed_rate   rate_t   NOT NULL CHECK (agreed_rate >= 0),     -- price snapshot
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_order_item_line UNIQUE (order_id, line_no),
  CONSTRAINT fk_order_item_product_unit FOREIGN KEY (product_id, unit_id)
      REFERENCES fabric_product (product_id, unit_id)            -- item unit must equal the product's unit
);

CREATE TABLE order_status_history (
  history_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    bigint NOT NULL REFERENCES customer_order (order_id),
  from_status text,
  to_status   text   NOT NULL,
  reason      text,
  changed_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_material_requirement (
  requirement_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_item_id  bigint NOT NULL REFERENCES order_item (order_item_id),
  yarn_item_id   bigint NOT NULL REFERENCES yarn_item (yarn_item_id),
  required_qty   qty_t  NOT NULL CHECK (required_qty > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_requirement UNIQUE (order_item_id, yarn_item_id)
);

-- ===================== Purchase orders (optional entity, A8) =====================
CREATE TABLE purchase_order (
  po_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_no       text   NOT NULL UNIQUE DEFAULT make_code('PO', 'seq_po_no'),
  supplier_id bigint NOT NULL REFERENCES supplier (supplier_id),
  order_date  date   NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  status      text   NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'closed', 'cancelled')),
  version     int    NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_po_supplier UNIQUE (po_id, supplier_id)         -- target of composite FK from goods_receipt
);

CREATE TABLE purchase_order_item (
  po_item_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_id        bigint NOT NULL REFERENCES purchase_order (po_id),
  yarn_item_id bigint NOT NULL REFERENCES yarn_item (yarn_item_id),
  quantity     qty_t  NOT NULL CHECK (quantity > 0),
  agreed_rate  rate_t NOT NULL CHECK (agreed_rate >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_po_item UNIQUE (po_id, yarn_item_id)
);

-- ===================== Gate entry =====================
CREATE TABLE goods_receipt (
  receipt_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_no          text   NOT NULL UNIQUE DEFAULT make_code('GRN', 'seq_receipt_no'),
  supplier_id         bigint NOT NULL REFERENCES supplier (supplier_id),
  po_id               bigint,
  supplier_challan_no text,
  received_at         timestamptz NOT NULL DEFAULT now(),
  client_request_id   uuid   NOT NULL UNIQUE,              -- duplicate-submit guard (double-click / retry)
  status              text   NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'cancelled')),
  cancelled_at        timestamptz,
  cancelled_by        bigint REFERENCES app_user (user_id),
  cancel_reason       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT fk_receipt_po_supplier FOREIGN KEY (po_id, supplier_id)
      REFERENCES purchase_order (po_id, supplier_id),       -- a PO receipt must come from the PO's own supplier
  CONSTRAINT ck_receipt_cancel CHECK (status <> 'cancelled' OR (cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL))
);
-- the same supplier challan cannot be booked twice (cancelled receipts do not block re-entry)
CREATE UNIQUE INDEX uq_receipt_challan ON goods_receipt (supplier_id, supplier_challan_no)
  WHERE supplier_challan_no IS NOT NULL AND status = 'received';

CREATE TABLE goods_receipt_item (                           -- one row = one yarn lot
  receipt_item_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_id         bigint NOT NULL REFERENCES goods_receipt (receipt_id),
  lot_code           text   NOT NULL UNIQUE DEFAULT make_code('LOT', 'seq_lot_code'),
  yarn_item_id       bigint NOT NULL REFERENCES yarn_item (yarn_item_id),
  quantity_received  qty_t  NOT NULL CHECK (quantity_received > 0),
  challan_quantity   qty_t  CHECK (challan_quantity IS NULL OR challan_quantity > 0),     -- Q4: paperwork quantity
  unit_rate          rate_t CHECK (unit_rate IS NULL OR unit_rate >= 0),                  -- provisional rate (challan/PO); feeds avg cost
  earmarked_order_id bigint REFERENCES customer_order (order_id),                         -- optional (Q3)
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

-- ===================== Supplier bills =====================
CREATE TABLE supplier_bill (
  bill_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id      bigint  NOT NULL REFERENCES supplier (supplier_id),
  supplier_bill_no text    NOT NULL,
  bill_date        date    NOT NULL,
  total_amount     money_t NOT NULL DEFAULT 0,               -- maintained by trigger from the lines
  status           text    NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'void')),
  voided_at        timestamptz,
  voided_by        bigint REFERENCES app_user (user_id),
  void_reason      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_bill_void CHECK (status <> 'void' OR (void_reason IS NOT NULL AND voided_at IS NOT NULL))
);
-- same supplier bill number cannot be entered twice (voided bills may be re-entered)
CREATE UNIQUE INDEX uq_supplier_bill_no ON supplier_bill (supplier_id, supplier_bill_no) WHERE status = 'recorded';

CREATE TABLE supplier_bill_line (
  bill_line_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bill_id         bigint  NOT NULL REFERENCES supplier_bill (bill_id),
  receipt_item_id bigint  NOT NULL REFERENCES goods_receipt_item (receipt_item_id),
  quantity        qty_t   NOT NULL CHECK (quantity > 0),
  rate            rate_t  NOT NULL CHECK (rate >= 0),
  amount          money_t NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_bill_line_amount CHECK (amount = round(quantity * rate, 2)),
  CONSTRAINT uq_bill_line UNIQUE (bill_id, receipt_item_id)
);
```

---

## 6. Migration 0004 — production floor, stock ledger, reservations

```sql
-- 0004_production_and_stock.sql

-- ===================== Production =====================
CREATE TABLE production_job (
  job_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_no        text   NOT NULL UNIQUE DEFAULT make_code('JOB', 'seq_job_no'),
  order_item_id bigint NOT NULL REFERENCES order_item (order_item_id),
  stage_id      bigint NOT NULL,
  machine_id    bigint NOT NULL,
  planned_qty   qty_t  NOT NULL CHECK (planned_qty > 0),
  status        text   NOT NULL DEFAULT 'planned'
                CHECK (status IN ('planned', 'running', 'interrupted', 'completed', 'cancelled')),
  started_at    timestamptz,
  ended_at      timestamptz,
  version       int    NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT fk_job_machine_stage FOREIGN KEY (machine_id, stage_id)
      REFERENCES machine (machine_id, stage_id),                -- a machine can only run jobs of its own stage
  CONSTRAINT ck_job_started CHECK (status IN ('planned', 'cancelled') OR started_at IS NOT NULL),
  CONSTRAINT ck_job_ended   CHECK (status <> 'completed' OR ended_at IS NOT NULL),
  CONSTRAINT ck_job_times   CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);
-- INV-3 / BR-3: a machine runs at most one job at a time
CREATE UNIQUE INDEX uq_job_one_running_per_machine ON production_job (machine_id) WHERE status = 'running';

CREATE TABLE production_log (                                -- append-only output ledger
  log_id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id            bigint NOT NULL REFERENCES production_job (job_id),
  shift_id          bigint NOT NULL REFERENCES shift (shift_id),
  operator_id       bigint REFERENCES employee (employee_id),             -- nullable (Q1)
  output_qty        qty_t  NOT NULL,                                     -- positive output, or negative correction
  logged_at         timestamptz NOT NULL DEFAULT now(),
  client_request_id uuid   NOT NULL UNIQUE,
  reverses_log_id   bigint UNIQUE REFERENCES production_log (log_id),    -- a log entry can be corrected at most once
  reason            text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_log_qty CHECK (output_qty > 0 OR (output_qty < 0 AND reverses_log_id IS NOT NULL AND reason IS NOT NULL))
);

CREATE TABLE machine_status_event (                          -- state periods; the only update allowed is closing ended_at
  event_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  machine_id  bigint NOT NULL REFERENCES machine (machine_id),
  state       text   NOT NULL CHECK (state IN ('running', 'idle', 'breakdown', 'maintenance')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,                                  -- NULL while current
  note        text,
  reported_by bigint REFERENCES employee (employee_id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_mse_range CHECK (ended_at IS NULL OR ended_at >= started_at),
  -- no two periods of the same machine may overlap (FR-2.5 hardening)
  CONSTRAINT ex_mse_no_overlap EXCLUDE USING gist (machine_id WITH =, tstzrange(started_at, ended_at) WITH &&)
);
-- INV-3: at most one open (current) status event per machine
CREATE UNIQUE INDEX uq_mse_one_open ON machine_status_event (machine_id) WHERE ended_at IS NULL;

-- ===================== Stock ledger and cached balance =====================
CREATE TABLE yarn_stock_movement (                           -- append-only; the source of truth for yarn stock
  movement_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  yarn_item_id         bigint NOT NULL REFERENCES yarn_item (yarn_item_id),
  movement_type        text   NOT NULL CHECK (movement_type IN ('receipt', 'issue', 'return', 'adjustment', 'reversal')),
  quantity             qty_t  NOT NULL,                        -- signed: + into store, - out of store
  unit_cost            rate_t NOT NULL CHECK (unit_cost >= 0), -- valuation snapshot (filled by trigger when not given)
  receipt_item_id      bigint REFERENCES goods_receipt_item (receipt_item_id),
  production_job_id    bigint REFERENCES production_job (job_id),
  reverses_movement_id bigint UNIQUE REFERENCES yarn_stock_movement (movement_id),   -- a movement is reversed at most once
  reason               text,
  client_request_id    uuid UNIQUE,                            -- duplicate-submit guard for manual postings (see ck_movement_idempotent)
  occurred_at          timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  -- receipts are idempotent through uq_movement_one_receipt_per_line, reversals through reverses_movement_id;
  -- every other (manual) posting must carry a request id so a retry cannot post the same issue twice
  CONSTRAINT ck_movement_idempotent CHECK (movement_type IN ('receipt', 'reversal') OR client_request_id IS NOT NULL),
  CONSTRAINT ck_movement_shape CHECK (
       (movement_type = 'receipt'    AND quantity > 0 AND receipt_item_id IS NOT NULL)
    OR (movement_type = 'issue'      AND quantity < 0 AND production_job_id IS NOT NULL)
    OR (movement_type = 'return'     AND quantity > 0 AND production_job_id IS NOT NULL)
    OR (movement_type = 'adjustment' AND quantity <> 0 AND reason IS NOT NULL)
    OR (movement_type = 'reversal'   AND quantity <> 0 AND reverses_movement_id IS NOT NULL AND reason IS NOT NULL))
);
-- each receipt line posts exactly one receipt movement (idempotent posting)
CREATE UNIQUE INDEX uq_movement_one_receipt_per_line ON yarn_stock_movement (receipt_item_id) WHERE movement_type = 'receipt';

CREATE TABLE yarn_stock_balance (                            -- cached; written ONLY by triggers (never by the application)
  yarn_item_id bigint PRIMARY KEY REFERENCES yarn_item (yarn_item_id),
  on_hand_qty  qty_t  NOT NULL DEFAULT 0,
  reserved_qty qty_t  NOT NULL DEFAULT 0,
  avg_cost     rate_t NOT NULL DEFAULT 0,                      -- weighted average cost (Q6 default)
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_balance_not_negative CHECK (on_hand_qty >= 0),                 -- INV-1 / BR-1
  CONSTRAINT ck_reserved_not_negative CHECK (reserved_qty >= 0),
  CONSTRAINT ck_reserved_within_on_hand CHECK (reserved_qty <= on_hand_qty)    -- INV-9
);

CREATE TABLE stock_alert (
  alert_id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  yarn_item_id       bigint NOT NULL REFERENCES yarn_item (yarn_item_id),
  status             text   NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  balance_at_trigger qty_t  NOT NULL,
  opened_at          timestamptz NOT NULL DEFAULT now(),
  acknowledged_at    timestamptz,
  acknowledged_by    bigint REFERENCES app_user (user_id),
  resolved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         bigint DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);
-- at most one live alert per yarn item (a new one is raised only after the previous is resolved)
CREATE UNIQUE INDEX uq_stock_alert_one_live ON stock_alert (yarn_item_id) WHERE status IN ('open', 'acknowledged');

CREATE TABLE yarn_reservation (
  reservation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requirement_id bigint NOT NULL REFERENCES order_material_requirement (requirement_id),
  reserved_qty   qty_t  NOT NULL CHECK (reserved_qty > 0),
  status         text   NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'released')),
  closed_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);
```

---

## 7. Migration 0005 — rolls, quality, dispatch, invoicing

```sql
-- 0005_rolls_quality_dispatch.sql

CREATE TABLE fabric_roll (
  roll_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  roll_code      text   NOT NULL UNIQUE DEFAULT make_code('R', 'seq_roll_code'),   -- printed on the tag as barcode/QR
  job_id         bigint NOT NULL REFERENCES production_job (job_id),               -- gives machine, order item, order, buyer
  client_request_id uuid NOT NULL UNIQUE,                                          -- a retried "create roll" must not mint a second tag
  operator_id    bigint REFERENCES employee (employee_id),
  length_m       qty_t  NOT NULL CHECK (length_m > 0),
  weight_kg      qty_t  CHECK (weight_kg IS NULL OR weight_kg > 0),
  status         text   NOT NULL DEFAULT 'pending_qc'
                 CHECK (status IN ('pending_qc', 'in_stock', 'rework', 'rejected', 'loaded', 'dispatched', 'scrapped')),
  shelf_location text,
  version        int    NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

CREATE TABLE qc_inspection (                                 -- append-only
  inspection_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  roll_id       bigint NOT NULL REFERENCES fabric_roll (roll_id),
  inspector_id  bigint NOT NULL REFERENCES employee (employee_id),
  attempt_no    int    NOT NULL,                              -- set by trigger: 1, 2, ... after each rework
  result        text   NOT NULL CHECK (result IN ('passed', 'rework', 'rejected')),
  inspected_at  timestamptz NOT NULL DEFAULT now(),
  remarks       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_inspection_attempt UNIQUE (roll_id, attempt_no)
);

CREATE TABLE qc_defect (                                     -- append-only
  defect_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inspection_id  bigint NOT NULL REFERENCES qc_inspection (inspection_id),
  defect_type_id bigint NOT NULL REFERENCES defect_type (defect_type_id),
  severity       text   NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
  defect_count   int    NOT NULL DEFAULT 1 CHECK (defect_count > 0),
  position_note  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

-- ===================== Invoices (created before dispatch because dispatch may link to one) =====================
CREATE TABLE invoice (
  invoice_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_no   text   UNIQUE,                                  -- assigned at issue; gap-free (doc_sequence)
  buyer_id     bigint NOT NULL REFERENCES buyer (buyer_id),
  invoice_date date   NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  total_amount money_t NOT NULL DEFAULT 0,                     -- maintained by trigger from the lines
  status       text   NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'void')),
  issued_at    timestamptz,
  voided_at    timestamptz,
  voided_by    bigint REFERENCES app_user (user_id),
  void_reason  text,
  version      int    NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_invoice_has_number      CHECK (status = 'draft' OR invoice_no IS NOT NULL OR (status = 'void' AND issued_at IS NULL)),
  CONSTRAINT ck_invoice_void_reason     CHECK (status <> 'void' OR (void_reason IS NOT NULL AND voided_at IS NOT NULL)),
  CONSTRAINT uq_invoice_buyer UNIQUE (invoice_id, buyer_id)    -- target of composite FK from dispatch
);

CREATE TABLE invoice_item (
  invoice_item_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id      bigint  NOT NULL REFERENCES invoice (invoice_id),
  order_item_id   bigint  NOT NULL REFERENCES order_item (order_item_id),
  quantity        qty_t   NOT NULL CHECK (quantity > 0),
  rate            rate_t  NOT NULL CHECK (rate >= 0),           -- price snapshot
  amount          money_t NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_invoice_item_amount CHECK (amount = round(quantity * rate, 2)),
  CONSTRAINT uq_invoice_item UNIQUE (invoice_id, order_item_id)
);

-- ===================== Dispatch =====================
CREATE TABLE dispatch (
  dispatch_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispatch_no   text   NOT NULL UNIQUE DEFAULT make_code('DSP', 'seq_dispatch_no'),
  buyer_id      bigint NOT NULL,
  order_id      bigint NOT NULL,
  invoice_id    bigint,
  vehicle_no    text,
  status        text   NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'loading', 'dispatched', 'cancelled')),
  dispatched_at timestamptz,
  cancelled_at  timestamptz,
  cancelled_by  bigint REFERENCES app_user (user_id),
  cancel_reason text,
  version       int    NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT fk_dispatch_order_buyer   FOREIGN KEY (order_id, buyer_id)   REFERENCES customer_order (order_id, buyer_id),   -- buyer must own the order
  CONSTRAINT fk_dispatch_invoice_buyer FOREIGN KEY (invoice_id, buyer_id) REFERENCES invoice (invoice_id, buyer_id),        -- ...and the invoice (skipped while invoice_id is NULL)
  CONSTRAINT ck_dispatch_sent   CHECK (status <> 'dispatched' OR (dispatched_at IS NOT NULL AND vehicle_no IS NOT NULL)),
  CONSTRAINT ck_dispatch_cancel CHECK (status <> 'cancelled' OR (cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL))
);

CREATE TABLE dispatch_item (
  dispatch_item_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispatch_id      bigint NOT NULL REFERENCES dispatch (dispatch_id),
  roll_id          bigint NOT NULL REFERENCES fabric_roll (roll_id),
  scanned_at       timestamptz NOT NULL DEFAULT now(),
  scanned_by       bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  state            text   NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'removed')),
  removed_at       timestamptz,
  removed_by       bigint REFERENCES app_user (user_id),
  remove_reason    text,
  CONSTRAINT ck_dispatch_item_removed CHECK (state = 'active' OR (removed_at IS NOT NULL AND remove_reason IS NOT NULL))
);
-- INV-2 / BR-7: a roll can be on at most ONE active dispatch line (the "no double dispatch" rule)
CREATE UNIQUE INDEX uq_dispatch_item_one_active_roll ON dispatch_item (roll_id) WHERE state = 'active';
```

---

## 8. Migration 0006 — payments, workforce, cost, audit

```sql
-- 0006_finance_workforce_audit.sql

CREATE TABLE accounting_period (
  period_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_at    timestamptz,
  closed_by    bigint REFERENCES app_user (user_id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_period_range  CHECK (period_end >= period_start),
  CONSTRAINT ck_period_closed CHECK (status <> 'closed' OR closed_at IS NOT NULL),
  CONSTRAINT ex_period_no_overlap EXCLUDE USING gist (daterange(period_start, period_end, '[]') WITH &&)
);

CREATE TABLE buyer_payment (                                 -- ledger; only controlled update: recorded -> reversed
  payment_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_ref       text    NOT NULL UNIQUE DEFAULT make_code('PAY', 'seq_payment_ref'),
  buyer_id          bigint  NOT NULL REFERENCES buyer (buyer_id),
  received_on       date    NOT NULL,
  amount            money_t NOT NULL CHECK (amount > 0),
  mode              text    NOT NULL CHECK (mode IN ('cash', 'cheque', 'bank_transfer', 'upi', 'other')),
  instrument_ref    text,                                      -- cheque no. / UTR, optional
  status            text    NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'reversed')),
  reversed_at       timestamptz,
  reversed_by       bigint REFERENCES app_user (user_id),
  reverse_reason    text,
  client_request_id uuid    NOT NULL UNIQUE,                   -- duplicate-submit guard
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_payment_reversed CHECK (status <> 'reversed' OR (reverse_reason IS NOT NULL AND reversed_at IS NOT NULL))
);

CREATE TABLE payment_allocation (                            -- append-only
  allocation_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id       bigint  NOT NULL REFERENCES buyer_payment (payment_id),
  invoice_id       bigint  NOT NULL REFERENCES invoice (invoice_id),
  allocated_amount money_t NOT NULL CHECK (allocated_amount > 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

CREATE TABLE attendance_record (
  attendance_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id   bigint  NOT NULL REFERENCES employee (employee_id),
  work_date     date    NOT NULL,
  shift_id      bigint  NOT NULL REFERENCES shift (shift_id),
  status        text    NOT NULL CHECK (status IN ('present', 'absent', 'half_day', 'leave')),
  hours_worked  numeric(4,2) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_attendance UNIQUE (employee_id, work_date, shift_id),
  CONSTRAINT ck_attendance_hours CHECK (
       (status IN ('absent', 'leave')    AND hours_worked = 0)
    OR (status IN ('present', 'half_day') AND hours_worked > 0 AND hours_worked <= 24))
);

CREATE TABLE wage_record (
  wage_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id    bigint  NOT NULL REFERENCES employee (employee_id),
  period_id      bigint  NOT NULL REFERENCES accounting_period (period_id),
  gross_amount   money_t NOT NULL CHECK (gross_amount >= 0),        -- SENSITIVE
  basis_note     text,
  status         text    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'reversed')),
  approved_at    timestamptz,
  approved_by    bigint REFERENCES app_user (user_id),
  reversed_at    timestamptz,
  reversed_by    bigint REFERENCES app_user (user_id),
  reverse_reason text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_wage_reverse CHECK (status <> 'reversed' OR (reverse_reason IS NOT NULL AND reversed_at IS NOT NULL))
);
-- one live wage record per employee per period (a reversed one can be re-created)
CREATE UNIQUE INDEX uq_wage_live ON wage_record (employee_id, period_id) WHERE status <> 'reversed';

CREATE TABLE cost_entry (                                     -- append-only cost ledger
  cost_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cost_type        text    NOT NULL CHECK (cost_type IN ('material', 'wage', 'overhead')),
  amount           money_t NOT NULL,                           -- signed; reversals are negative
  period_id        bigint  NOT NULL REFERENCES accounting_period (period_id),
  order_id         bigint  REFERENCES customer_order (order_id),
  machine_id       bigint  REFERENCES machine (machine_id),
  roll_id          bigint  REFERENCES fabric_roll (roll_id),
  movement_id      bigint  REFERENCES yarn_stock_movement (movement_id),
  wage_id          bigint  REFERENCES wage_record (wage_id),
  description      text,
  reverses_cost_id bigint  UNIQUE REFERENCES cost_entry (cost_id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  -- INV-7: exactly one source per cost entry
  CONSTRAINT ck_cost_source CHECK (
       (cost_type = 'material' AND movement_id IS NOT NULL AND wage_id IS NULL)
    OR (cost_type = 'wage'     AND wage_id     IS NOT NULL AND movement_id IS NULL)
    OR (cost_type = 'overhead' AND movement_id IS NULL     AND wage_id IS NULL AND description IS NOT NULL)),
  -- BR-9: material cost always belongs to an order; wages/overhead may be plant-level (indirect)
  CONSTRAINT ck_cost_material_has_order CHECK (cost_type <> 'material' OR order_id IS NOT NULL)
);

CREATE TABLE audit_log (                                      -- append-only; written only by trg_audit (SECURITY DEFINER)
  audit_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id    bigint NOT NULL REFERENCES app_user (user_id),
  action      text   NOT NULL,                                 -- INSERT / UPDATE / DELETE
  entity_name text   NOT NULL,
  entity_id   text   NOT NULL,
  before_data jsonb,                                           -- JSONB is acceptable here: non-relational, never joined or reported on
  after_data  jsonb,
  reason      text,
  source      text
);
```

---

## 9. Seed data (reference rows and state machines)

```sql
-- 0007_seed.sql   (run as the migration role; the 'system' user must exist before anything else is inserted)

INSERT INTO app_user (username, password_hash)
VALUES ('system', '!disabled!');                       -- not a valid hash: nobody can ever log in as 'system'
SELECT set_config('app.user_id', (SELECT user_id::text FROM app_user WHERE username = 'system'), false);

INSERT INTO role (role_name, description) VALUES
 ('admin',              'Users, roles and master data'),
 ('owner',              'Reads all financial views and reports'),
 ('accounts',           'Bills, payments, wages, invoices, period close'),
 ('production_manager', 'Jobs, machines, production monitoring'),
 ('operator',           'Records machine output (if enabled, Q1)'),
 ('quality_checker',    'Creates QC inspections'),
 ('gate_store',         'Gate entry and finished-goods shelf'),
 ('dispatch',           'Loads and dispatches rolls'),
 ('sales',              'Customer orders'),
 ('staff_readonly',     'Order status lookup only');

INSERT INTO unit_of_measure (unit_code, description) VALUES
 ('kg', 'Kilogram'), ('m', 'Metre'), ('pcs', 'Pieces');

INSERT INTO process_stage (name, sequence_hint) VALUES ('spinning', 1), ('weaving', 2), ('dyeing', 3);

-- ---------- State machines (doc 03 section 8). from_status NULL = allowed initial state ----------
INSERT INTO status_transition (entity_name, from_status, to_status) VALUES
 -- customer_order
 ('customer_order', NULL, 'draft'),
 ('customer_order', 'draft', 'confirmed'), ('customer_order', 'draft', 'cancelled'),
 ('customer_order', 'confirmed', 'cancelled'), ('customer_order', 'confirmed', 'closed'),
 -- production_job  (interrupted -> completed added, see 1.1 #5)
 ('production_job', NULL, 'planned'),
 ('production_job', 'planned', 'running'), ('production_job', 'planned', 'cancelled'),
 ('production_job', 'running', 'interrupted'), ('production_job', 'running', 'completed'),
 ('production_job', 'interrupted', 'running'), ('production_job', 'interrupted', 'cancelled'),
 ('production_job', 'interrupted', 'completed'),
 -- fabric_roll
 ('fabric_roll', NULL, 'pending_qc'),
 ('fabric_roll', 'pending_qc', 'in_stock'), ('fabric_roll', 'pending_qc', 'rework'), ('fabric_roll', 'pending_qc', 'rejected'),
 ('fabric_roll', 'rework', 'pending_qc'), ('fabric_roll', 'rejected', 'scrapped'),
 ('fabric_roll', 'in_stock', 'loaded'), ('fabric_roll', 'loaded', 'in_stock'), ('fabric_roll', 'loaded', 'dispatched'),
 -- dispatch
 ('dispatch', NULL, 'draft'),
 ('dispatch', 'draft', 'loading'), ('dispatch', 'draft', 'cancelled'),
 ('dispatch', 'loading', 'dispatched'), ('dispatch', 'loading', 'cancelled'),
 -- goods_receipt
 ('goods_receipt', NULL, 'received'), ('goods_receipt', 'received', 'cancelled'),
 -- purchase_order
 ('purchase_order', NULL, 'draft'),
 ('purchase_order', 'draft', 'sent'), ('purchase_order', 'draft', 'cancelled'),
 ('purchase_order', 'sent', 'closed'), ('purchase_order', 'sent', 'cancelled'),
 -- yarn_reservation
 ('yarn_reservation', NULL, 'active'),
 ('yarn_reservation', 'active', 'consumed'), ('yarn_reservation', 'active', 'released'),
 -- stock_alert
 ('stock_alert', NULL, 'open'),
 ('stock_alert', 'open', 'acknowledged'), ('stock_alert', 'open', 'resolved'), ('stock_alert', 'acknowledged', 'resolved'),
 -- invoice
 ('invoice', NULL, 'draft'),
 ('invoice', 'draft', 'issued'), ('invoice', 'draft', 'void'), ('invoice', 'issued', 'void'),
 -- buyer_payment
 ('buyer_payment', NULL, 'recorded'), ('buyer_payment', 'recorded', 'reversed'),
 -- wage_record
 ('wage_record', NULL, 'draft'), ('wage_record', 'draft', 'approved'), ('wage_record', 'approved', 'reversed'),
 -- accounting_period
 ('accounting_period', NULL, 'open'), ('accounting_period', 'open', 'closed'),
 -- supplier_bill
 ('supplier_bill', NULL, 'recorded'), ('supplier_bill', 'recorded', 'void');
```

---

## 10. Migration 0008 — integrity triggers

Every function below exists to make a rule from doc 03 (§4.3 invariants, §8 state machines, §10 derived data) **impossible to bypass from application code**. Business-rule violations raise the custom SQLSTATE shown in the `USING ERRCODE` clause (catalogue in Section 11).

### 10.1 Accounting period helpers (INV-11)

```sql
-- Returns the OPEN accounting period for a date. Creates the calendar-month period if none exists yet
-- (so production never halts just because nobody created next month's period); raises BR004 if the period is closed.
CREATE FUNCTION period_for(p_date date) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_id bigint; v_status text;
BEGIN
  SELECT period_id, status INTO v_id, v_status
    FROM accounting_period WHERE p_date BETWEEN period_start AND period_end;
  IF NOT FOUND THEN
    INSERT INTO accounting_period (period_start, period_end)
    VALUES (date_trunc('month', p_date)::date, (date_trunc('month', p_date) + interval '1 month - 1 day')::date)
    ON CONFLICT DO NOTHING;                       -- covers a concurrent creator (exclusion constraint)
    SELECT period_id, status INTO v_id, v_status
      FROM accounting_period WHERE p_date BETWEEN period_start AND period_end;
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'Accounting period for % is closed', p_date USING ERRCODE = 'BR004';
  END IF;
  RETURN v_id;
END $$;

CREATE FUNCTION trg_period_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'closed' THEN
      RAISE EXCEPTION 'A closed accounting period cannot be modified' USING ERRCODE = 'BR004';
    END IF;
    IF NEW.status = 'closed' THEN
      IF EXISTS (SELECT 1 FROM wage_record WHERE period_id = NEW.period_id AND status = 'draft') THEN
        RAISE EXCEPTION 'Approve or reverse all draft wage records before closing the period' USING ERRCODE = 'BR004';
      END IF;
      NEW.closed_at := now();
      NEW.closed_by := app_current_user_id();
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_period_before BEFORE INSERT OR UPDATE ON accounting_period
  FOR EACH ROW EXECUTE FUNCTION trg_period_before();

-- Ledger rows may only be posted into an open period
CREATE FUNCTION trg_cost_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT status FROM accounting_period WHERE period_id = NEW.period_id) <> 'open' THEN
    RAISE EXCEPTION 'Cannot post cost into a closed accounting period' USING ERRCODE = 'BR004';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cost_before BEFORE INSERT ON cost_entry
  FOR EACH ROW EXECUTE FUNCTION trg_cost_before();
```

### 10.2 Customer orders (BR-11, state machine 8.1)

```sql
CREATE FUNCTION trg_order_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'draft' AND NEW.buyer_id <> OLD.buyer_id THEN
      RAISE EXCEPTION 'The buyer of a confirmed order cannot change' USING ERRCODE = 'BR003';
    END IF;
    IF NEW.status = 'confirmed' AND OLD.status = 'draft' THEN
      IF NOT EXISTS (SELECT 1 FROM order_item WHERE order_id = NEW.order_id) THEN
        RAISE EXCEPTION 'An order needs at least one line before it can be confirmed' USING ERRCODE = 'BR010';
      END IF;
      NEW.confirmed_at := now();
    ELSIF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
      IF EXISTS (SELECT 1 FROM production_job j JOIN order_item oi USING (order_item_id)
                  WHERE oi.order_id = NEW.order_id AND j.status IN ('running', 'interrupted'))
         OR EXISTS (SELECT 1 FROM dispatch d WHERE d.order_id = NEW.order_id AND d.status IN ('loading', 'dispatched'))
         OR EXISTS (SELECT 1 FROM invoice_item ii JOIN invoice i USING (invoice_id) JOIN order_item oi USING (order_item_id)
                     WHERE oi.order_id = NEW.order_id AND i.status = 'issued') THEN
        RAISE EXCEPTION 'Order has running jobs, active dispatches or issued invoices and cannot be cancelled' USING ERRCODE = 'BR010';
      END IF;
      NEW.cancelled_at := now();
      NEW.cancelled_by := app_current_user_id();
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_order_before BEFORE INSERT OR UPDATE ON customer_order
  FOR EACH ROW EXECUTE FUNCTION trg_order_before();

-- every status change is recorded automatically (reason comes from SET LOCAL app.reason or the cancel reason)
CREATE FUNCTION trg_order_history_ins() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO order_status_history (order_id, from_status, to_status) VALUES (NEW.order_id, NULL, NEW.status);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_order_history_ins AFTER INSERT ON customer_order
  FOR EACH ROW EXECUTE FUNCTION trg_order_history_ins();

CREATE FUNCTION trg_order_history_upd() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO order_status_history (order_id, from_status, to_status, reason)
  VALUES (NEW.order_id, OLD.status, NEW.status,
          COALESCE(NEW.cancel_reason, NULLIF(current_setting('app.reason', true), '')));
  RETURN NULL;
END $$;
CREATE TRIGGER trg_order_history_upd AFTER UPDATE OF status ON customer_order
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_order_history_upd();
```

### 10.3 Gate entry and yarn stock (INV-1, INV-9, FR-1.x)

```sql
-- A newly created yarn item gets its balance row (1 : 1)
CREATE FUNCTION trg_yarn_item_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO yarn_stock_balance (yarn_item_id) VALUES (NEW.yarn_item_id);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_yarn_item_balance AFTER INSERT ON yarn_item
  FOR EACH ROW EXECUTE FUNCTION trg_yarn_item_balance();

-- Receipt lines may be added only inside the same transaction that created the receipt
CREATE FUNCTION trg_receipt_item_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM goods_receipt
                  WHERE receipt_id = NEW.receipt_id AND status = 'received' AND created_at = now()) THEN
    RAISE EXCEPTION 'Receipt lines can only be added while the receipt is being created' USING ERRCODE = 'BR003';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_receipt_item_before BEFORE INSERT ON goods_receipt_item
  FOR EACH ROW EXECUTE FUNCTION trg_receipt_item_before();

-- Each receipt line automatically posts its receipt movement (stock can never miss a gate entry)
CREATE FUNCTION trg_receipt_item_post() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO yarn_stock_movement (yarn_item_id, movement_type, quantity, unit_cost, receipt_item_id)
  VALUES (NEW.yarn_item_id, 'receipt', NEW.quantity_received, NEW.unit_rate, NEW.receipt_item_id);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_receipt_item_post AFTER INSERT ON goods_receipt_item
  FOR EACH ROW EXECUTE FUNCTION trg_receipt_item_post();

-- Stamp who/when on cancel (the CHECK constraint requires them) — receipts and supplier bills
CREATE FUNCTION trg_receipt_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'received' THEN
    NEW.cancelled_at := now();
    NEW.cancelled_by := app_current_user_id();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_receipt_before BEFORE UPDATE ON goods_receipt
  FOR EACH ROW EXECUTE FUNCTION trg_receipt_before();

CREATE FUNCTION trg_bill_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'void' AND OLD.status = 'recorded' THEN
    NEW.voided_at := now();
    NEW.voided_by := app_current_user_id();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bill_before BEFORE UPDATE ON supplier_bill
  FOR EACH ROW EXECUTE FUNCTION trg_bill_before();

-- Cancelling a receipt reverses every one of its receipt movements.
-- If some yarn has already been issued, the reversal would make stock negative and the cancel is rejected (BR-1).
CREATE FUNCTION trg_receipt_cancel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO yarn_stock_movement (yarn_item_id, movement_type, quantity, reverses_movement_id, reason)
  SELECT m.yarn_item_id, 'reversal', -m.quantity, m.movement_id, 'Receipt ' || NEW.receipt_no || ' cancelled: ' || NEW.cancel_reason
    FROM yarn_stock_movement m
    JOIN goods_receipt_item gi ON gi.receipt_item_id = m.receipt_item_id
   WHERE gi.receipt_id = NEW.receipt_id AND m.movement_type = 'receipt'
   ORDER BY m.yarn_item_id;                       -- fixed lock order on yarn_stock_balance => no deadlocks between two cancels
  RETURN NULL;
END $$;
CREATE TRIGGER trg_receipt_cancel AFTER UPDATE OF status ON goods_receipt
  FOR EACH ROW WHEN (OLD.status = 'received' AND NEW.status = 'cancelled')
  EXECUTE FUNCTION trg_receipt_cancel();

-- THE stock engine: locks the balance row, snapshots cost, updates balance, raises/resolves low-stock alerts.
CREATE FUNCTION trg_movement_apply() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  b          yarn_stock_balance%ROWTYPE;
  v_orig     yarn_stock_movement%ROWTYPE;
  v_on_hand  qty_t;
  v_reorder  qty_t;
BEGIN
  SELECT * INTO b FROM yarn_stock_balance WHERE yarn_item_id = NEW.yarn_item_id FOR UPDATE;   -- serialises all movements of this item
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No stock balance row for yarn item %', NEW.yarn_item_id;
  END IF;

  IF NEW.movement_type = 'reversal' THEN
    SELECT * INTO v_orig FROM yarn_stock_movement WHERE movement_id = NEW.reverses_movement_id;
    IF NOT FOUND OR v_orig.movement_type = 'reversal'
       OR v_orig.yarn_item_id <> NEW.yarn_item_id OR NEW.quantity <> -v_orig.quantity THEN
      RAISE EXCEPTION 'A reversal must fully offset one earlier non-reversal movement of the same yarn item'
        USING ERRCODE = 'BR011';
    END IF;
    NEW.unit_cost := v_orig.unit_cost;                       -- reverse at the original value
  ELSIF NEW.quantity < 0 THEN
    NEW.unit_cost := b.avg_cost;                             -- outflows are always valued at current weighted average
  ELSE                                                       -- inflows: given cost, else the lot's provisional rate, else average
    NEW.unit_cost := COALESCE(NEW.unit_cost,
                              (SELECT unit_rate FROM goods_receipt_item WHERE receipt_item_id = NEW.receipt_item_id),
                              b.avg_cost);
  END IF;

  UPDATE yarn_stock_balance
     SET on_hand_qty  = on_hand_qty + NEW.quantity,
         avg_cost     = CASE WHEN NEW.quantity > 0
                             THEN round((on_hand_qty * avg_cost + NEW.quantity * NEW.unit_cost)
                                        / (on_hand_qty + NEW.quantity), 4)
                             ELSE avg_cost END,
         refreshed_at = now()
   WHERE yarn_item_id = NEW.yarn_item_id
   RETURNING on_hand_qty INTO v_on_hand;                     -- CHECK constraints reject a negative or over-reserved result

  SELECT reorder_level INTO v_reorder FROM yarn_item WHERE yarn_item_id = NEW.yarn_item_id;
  IF v_on_hand <= v_reorder THEN
    INSERT INTO stock_alert (yarn_item_id, balance_at_trigger) VALUES (NEW.yarn_item_id, v_on_hand)
    ON CONFLICT (yarn_item_id) WHERE status IN ('open', 'acknowledged') DO NOTHING;
  ELSE
    UPDATE stock_alert SET status = 'resolved', resolved_at = now()
     WHERE yarn_item_id = NEW.yarn_item_id AND status IN ('open', 'acknowledged');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_movement_apply BEFORE INSERT ON yarn_stock_movement
  FOR EACH ROW EXECUTE FUNCTION trg_movement_apply();

-- Material cost is recognised when yarn is ISSUED to a job (and mirrored for returns / reversals of issues)
CREATE FUNCTION trg_movement_cost() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_job_id   bigint;
  v_orig     yarn_stock_movement%ROWTYPE;
  v_rev_cost bigint;
  v_order    bigint;
  v_machine  bigint;
BEGIN
  IF NEW.movement_type IN ('issue', 'return') THEN
    v_job_id := NEW.production_job_id;
  ELSIF NEW.movement_type = 'reversal' THEN
    SELECT * INTO v_orig FROM yarn_stock_movement WHERE movement_id = NEW.reverses_movement_id;
    IF v_orig.movement_type NOT IN ('issue', 'return') THEN RETURN NULL; END IF;
    v_job_id := v_orig.production_job_id;
    SELECT cost_id INTO v_rev_cost FROM cost_entry
     WHERE movement_id = NEW.reverses_movement_id AND reverses_cost_id IS NULL;
  ELSE
    RETURN NULL;                                             -- receipts and adjustments create no production cost
  END IF;

  SELECT oi.order_id, j.machine_id INTO v_order, v_machine
    FROM production_job j JOIN order_item oi USING (order_item_id)
   WHERE j.job_id = v_job_id;

  INSERT INTO cost_entry (cost_type, amount, period_id, order_id, machine_id, movement_id, reverses_cost_id)
  VALUES ('material',
          round(-NEW.quantity * NEW.unit_cost, 2),           -- issue (-qty) => +cost; return / reversal of issue => -cost
          period_for((NEW.occurred_at AT TIME ZONE 'Asia/Kolkata')::date),
          v_order, v_machine, NEW.movement_id, v_rev_cost);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_movement_cost AFTER INSERT ON yarn_stock_movement
  FOR EACH ROW EXECUTE FUNCTION trg_movement_cost();

-- Reservation cache: reserved_qty follows active reservations in the same transaction (INV-9 via CHECK on the balance)
CREATE FUNCTION trg_reservation_apply() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_item bigint;
BEGIN
  SELECT yarn_item_id INTO v_item FROM order_material_requirement WHERE requirement_id = NEW.requirement_id;
  IF TG_OP = 'INSERT' THEN
    UPDATE yarn_stock_balance SET reserved_qty = reserved_qty + NEW.reserved_qty, refreshed_at = now()
     WHERE yarn_item_id = v_item;
  ELSIF OLD.status = 'active' AND NEW.status IN ('consumed', 'released') THEN
    UPDATE yarn_stock_balance SET reserved_qty = reserved_qty - OLD.reserved_qty, refreshed_at = now()
     WHERE yarn_item_id = v_item;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_reservation_apply_ins AFTER INSERT ON yarn_reservation
  FOR EACH ROW EXECUTE FUNCTION trg_reservation_apply();
CREATE TRIGGER trg_reservation_apply_upd AFTER UPDATE OF status ON yarn_reservation
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_reservation_apply();

-- Supplier bill totals follow their lines; lines are only added in the creating transaction; billed qty <= received qty
CREATE FUNCTION trg_bill_line_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_billed qty_t; v_received qty_t;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supplier_bill WHERE bill_id = NEW.bill_id AND status = 'recorded' AND created_at = now()) THEN
    RAISE EXCEPTION 'Bill lines can only be added while the bill is being created' USING ERRCODE = 'BR003';
  END IF;
  SELECT quantity_received INTO v_received FROM goods_receipt_item WHERE receipt_item_id = NEW.receipt_item_id FOR UPDATE;
  SELECT COALESCE(SUM(l.quantity), 0) INTO v_billed
    FROM supplier_bill_line l JOIN supplier_bill b USING (bill_id)
   WHERE l.receipt_item_id = NEW.receipt_item_id AND b.status = 'recorded';
  IF v_billed + NEW.quantity > v_received THEN
    RAISE EXCEPTION 'Billed quantity would exceed the quantity received for this lot' USING ERRCODE = 'BR011';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bill_line_before BEFORE INSERT ON supplier_bill_line
  FOR EACH ROW EXECUTE FUNCTION trg_bill_line_before();

CREATE FUNCTION trg_bill_total() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE supplier_bill SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM supplier_bill_line WHERE bill_id = NEW.bill_id)
   WHERE bill_id = NEW.bill_id;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_bill_total AFTER INSERT ON supplier_bill_line
  FOR EACH ROW EXECUTE FUNCTION trg_bill_total();
```

### 10.4 Production floor (INV-3, INV-4)

```sql
CREATE FUNCTION trg_job_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_order_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT o.status INTO v_order_status
      FROM order_item oi JOIN customer_order o USING (order_id) WHERE oi.order_item_id = NEW.order_item_id;
    IF v_order_status IS DISTINCT FROM 'confirmed' THEN
      RAISE EXCEPTION 'Jobs can only be created for confirmed orders' USING ERRCODE = 'BR010';
    END IF;
    RETURN NEW;
  END IF;

  -- INV-4: machine and order item are frozen once the job has left 'planned' (re-assignment = new job)
  IF OLD.status <> 'planned'
     AND (NEW.order_item_id, NEW.stage_id, NEW.machine_id) IS DISTINCT FROM (OLD.order_item_id, OLD.stage_id, OLD.machine_id) THEN
    RAISE EXCEPTION 'Machine / order item of a started job cannot change; create a new job for the remaining quantity'
      USING ERRCODE = 'BR003';
  END IF;

  IF NEW.status = 'running' AND OLD.status <> 'running' THEN
    IF NOT (SELECT is_active FROM machine WHERE machine_id = NEW.machine_id) THEN
      RAISE EXCEPTION 'Machine is deactivated' USING ERRCODE = 'BR010';
    END IF;
    IF EXISTS (SELECT 1 FROM machine_status_event
                WHERE machine_id = NEW.machine_id AND ended_at IS NULL AND state IN ('breakdown', 'maintenance')) THEN
      RAISE EXCEPTION 'Machine is under breakdown/maintenance; close that event first' USING ERRCODE = 'BR010';
    END IF;
    IF (SELECT o.status FROM order_item oi JOIN customer_order o USING (order_id)
         WHERE oi.order_item_id = NEW.order_item_id) <> 'confirmed' THEN
      RAISE EXCEPTION 'The order is no longer confirmed' USING ERRCODE = 'BR010';
    END IF;
    NEW.started_at := COALESCE(NEW.started_at, now());
  END IF;
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    NEW.ended_at := COALESCE(NEW.ended_at, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_job_before BEFORE INSERT OR UPDATE ON production_job
  FOR EACH ROW EXECUTE FUNCTION trg_job_before();

-- Machine state follows the job automatically: start -> running event; stop -> back to idle.
-- (A breakdown is recorded by the application as: close 'running' event, open 'breakdown' event, THEN set the job 'interrupted'.)
CREATE FUNCTION trg_job_machine_events() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_open machine_status_event%ROWTYPE; v_found boolean;
BEGIN
  SELECT * INTO v_open FROM machine_status_event WHERE machine_id = NEW.machine_id AND ended_at IS NULL FOR UPDATE;
  v_found := FOUND;
  IF NEW.status = 'running' THEN
    IF v_found AND v_open.state = 'idle' THEN
      UPDATE machine_status_event SET ended_at = now() WHERE event_id = v_open.event_id;
      v_found := false;
    END IF;
    IF NOT v_found THEN
      INSERT INTO machine_status_event (machine_id, state) VALUES (NEW.machine_id, 'running');
    END IF;
  ELSIF OLD.status = 'running' THEN
    IF v_found AND v_open.state = 'running' THEN
      UPDATE machine_status_event SET ended_at = now() WHERE event_id = v_open.event_id;
      INSERT INTO machine_status_event (machine_id, state) VALUES (NEW.machine_id, 'idle');
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_job_machine_events AFTER UPDATE OF status ON production_job
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_job_machine_events();

-- machine_status_event: only "close an open period" may update
CREATE FUNCTION trg_mse_close_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ended_at IS NOT NULL
     OR (to_jsonb(NEW) - 'ended_at') IS DISTINCT FROM (to_jsonb(OLD) - 'ended_at') THEN
    RAISE EXCEPTION 'A machine status event can only be closed once (ended_at)' USING ERRCODE = 'BR001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mse_close_only BEFORE UPDATE ON machine_status_event
  FOR EACH ROW EXECUTE FUNCTION trg_mse_close_only();

-- production_log: output only against a running job; corrections must fully offset one earlier positive entry
CREATE FUNCTION trg_log_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text; v_orig production_log%ROWTYPE;
BEGIN
  SELECT status INTO v_status FROM production_job WHERE job_id = NEW.job_id FOR SHARE;   -- blocks a concurrent "complete job"
  IF NEW.output_qty > 0 THEN
    IF v_status <> 'running' THEN
      RAISE EXCEPTION 'Output can only be logged against a running job (job is %)', v_status USING ERRCODE = 'BR010';
    END IF;
  ELSE
    SELECT * INTO v_orig FROM production_log WHERE log_id = NEW.reverses_log_id;
    IF NOT FOUND OR v_orig.job_id <> NEW.job_id OR v_orig.output_qty <= 0 OR NEW.output_qty <> -v_orig.output_qty THEN
      RAISE EXCEPTION 'A correction must fully offset one earlier positive output entry of the same job' USING ERRCODE = 'BR010';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_before BEFORE INSERT ON production_log
  FOR EACH ROW EXECUTE FUNCTION trg_log_before();
```

### 10.5 Rolls and quality (INV-5, INV-8, BR-4, BR-5)

```sql
CREATE FUNCTION trg_roll_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_job_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_job_status FROM production_job WHERE job_id = NEW.job_id FOR SHARE;
    IF v_job_status IN ('planned', 'cancelled') THEN
      RAISE EXCEPTION 'Rolls cannot be created for a % job', v_job_status USING ERRCODE = 'BR010';
    END IF;
    RETURN NEW;
  END IF;
  -- identity of the roll never changes (traceability)
  IF NEW.roll_code <> OLD.roll_code OR NEW.job_id <> OLD.job_id
     OR NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
    RAISE EXCEPTION 'roll_code, job and operator of a roll are immutable' USING ERRCODE = 'BR003';
  END IF;
  -- measured quantities may be corrected only before the roll becomes sellable stock
  IF OLD.status NOT IN ('pending_qc', 'rework')
     AND (NEW.length_m <> OLD.length_m OR NEW.weight_kg IS DISTINCT FROM OLD.weight_kg) THEN
    RAISE EXCEPTION 'Length / weight can no longer be changed (roll is %)', OLD.status USING ERRCODE = 'BR003';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_roll_guard BEFORE INSERT OR UPDATE ON fabric_roll
  FOR EACH ROW EXECUTE FUNCTION trg_roll_guard();

-- INV-8: an inspection and the roll's new status are one atomic fact
CREATE FUNCTION trg_qc_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text; v_attempt int;
BEGIN
  SELECT status INTO v_status FROM fabric_roll WHERE roll_id = NEW.roll_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'pending_qc' THEN
    RAISE EXCEPTION 'Roll is not awaiting inspection (status %)', v_status USING ERRCODE = 'BR009';
  END IF;
  SELECT COALESCE(MAX(attempt_no), 0) + 1 INTO v_attempt FROM qc_inspection WHERE roll_id = NEW.roll_id;
  NEW.attempt_no := v_attempt;
  UPDATE fabric_roll
     SET status = CASE NEW.result WHEN 'passed' THEN 'in_stock' WHEN 'rework' THEN 'rework' ELSE 'rejected' END
   WHERE roll_id = NEW.roll_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_qc_before BEFORE INSERT ON qc_inspection
  FOR EACH ROW EXECUTE FUNCTION trg_qc_before();

-- FR-3.3 / FR-3.4: a rework or reject must name at least one defect (checked at COMMIT, so defects can be inserted after the inspection)
CREATE FUNCTION trg_qc_requires_defect() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.result IN ('rework', 'rejected')
     AND NOT EXISTS (SELECT 1 FROM qc_defect WHERE inspection_id = NEW.inspection_id) THEN
    RAISE EXCEPTION 'A % result must record at least one defect', NEW.result USING ERRCODE = 'BR009';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_qc_requires_defect AFTER INSERT ON qc_inspection
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION trg_qc_requires_defect();

-- defects can only be attached in the transaction that created the inspection
CREATE FUNCTION trg_qc_defect_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM qc_inspection WHERE inspection_id = NEW.inspection_id AND created_at = now()) THEN
    RAISE EXCEPTION 'Defects can only be added while the inspection is being recorded' USING ERRCODE = 'BR009';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_qc_defect_before BEFORE INSERT ON qc_defect
  FOR EACH ROW EXECUTE FUNCTION trg_qc_defect_before();
```

### 10.6 Dispatch (INV-2, INV-5, BR-6, BR-7, BR-8)

```sql
-- Scanning a roll onto a dispatch: lock dispatch, lock roll, verify, flip roll to 'loaded'
CREATE FUNCTION trg_dispatch_item_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d dispatch%ROWTYPE; r fabric_roll%ROWTYPE; v_roll_order bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO d FROM dispatch WHERE dispatch_id = NEW.dispatch_id FOR UPDATE;
    IF d.status NOT IN ('draft', 'loading') THEN
      RAISE EXCEPTION 'Dispatch % is %, rolls can no longer be added', d.dispatch_no, d.status USING ERRCODE = 'BR007';
    END IF;
    SELECT * INTO r FROM fabric_roll WHERE roll_id = NEW.roll_id FOR UPDATE;
    IF r.status <> 'in_stock' THEN                                              -- INV-5 / BR-6
      RAISE EXCEPTION 'Roll % cannot be dispatched (status %)', r.roll_code, r.status USING ERRCODE = 'BR005';
    END IF;
    SELECT oi.order_id INTO v_roll_order
      FROM production_job j JOIN order_item oi USING (order_item_id) WHERE j.job_id = r.job_id;
    IF v_roll_order <> d.order_id THEN                                           -- BR-8: right buyer, right order
      RAISE EXCEPTION 'Roll % belongs to a different order than dispatch %', r.roll_code, d.dispatch_no USING ERRCODE = 'BR007';
    END IF;
    NEW.state := 'active';
    NEW.scanned_at := now();
    NEW.scanned_by := app_current_user_id();
    UPDATE fabric_roll SET status = 'loaded' WHERE roll_id = NEW.roll_id;
    IF d.status = 'draft' THEN
      UPDATE dispatch SET status = 'loading' WHERE dispatch_id = d.dispatch_id;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: only "active -> removed" (un-load a roll)
  IF OLD.state <> 'active' OR NEW.state <> 'removed'
     OR (to_jsonb(NEW) - ARRAY['state', 'removed_at', 'removed_by', 'remove_reason'])
        IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['state', 'removed_at', 'removed_by', 'remove_reason']) THEN
    RAISE EXCEPTION 'A dispatch line can only be changed from active to removed' USING ERRCODE = 'BR007';
  END IF;
  IF (SELECT status FROM dispatch WHERE dispatch_id = NEW.dispatch_id) NOT IN ('draft', 'loading', 'cancelled') THEN
    RAISE EXCEPTION 'Rolls cannot be removed from a dispatched load' USING ERRCODE = 'BR007';
  END IF;
  NEW.removed_at := COALESCE(NEW.removed_at, now());
  NEW.removed_by := COALESCE(NEW.removed_by, app_current_user_id());
  UPDATE fabric_roll SET status = 'in_stock' WHERE roll_id = NEW.roll_id AND status = 'loaded';
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dispatch_item_ins BEFORE INSERT ON dispatch_item
  FOR EACH ROW EXECUTE FUNCTION trg_dispatch_item_before();
CREATE TRIGGER trg_dispatch_item_upd BEFORE UPDATE ON dispatch_item
  FOR EACH ROW EXECUTE FUNCTION trg_dispatch_item_before();

CREATE FUNCTION trg_dispatch_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.buyer_id, NEW.order_id) IS DISTINCT FROM (OLD.buyer_id, OLD.order_id) THEN
      RAISE EXCEPTION 'Buyer and order of a dispatch cannot change' USING ERRCODE = 'BR003';
    END IF;
    IF NEW.invoice_id IS NOT NULL AND (SELECT status FROM invoice WHERE invoice_id = NEW.invoice_id) = 'void' THEN
      RAISE EXCEPTION 'A dispatch cannot be linked to a void invoice' USING ERRCODE = 'BR007';
    END IF;
    IF NEW.status = 'dispatched' AND OLD.status = 'loading' THEN
      IF NOT EXISTS (SELECT 1 FROM dispatch_item WHERE dispatch_id = NEW.dispatch_id AND state = 'active') THEN
        RAISE EXCEPTION 'An empty dispatch cannot be sent' USING ERRCODE = 'BR007';
      END IF;
      NEW.dispatched_at := COALESCE(NEW.dispatched_at, now());
    ELSIF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
      NEW.cancelled_at := now();
      NEW.cancelled_by := app_current_user_id();
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dispatch_before BEFORE INSERT OR UPDATE ON dispatch
  FOR EACH ROW EXECUTE FUNCTION trg_dispatch_before();

-- Completing or cancelling a dispatch moves all its rolls in the same transaction
CREATE FUNCTION trg_dispatch_after() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'dispatched' THEN
    UPDATE fabric_roll SET status = 'dispatched'
     WHERE roll_id IN (SELECT roll_id FROM dispatch_item WHERE dispatch_id = NEW.dispatch_id AND state = 'active');
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE dispatch_item SET state = 'removed', remove_reason = 'Dispatch cancelled: ' || NEW.cancel_reason
     WHERE dispatch_id = NEW.dispatch_id AND state = 'active';       -- row trigger returns each roll to in_stock
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_dispatch_after AFTER UPDATE OF status ON dispatch
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('dispatched', 'cancelled'))
  EXECUTE FUNCTION trg_dispatch_after();
```

### 10.7 Invoices, payments (INV-6)

```sql
CREATE FUNCTION trg_invoice_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'draft'
       AND (NEW.buyer_id, NEW.invoice_date, NEW.invoice_no) IS DISTINCT FROM (OLD.buyer_id, OLD.invoice_date, OLD.invoice_no) THEN
      RAISE EXCEPTION 'An issued invoice cannot be edited; void it instead' USING ERRCODE = 'BR003';
    END IF;
    IF NEW.status = 'issued' AND OLD.status = 'draft' THEN
      IF NOT EXISTS (SELECT 1 FROM invoice_item WHERE invoice_id = NEW.invoice_id) THEN
        RAISE EXCEPTION 'An invoice needs at least one line' USING ERRCODE = 'BR008';
      END IF;
      PERFORM period_for(NEW.invoice_date);                 -- raises BR004 if that month is closed
      NEW.invoice_no := next_doc_no('INV', NEW.invoice_date);
      NEW.issued_at  := now();
    ELSIF NEW.status = 'void' AND OLD.status <> 'void' THEN
      IF EXISTS (SELECT 1 FROM dispatch WHERE invoice_id = NEW.invoice_id AND status <> 'cancelled') THEN
        RAISE EXCEPTION 'Un-link or re-invoice the dispatches before voiding this invoice' USING ERRCODE = 'BR008';
      END IF;
      IF EXISTS (SELECT 1 FROM payment_allocation a JOIN buyer_payment p USING (payment_id)
                  WHERE a.invoice_id = NEW.invoice_id AND p.status = 'recorded') THEN
        RAISE EXCEPTION 'Reverse the payments allocated to this invoice before voiding it' USING ERRCODE = 'BR008';
      END IF;
      IF OLD.status = 'issued' THEN PERFORM period_for(OLD.invoice_date); END IF;   -- cannot void into a closed month
      NEW.voided_at := now();
      NEW.voided_by := app_current_user_id();
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_invoice_before BEFORE INSERT OR UPDATE ON invoice
  FOR EACH ROW EXECUTE FUNCTION trg_invoice_before();

CREATE FUNCTION trg_invoice_item_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT oo.buyer_id FROM order_item oi JOIN customer_order oo USING (order_id) WHERE oi.order_item_id = NEW.order_item_id)
     <> (SELECT buyer_id FROM invoice WHERE invoice_id = NEW.invoice_id) THEN
    RAISE EXCEPTION 'Invoice line belongs to an order of a different buyer' USING ERRCODE = 'BR008';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_invoice_item_before BEFORE INSERT OR UPDATE OF order_item_id, invoice_id ON invoice_item
  FOR EACH ROW EXECUTE FUNCTION trg_invoice_item_before();

CREATE FUNCTION trg_invoice_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
  UPDATE invoice SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM invoice_item WHERE invoice_id = v_id)
   WHERE invoice_id = v_id;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_invoice_total AFTER INSERT OR UPDATE OR DELETE ON invoice_item
  FOR EACH ROW EXECUTE FUNCTION trg_invoice_total();

-- INV-6: allocations can never exceed the payment or the invoice. Lock order is ALWAYS payment first, then invoice.
CREATE FUNCTION trg_alloc_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p buyer_payment%ROWTYPE; i invoice%ROWTYPE; v_pay_sum money_t; v_inv_sum money_t;
BEGIN
  SELECT * INTO p FROM buyer_payment WHERE payment_id = NEW.payment_id FOR UPDATE;
  SELECT * INTO i FROM invoice       WHERE invoice_id = NEW.invoice_id FOR UPDATE;
  IF p.status <> 'recorded' THEN RAISE EXCEPTION 'Payment is reversed' USING ERRCODE = 'BR006'; END IF;
  IF i.status <> 'issued'   THEN RAISE EXCEPTION 'Only issued invoices can be paid (invoice is %)', i.status USING ERRCODE = 'BR006'; END IF;
  IF p.buyer_id <> i.buyer_id THEN RAISE EXCEPTION 'Payment and invoice belong to different buyers' USING ERRCODE = 'BR006'; END IF;

  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_pay_sum FROM payment_allocation WHERE payment_id = NEW.payment_id;
  IF v_pay_sum + NEW.allocated_amount > p.amount THEN
    RAISE EXCEPTION 'Allocations would exceed the payment amount' USING ERRCODE = 'BR006';
  END IF;
  SELECT COALESCE(SUM(a.allocated_amount), 0) INTO v_inv_sum
    FROM payment_allocation a JOIN buyer_payment bp USING (payment_id)
   WHERE a.invoice_id = NEW.invoice_id AND bp.status = 'recorded';
  IF v_inv_sum + NEW.allocated_amount > i.total_amount THEN
    RAISE EXCEPTION 'Allocations would exceed the invoice total' USING ERRCODE = 'BR006';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_alloc_before BEFORE INSERT ON payment_allocation
  FOR EACH ROW EXECUTE FUNCTION trg_alloc_before();

CREATE FUNCTION trg_payment_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'reversed' AND OLD.status = 'recorded' THEN
    NEW.reversed_at := now();
    NEW.reversed_by := app_current_user_id();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_payment_before BEFORE UPDATE ON buyer_payment
  FOR EACH ROW EXECUTE FUNCTION trg_payment_before();
```

### 10.8 Wages and cost (FR-6.2, INV-7, INV-11)

```sql
CREATE FUNCTION trg_attendance_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM wage_record w JOIN accounting_period p USING (period_id)
              WHERE w.employee_id = NEW.employee_id AND w.status = 'approved'
                AND NEW.work_date BETWEEN p.period_start AND p.period_end) THEN
    RAISE EXCEPTION 'Wages for this employee and month are already approved; reverse them before changing attendance'
      USING ERRCODE = 'BR004';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_attendance_guard BEFORE INSERT OR UPDATE ON attendance_record
  FOR EACH ROW EXECUTE FUNCTION trg_attendance_guard();

CREATE FUNCTION trg_wage_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT status FROM accounting_period WHERE period_id = NEW.period_id) <> 'open' THEN
      RAISE EXCEPTION 'Cannot create wages in a closed period' USING ERRCODE = 'BR004';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'draft'
     AND (NEW.employee_id, NEW.period_id, NEW.gross_amount, NEW.basis_note)
         IS DISTINCT FROM (OLD.employee_id, OLD.period_id, OLD.gross_amount, OLD.basis_note) THEN
    RAISE EXCEPTION 'Approved wages cannot be edited; reverse and re-create' USING ERRCODE = 'BR003';
  END IF;
  IF NEW.status = 'approved' AND OLD.status = 'draft' THEN
    IF (SELECT status FROM accounting_period WHERE period_id = NEW.period_id) <> 'open' THEN
      RAISE EXCEPTION 'Cannot approve wages in a closed period' USING ERRCODE = 'BR004';
    END IF;
    NEW.approved_at := now();
    NEW.approved_by := app_current_user_id();
  ELSIF NEW.status = 'reversed' AND OLD.status = 'approved' THEN
    NEW.reversed_at := now();
    NEW.reversed_by := app_current_user_id();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_wage_before BEFORE INSERT OR UPDATE ON wage_record
  FOR EACH ROW EXECUTE FUNCTION trg_wage_before();

-- Q7 default: one plant-level (indirect) wage cost entry per approved wage record; reversal posts a negative twin
CREATE FUNCTION trg_wage_cost() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_orig bigint;
BEGIN
  IF NEW.status = 'approved' THEN
    INSERT INTO cost_entry (cost_type, amount, period_id, wage_id)
    VALUES ('wage', NEW.gross_amount, NEW.period_id, NEW.wage_id);
  ELSIF NEW.status = 'reversed' THEN
    SELECT cost_id INTO v_orig FROM cost_entry WHERE wage_id = NEW.wage_id AND reverses_cost_id IS NULL;
    INSERT INTO cost_entry (cost_type, amount, period_id, wage_id, reverses_cost_id)
    VALUES ('wage', -NEW.gross_amount, period_for((now() AT TIME ZONE 'Asia/Kolkata')::date), NEW.wage_id, v_orig);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_wage_cost AFTER UPDATE OF status ON wage_record
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_wage_cost();
```

### 10.9 Audit trail

```sql
-- SECURITY DEFINER: application roles get NO insert privilege on audit_log; only this function (owned by the migration role) writes it.
-- Args: [0] = primary-key column name, [1] = optional 'status' => only log UPDATEs that change status.
CREATE FUNCTION trg_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before jsonb; v_after jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND TG_ARGV[1] = 'status'
     AND (to_jsonb(OLD) ->> 'status') IS NOT DISTINCT FROM (to_jsonb(NEW) ->> 'status') THEN
    RETURN NULL;                              -- status-only mode: ignore updates that did not change the status
  END IF;
  IF TG_OP <> 'INSERT' THEN v_before := to_jsonb(OLD) - 'password_hash'; END IF;
  IF TG_OP <> 'DELETE' THEN v_after  := to_jsonb(NEW) - 'password_hash'; END IF;
  INSERT INTO audit_log (actor_id, action, entity_name, entity_id, before_data, after_data, reason, source)
  VALUES (COALESCE(app_current_user_id(), (SELECT user_id FROM app_user WHERE username = 'system')),
          TG_OP, TG_TABLE_NAME, COALESCE(v_after, v_before) ->> TG_ARGV[0], v_before, v_after,
          NULLIF(current_setting('app.reason', true), ''), NULLIF(current_setting('app.source', true), ''));
  RETURN NULL;
END $$;

-- sensitive master/user data: log every change
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON employee         FOR EACH ROW EXECUTE FUNCTION trg_audit('employee_id');
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OF username, password_hash, employee_id, is_active OR DELETE ON app_user
  FOR EACH ROW EXECUTE FUNCTION trg_audit('user_id');            -- not last_login_at: logins would flood the log
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON user_role        FOR EACH ROW EXECUTE FUNCTION trg_audit('user_id');
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON wage_record      FOR EACH ROW EXECUTE FUNCTION trg_audit('wage_id');
CREATE TRIGGER trg_audit AFTER UPDATE OR DELETE           ON attendance_record FOR EACH ROW EXECUTE FUNCTION trg_audit('attendance_id');
CREATE TRIGGER trg_audit AFTER UPDATE                     ON order_item       FOR EACH ROW EXECUTE FUNCTION trg_audit('order_item_id');
CREATE TRIGGER trg_audit AFTER UPDATE                     ON yarn_item        FOR EACH ROW EXECUTE FUNCTION trg_audit('yarn_item_id');
-- cancellations, voids, reversals, period close: log status changes
CREATE TRIGGER trg_audit AFTER UPDATE ON customer_order    FOR EACH ROW EXECUTE FUNCTION trg_audit('order_id', 'status');
CREATE TRIGGER trg_audit AFTER UPDATE ON goods_receipt     FOR EACH ROW EXECUTE FUNCTION trg_audit('receipt_id', 'status');
CREATE TRIGGER trg_audit AFTER UPDATE ON dispatch          FOR EACH ROW EXECUTE FUNCTION trg_audit('dispatch_id', 'status');
CREATE TRIGGER trg_audit AFTER UPDATE ON invoice           FOR EACH ROW EXECUTE FUNCTION trg_audit('invoice_id', 'status');
CREATE TRIGGER trg_audit AFTER UPDATE ON buyer_payment     FOR EACH ROW EXECUTE FUNCTION trg_audit('payment_id', 'status');
CREATE TRIGGER trg_audit AFTER UPDATE ON supplier_bill     FOR EACH ROW EXECUTE FUNCTION trg_audit('bill_id', 'status');
CREATE TRIGGER trg_audit AFTER UPDATE ON accounting_period FOR EACH ROW EXECUTE FUNCTION trg_audit('period_id', 'status');
-- stock adjustments and reversals (rows are immutable, so INSERT is the only event)
CREATE TRIGGER trg_audit AFTER INSERT ON yarn_stock_movement
  FOR EACH ROW WHEN (NEW.movement_type IN ('adjustment', 'reversal')) EXECUTE FUNCTION trg_audit('movement_id');
```

### 10.10 Attaching the generic triggers

```sql
DO $$
DECLARE t text;
BEGIN
  -- updated_at / updated_by
  FOREACH t IN ARRAY ARRAY['app_user','employee','supplier','buyer','yarn_type','colour','yarn_item','fabric_product',
                           'process_stage','machine','shift','defect_type','order_item','purchase_order_item',
                           'goods_receipt','supplier_bill','yarn_reservation','stock_alert','invoice_item',
                           'accounting_period','attendance_record','wage_record'] LOOP
    EXECUTE format('CREATE TRIGGER trg_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trg_touch()', t);
  END LOOP;

  -- updated_at / updated_by + version counter (optimistic concurrency)
  FOREACH t IN ARRAY ARRAY['customer_order','purchase_order','production_job','fabric_roll','dispatch','invoice'] LOOP
    EXECUTE format('CREATE TRIGGER trg_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trg_touch_versioned()', t);
  END LOOP;

  -- state machines
  FOREACH t IN ARRAY ARRAY['customer_order','production_job','fabric_roll','dispatch','goods_receipt','purchase_order',
                           'yarn_reservation','stock_alert','invoice','buyer_payment','wage_record','accounting_period',
                           'supplier_bill'] LOOP
    EXECUTE format('CREATE TRIGGER trg_transition BEFORE INSERT OR UPDATE OF status ON %1$I
                    FOR EACH ROW EXECUTE FUNCTION trg_enforce_transition(%1$L)', t);
  END LOOP;

  -- append-only ledgers / history: no UPDATE, no DELETE, no TRUNCATE
  FOREACH t IN ARRAY ARRAY['yarn_stock_movement','production_log','qc_inspection','qc_defect','payment_allocation',
                           'cost_entry','order_status_history','audit_log','goods_receipt_item','supplier_bill_line'] LOOP
    EXECUTE format('CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION trg_block_mutation()', t);
    EXECUTE format('CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION trg_block_mutation()', t);
  END LOOP;

  -- never physically deleted (masters, documents, ledgers with controlled updates)
  FOREACH t IN ARRAY ARRAY['app_user','employee','supplier','buyer','unit_of_measure','yarn_type','colour','yarn_item',
                           'fabric_product','process_stage','machine','shift','defect_type','customer_order',
                           'purchase_order','goods_receipt','supplier_bill','yarn_stock_balance','stock_alert',
                           'yarn_reservation','production_job','machine_status_event','fabric_roll','invoice',
                           'dispatch','dispatch_item','buyer_payment','accounting_period','attendance_record',
                           'wage_record'] LOOP
    EXECUTE format('CREATE TRIGGER trg_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION trg_block_delete()', t);
  END LOOP;
END $$;

-- immutable-after-posting headers: only the listed columns may change
CREATE TRIGGER trg_immutable BEFORE UPDATE ON goods_receipt FOR EACH ROW EXECUTE FUNCTION trg_only_columns_may_change(
  'status','cancelled_at','cancelled_by','cancel_reason','updated_at','updated_by');
CREATE TRIGGER trg_immutable BEFORE UPDATE ON supplier_bill FOR EACH ROW EXECUTE FUNCTION trg_only_columns_may_change(
  'status','voided_at','voided_by','void_reason','total_amount','updated_at','updated_by');
CREATE TRIGGER trg_immutable BEFORE UPDATE ON buyer_payment FOR EACH ROW EXECUTE FUNCTION trg_only_columns_may_change(
  'status','reversed_at','reversed_by','reverse_reason');

-- draft-only child rows
CREATE TRIGGER trg_draft_only BEFORE INSERT OR DELETE ON order_item
  FOR EACH ROW EXECUTE FUNCTION trg_parent_must_be_draft('customer_order', 'order_id', 'order_id');
CREATE TRIGGER trg_draft_only BEFORE INSERT OR UPDATE OR DELETE ON purchase_order_item
  FOR EACH ROW EXECUTE FUNCTION trg_parent_must_be_draft('purchase_order', 'po_id', 'po_id');
CREATE TRIGGER trg_draft_only BEFORE INSERT OR UPDATE OR DELETE ON invoice_item
  FOR EACH ROW EXECUTE FUNCTION trg_parent_must_be_draft('invoice', 'invoice_id', 'invoice_id');

-- order lines: product / colour / unit are frozen once the order leaves draft (quantity and rate stay editable, audited)
CREATE FUNCTION trg_order_item_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.product_id, NEW.colour_id, NEW.unit_id, NEW.order_id, NEW.line_no)
       IS DISTINCT FROM (OLD.product_id, OLD.colour_id, OLD.unit_id, OLD.order_id, OLD.line_no)
     AND (SELECT status FROM customer_order WHERE order_id = OLD.order_id) <> 'draft' THEN
    RAISE EXCEPTION 'Product, colour and unit of a confirmed order line cannot change' USING ERRCODE = 'BR003';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_order_item_update BEFORE UPDATE ON order_item
  FOR EACH ROW EXECUTE FUNCTION trg_order_item_update();
```

---

## 11. Custom error codes (for the application layer)

| SQLSTATE | Meaning | Typical user message |
|---|---|---|
| `BR001` | Append-only / never-deleted row touched | "This record cannot be changed or deleted. Use cancel / reverse." |
| `BR002` | Illegal status transition | "That status change is not allowed from the current state." |
| `BR003` | Immutable field or locked parent document | "This field can no longer be changed." |
| `BR004` | Accounting period closed / wages already approved | "That month is closed." |
| `BR005` | Roll not dispatchable (not `in_stock`) | "Roll is not available for dispatch." |
| `BR006` | Payment / invoice allocation violation | "Allocation exceeds the payment or invoice balance." |
| `BR007` | Dispatch state / order mismatch | "This roll does not belong to this order, or the load is closed." |
| `BR008` | Invoice rule (empty, wrong buyer, links) | "Invoice cannot be issued / voided in its current state." |
| `BR009` | QC rule (roll not awaiting QC, missing defect) | "Roll is not awaiting inspection." |
| `BR010` | Production / order lifecycle rule | "Job or order is not in a valid state for this action." |
| `BR011` | Reversal or billing quantity rule | "Reversal / billed quantity is not valid." |
| `23505` | Unique violation (built-in) | Look at constraint name: `uq_dispatch_item_one_active_roll` → "Roll already on another active dispatch"; `uq_job_one_running_per_machine` → "Machine already has a running job"; any `client_request_id` constraint → treat as **duplicate request** (return the original result) |
| `23503` | Foreign-key violation | "Referenced record does not exist." |
| `23514` | Check violation | Constraint `ck_balance_not_negative` → "Insufficient stock"; `ck_reserved_within_on_hand` → "Stock is reserved for other orders" |
| `23P01` | Exclusion violation | "Overlapping period for this machine / accounting period." |
| `40001` / `40P01` | Serialization failure / deadlock | Retry the whole transaction (doc 05 §2) |

---

## 12. Smoke test (run on an empty scratch database after all migrations)

```sql
-- Use a NEW session (the seed script set app.user_id at session level; a fresh connection starts without it).
BEGIN;
SET LOCAL app.user_id = '1';                         -- the 'system' user created by the seed (first identity value)

INSERT INTO supplier (name) VALUES ('Test Yarns');
INSERT INTO yarn_type (name) VALUES ('30s cotton');
INSERT INTO colour (name) VALUES ('white');
INSERT INTO yarn_item (yarn_type_id, colour_id, unit_id, reorder_level)
  SELECT 1, 1, unit_id, 100 FROM unit_of_measure WHERE unit_code = 'kg';

-- 1. gate entry posts stock + weighted average automatically
INSERT INTO goods_receipt (supplier_id, client_request_id) VALUES (1, gen_random_uuid());
INSERT INTO goods_receipt_item (receipt_id, yarn_item_id, quantity_received, unit_rate) VALUES (1, 1, 500, 200);
SELECT on_hand_qty, avg_cost FROM yarn_stock_balance WHERE yarn_item_id = 1;     -- expect 500.000, 200.0000

-- 2. negative stock is rejected
SAVEPOINT s1;
INSERT INTO yarn_stock_movement (yarn_item_id, movement_type, quantity, reason, client_request_id)
VALUES (1, 'adjustment', -600, 'test', gen_random_uuid());
-- expect: ERROR 23514 ck_balance_not_negative
ROLLBACK TO s1;

-- 3. ledger rows are immutable
SAVEPOINT s2;
UPDATE yarn_stock_movement SET quantity = 1;      -- expect: ERROR BR001
ROLLBACK TO s2;

-- 4. skipping the session user is impossible
ROLLBACK;
BEGIN;
INSERT INTO supplier (name) VALUES ('Anonymous');   -- expect: ERROR 23502 (created_by NOT NULL)
ROLLBACK;
```

Full schema, concurrency and integrity tests are specified in `09-database-testing-plan.md` (later phase).

---

## 13. Coverage check

### 13.1 Invariants (doc 03 §4.3) → mechanism

| Invariant | Enforced by |
|---|---|
| INV-1 balance = ledger sum, never negative | `trg_movement_apply` is the only writer of `yarn_stock_balance`; `ck_balance_not_negative`; row lock via `FOR UPDATE`; reconciliation view (doc 06) |
| INV-2 one active dispatch line per roll | `uq_dispatch_item_one_active_roll` (partial unique) + `trg_dispatch_item_before` |
| INV-3 one running job / one open event per machine | `uq_job_one_running_per_machine`, `uq_mse_one_open`, `ex_mse_no_overlap` |
| INV-4 job machine/order item frozen after start | `trg_job_before` |
| INV-5 only `in_stock` rolls can be dispatched | `trg_dispatch_item_before` (row-locks the roll) |
| INV-6 allocations ≤ payment and ≤ invoice | `trg_alloc_before` (locks payment then invoice) |
| INV-7 one cost source | `ck_cost_source` |
| INV-8 inspection + roll status atomic | `trg_qc_before` (updates the roll inside the inspection insert) |
| INV-9 reservations ≤ on-hand | `ck_reserved_within_on_hand` + `trg_reservation_apply` |
| INV-10 ledgers append-only | `trg_append_only`, `trg_no_truncate`, `trg_only_columns_may_change` (+ revoked UPDATE/DELETE privileges in doc 07) |
| INV-11 closed period rejects postings | `period_for`, `trg_cost_before`, `trg_wage_before`, `trg_attendance_guard`, `trg_invoice_before` |

### 13.2 Business rules (doc 01 §6) → mechanism

| Rule | Mechanism |
|---|---|
| BR-1 no negative stock | `ck_balance_not_negative` |
| BR-2 receipt identifies supplier, yarn, colour, qty | `goods_receipt.supplier_id`, `goods_receipt_item.yarn_item_id` (type × colour), `quantity_received > 0`, all `NOT NULL` |
| BR-3 one active job per machine | `uq_job_one_running_per_machine` |
| BR-4 roll references order and machine | `fabric_roll.job_id NOT NULL` → job → machine/order item; machine-stage composite FK |
| BR-5 roll status limited | `CHECK` on `fabric_roll.status` + state machine |
| BR-6 only passed rolls dispatched | `trg_dispatch_item_before` |
| BR-7 no double dispatch | `uq_dispatch_item_one_active_roll` |
| BR-8 dispatch ↔ buyer ↔ invoice | `fk_dispatch_order_buyer`, `fk_dispatch_invoice_buyer`, roll-belongs-to-order check |
| BR-9 cost attributable | `ck_cost_material_has_order`, `ck_cost_source` |
| BR-10 ledgers append-only | see INV-10 |
| BR-11 order status consistent | operational stage is a view (doc 06); stored status is commercial only; `trg_order_before` blocks cancel while work is live |

### 13.3 Entity checklist

All 46 entities of doc 03 §2 are created: `role`, `app_user`, `user_role`, `employee` · `supplier`, `buyer`, `unit_of_measure`, `yarn_type`, `colour`, `yarn_item`, `fabric_product`, `process_stage`, `machine`, `shift`, `defect_type` · `purchase_order`, `purchase_order_item`, `goods_receipt`, `goods_receipt_item`, `yarn_stock_movement`, `yarn_stock_balance`, `stock_alert`, `supplier_bill`, `supplier_bill_line` · `customer_order`, `order_item`, `order_status_history`, `order_material_requirement`, `yarn_reservation` · `production_job`, `production_log`, `machine_status_event` · `fabric_roll`, `qc_inspection`, `qc_defect` · `dispatch`, `dispatch_item`, `invoice`, `invoice_item` · `buyer_payment`, `payment_allocation`, `attendance_record`, `accounting_period`, `wage_record`, `cost_entry` · `audit_log`. Two support tables are added: `status_transition`, `doc_sequence` (48 total).

---

## 14. Open items carried forward

| Item | Where it is resolved |
|---|---|
| Role-based `GRANT`s, column-level privilege on `employee.pay_rate` / `wage_record.gross_amount`, row-level rules, password hashing policy | `07-data-integrity-and-security.md` |
| Backup, migration tooling, rollback, partitioning of `audit_log` / ledgers | `08-migrations-and-maintenance.md` |
| Executable test cases for every constraint and trigger above | `09-database-testing-plan.md` |
| Answers to Q3 / Q6 / Q7 / Q9 (Section 1) | Mill owner; changes are small and listed per question |
