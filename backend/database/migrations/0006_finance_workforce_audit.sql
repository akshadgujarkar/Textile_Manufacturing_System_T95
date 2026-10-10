-- ============================================================================
-- Migration 0006: Accounting Periods, Payments, Wages, Cost Ledger & Audit Trail
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounting_period (
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

CREATE TABLE IF NOT EXISTS buyer_payment (                                 -- Financial ledger
  payment_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_ref       text    NOT NULL UNIQUE DEFAULT make_code('PAY', 'seq_payment_ref'),
  buyer_id          bigint  NOT NULL REFERENCES buyer (buyer_id),
  received_on       date    NOT NULL,
  amount            money_t NOT NULL CHECK (amount > 0),
  mode              text    NOT NULL CHECK (mode IN ('cash', 'cheque', 'bank_transfer', 'upi', 'other')),
  instrument_ref    text,                                      -- Cheque no. / UTR
  status            text    NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'reversed')),
  reversed_at       timestamptz,
  reversed_by       bigint REFERENCES app_user (user_id),
  reverse_reason    text,
  client_request_id uuid    NOT NULL UNIQUE,                   -- Duplicate-submit guard
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_payment_reversed CHECK (status <> 'reversed' OR (reverse_reason IS NOT NULL AND reversed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS payment_allocation (                            -- Append-only allocation ledger
  allocation_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id       bigint  NOT NULL REFERENCES buyer_payment (payment_id),
  invoice_id       bigint  NOT NULL REFERENCES invoice (invoice_id),
  allocated_amount money_t NOT NULL CHECK (allocated_amount > 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

CREATE TABLE IF NOT EXISTS attendance_record (
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
       (status IN ('absent', 'leave')     AND hours_worked = 0)
    OR (status IN ('present', 'half_day') AND hours_worked > 0 AND hours_worked <= 24))
);

CREATE TABLE IF NOT EXISTS wage_record (
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_wage_live ON wage_record (employee_id, period_id) WHERE status <> 'reversed';

CREATE TABLE IF NOT EXISTS cost_entry (                                     -- Append-only cost ledger
  cost_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cost_type        text    NOT NULL CHECK (cost_type IN ('material', 'wage', 'overhead')),
  amount           money_t NOT NULL,                           -- Signed; reversals are negative
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
  -- INV-7: Exactly one source per cost entry
  CONSTRAINT ck_cost_source CHECK (
       (cost_type = 'material' AND movement_id IS NOT NULL AND wage_id IS NULL)
    OR (cost_type = 'wage'     AND wage_id     IS NOT NULL AND movement_id IS NULL)
    OR (cost_type = 'overhead' AND movement_id IS NULL     AND wage_id IS NULL AND description IS NOT NULL)),
  -- BR-9: Material cost always belongs to an order; wages/overhead may be plant-level
  CONSTRAINT ck_cost_material_has_order CHECK (cost_type <> 'material' OR order_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS audit_log (                                      -- Append-only audit trail
  audit_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id    bigint NOT NULL REFERENCES app_user (user_id),
  action      text   NOT NULL,                                 -- INSERT / UPDATE / DELETE
  entity_name text   NOT NULL,
  entity_id   text   NOT NULL,
  before_data jsonb,
  after_data  jsonb,
  reason      text,
  source      text
);
