-- ============================================================================
-- Migration 0004: Production Floor, Stock Movement Ledger, Balance & Reservations
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- ============================================================================

-- ===================== Production Floor =====================
CREATE TABLE IF NOT EXISTS production_job (
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
      REFERENCES machine (machine_id, stage_id),                -- Machine can only run jobs of its own stage
  CONSTRAINT ck_job_started CHECK (status IN ('planned', 'cancelled') OR started_at IS NOT NULL),
  CONSTRAINT ck_job_ended   CHECK (status <> 'completed' OR ended_at IS NOT NULL),
  CONSTRAINT ck_job_times   CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

-- INV-3 / BR-3: A machine runs at most one job at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_one_running_per_machine ON production_job (machine_id) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS production_log (                                -- Append-only output ledger
  log_id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id            bigint NOT NULL REFERENCES production_job (job_id),
  shift_id          bigint NOT NULL REFERENCES shift (shift_id),
  operator_id       bigint REFERENCES employee (employee_id),             -- Optional operator attribution
  output_qty        qty_t  NOT NULL,                                     -- Positive output, or negative correction
  logged_at         timestamptz NOT NULL DEFAULT now(),
  client_request_id uuid   NOT NULL UNIQUE,
  reverses_log_id   bigint UNIQUE REFERENCES production_log (log_id),    -- A log entry can be corrected at most once
  reason            text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_log_qty CHECK (output_qty > 0 OR (output_qty < 0 AND reverses_log_id IS NOT NULL AND reason IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS machine_status_event (                          -- State periods (running, idle, breakdown, maintenance)
  event_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  machine_id  bigint NOT NULL REFERENCES machine (machine_id),
  state       text   NOT NULL CHECK (state IN ('running', 'idle', 'breakdown', 'maintenance')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,                                  -- NULL while period is ongoing
  note        text,
  reported_by bigint REFERENCES employee (employee_id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_mse_range CHECK (ended_at IS NULL OR ended_at >= started_at),
  -- Prevent overlapping time periods for the same machine
  CONSTRAINT ex_mse_no_overlap EXCLUDE USING gist (machine_id WITH =, tstzrange(started_at, ended_at) WITH &&)
);

-- INV-3: At most one open (current) status event per machine
CREATE UNIQUE INDEX IF NOT EXISTS uq_mse_one_open ON machine_status_event (machine_id) WHERE ended_at IS NULL;

-- ===================== Yarn Stock Ledger & Cached Balance =====================
CREATE TABLE IF NOT EXISTS yarn_stock_movement (                           -- Append-only; Source of truth for yarn stock
  movement_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  yarn_item_id         bigint NOT NULL REFERENCES yarn_item (yarn_item_id),
  movement_type        text   NOT NULL CHECK (movement_type IN ('receipt', 'issue', 'return', 'adjustment', 'reversal')),
  quantity             qty_t  NOT NULL,                        -- Signed: + into store, - out of store
  unit_cost            rate_t NOT NULL CHECK (unit_cost >= 0), -- Valuation snapshot
  receipt_item_id      bigint REFERENCES goods_receipt_item (receipt_item_id),
  production_job_id    bigint REFERENCES production_job (job_id),
  reverses_movement_id bigint UNIQUE REFERENCES yarn_stock_movement (movement_id),
  reason               text,
  client_request_id    uuid UNIQUE,                            -- Duplicate-submit guard
  occurred_at          timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT ck_movement_idempotent CHECK (movement_type IN ('receipt', 'reversal') OR client_request_id IS NOT NULL),
  CONSTRAINT ck_movement_shape CHECK (
       (movement_type = 'receipt'    AND quantity > 0 AND receipt_item_id IS NOT NULL)
    OR (movement_type = 'issue'      AND quantity < 0 AND production_job_id IS NOT NULL)
    OR (movement_type = 'return'     AND quantity > 0 AND production_job_id IS NOT NULL)
    OR (movement_type = 'adjustment' AND quantity <> 0 AND reason IS NOT NULL)
    OR (movement_type = 'reversal'   AND quantity <> 0 AND reverses_movement_id IS NOT NULL AND reason IS NOT NULL))
);

-- Each receipt line posts exactly one receipt movement (idempotent posting)
CREATE UNIQUE INDEX IF NOT EXISTS uq_movement_one_receipt_per_line ON yarn_stock_movement (receipt_item_id) WHERE movement_type = 'receipt';

CREATE TABLE IF NOT EXISTS yarn_stock_balance (                            -- Cached; maintained by triggers
  yarn_item_id bigint PRIMARY KEY REFERENCES yarn_item (yarn_item_id),
  on_hand_qty  qty_t  NOT NULL DEFAULT 0,
  reserved_qty qty_t  NOT NULL DEFAULT 0,
  avg_cost     rate_t NOT NULL DEFAULT 0,                      -- Weighted average cost
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_balance_not_negative CHECK (on_hand_qty >= 0),                 -- INV-1 / BR-1
  CONSTRAINT ck_reserved_not_negative CHECK (reserved_qty >= 0),
  CONSTRAINT ck_reserved_within_on_hand CHECK (reserved_qty <= on_hand_qty)    -- INV-9
);

CREATE TABLE IF NOT EXISTS stock_alert (
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_alert_one_live ON stock_alert (yarn_item_id) WHERE status IN ('open', 'acknowledged');

CREATE TABLE IF NOT EXISTS yarn_reservation (
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
