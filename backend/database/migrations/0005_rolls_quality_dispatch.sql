-- ============================================================================
-- Migration 0005: Fabric Rolls, Quality Inspections, Invoices & Dispatch
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- ============================================================================

CREATE TABLE IF NOT EXISTS fabric_roll (
  roll_id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  roll_code         text   NOT NULL UNIQUE DEFAULT make_code('R', 'seq_roll_code'),   -- Barcode / QR identifier
  job_id            bigint NOT NULL REFERENCES production_job (job_id),               -- Links to machine, order, buyer
  client_request_id uuid   NOT NULL UNIQUE,                                          -- Idempotent roll creation
  operator_id       bigint REFERENCES employee (employee_id),
  length_m          qty_t  NOT NULL CHECK (length_m > 0),
  weight_kg         qty_t  CHECK (weight_kg IS NULL OR weight_kg > 0),
  status            text   NOT NULL DEFAULT 'pending_qc'
                    CHECK (status IN ('pending_qc', 'in_stock', 'rework', 'rejected', 'loaded', 'dispatched', 'scrapped')),
  shelf_location    text,
  version           int    NOT NULL DEFAULT 1,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

CREATE TABLE IF NOT EXISTS qc_inspection (                                 -- Append-only inspection log
  inspection_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  roll_id       bigint NOT NULL REFERENCES fabric_roll (roll_id),
  inspector_id  bigint NOT NULL REFERENCES employee (employee_id),
  attempt_no    int    NOT NULL,                              -- 1, 2, ... after rework
  result        text   NOT NULL CHECK (result IN ('passed', 'rework', 'rejected')),
  inspected_at  timestamptz NOT NULL DEFAULT now(),
  remarks       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_inspection_attempt UNIQUE (roll_id, attempt_no)
);

CREATE TABLE IF NOT EXISTS qc_defect (                                     -- Append-only defect incident ledger
  defect_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inspection_id  bigint NOT NULL REFERENCES qc_inspection (inspection_id),
  defect_type_id bigint NOT NULL REFERENCES defect_type (defect_type_id),
  severity       text   NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
  defect_count   int    NOT NULL DEFAULT 1 CHECK (defect_count > 0),
  position_note  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

-- ===================== Invoices =====================
CREATE TABLE IF NOT EXISTS invoice (
  invoice_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_no   text   UNIQUE,                                  -- Assigned at issue; gap-free via doc_sequence
  buyer_id     bigint NOT NULL REFERENCES buyer (buyer_id),
  invoice_date date   NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  total_amount money_t NOT NULL DEFAULT 0,                     -- Maintained by trigger from lines
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
  CONSTRAINT ck_invoice_has_number  CHECK (status = 'draft' OR invoice_no IS NOT NULL OR (status = 'void' AND issued_at IS NULL)),
  CONSTRAINT ck_invoice_void_reason CHECK (status <> 'void' OR (void_reason IS NOT NULL AND voided_at IS NOT NULL)),
  CONSTRAINT uq_invoice_buyer UNIQUE (invoice_id, buyer_id)    -- Target of composite FK from dispatch
);

CREATE TABLE IF NOT EXISTS invoice_item (
  invoice_item_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id      bigint  NOT NULL REFERENCES invoice (invoice_id),
  order_item_id   bigint  NOT NULL REFERENCES order_item (order_item_id),
  quantity        qty_t   NOT NULL CHECK (quantity > 0),
  rate            rate_t  NOT NULL CHECK (rate >= 0),           -- Price snapshot
  amount          money_t NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_invoice_item_amount CHECK (amount = round(quantity * rate, 2)),
  CONSTRAINT uq_invoice_item UNIQUE (invoice_id, order_item_id)
);

-- ===================== Dispatch =====================
CREATE TABLE IF NOT EXISTS dispatch (
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
  CONSTRAINT fk_dispatch_order_buyer   FOREIGN KEY (order_id, buyer_id)   REFERENCES customer_order (order_id, buyer_id),
  CONSTRAINT fk_dispatch_invoice_buyer FOREIGN KEY (invoice_id, buyer_id) REFERENCES invoice (invoice_id, buyer_id),
  CONSTRAINT ck_dispatch_sent   CHECK (status <> 'dispatched' OR (dispatched_at IS NOT NULL AND vehicle_no IS NOT NULL)),
  CONSTRAINT ck_dispatch_cancel CHECK (status <> 'cancelled' OR (cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS dispatch_item (
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

-- INV-2 / BR-7: A roll can be on at most ONE active dispatch line (the "no double dispatch" rule)
CREATE UNIQUE INDEX IF NOT EXISTS uq_dispatch_item_one_active_roll ON dispatch_item (roll_id) WHERE state = 'active';
