-- ============================================================================
-- Migration 0002: Access, People and Master Data
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- ============================================================================

CREATE TABLE IF NOT EXISTS role (
  role_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_name   text NOT NULL UNIQUE,
  description text
);

CREATE TABLE IF NOT EXISTS app_user (
  user_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username       text    NOT NULL,
  password_hash  text    NOT NULL,                 -- output of argon2id/bcrypt only; never plaintext
  employee_id    bigint,                           -- FK added after employee table is created
  is_active      boolean NOT NULL DEFAULT true,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     bigint REFERENCES app_user (user_id),       -- NULL only for the bootstrap 'system' user
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     bigint REFERENCES app_user (user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_username ON app_user (lower(username));

CREATE TABLE IF NOT EXISTS user_role (
  user_id    bigint NOT NULL REFERENCES app_user (user_id) ON DELETE CASCADE,
  role_id    bigint NOT NULL REFERENCES role (role_id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by bigint DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS employee (
  employee_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_code text    NOT NULL UNIQUE,
  full_name     text    NOT NULL,
  designation   text,
  pay_basis     text    NOT NULL CHECK (pay_basis IN ('daily', 'monthly', 'piece_rate')),
  pay_rate      money_t NOT NULL CHECK (pay_rate >= 0),     -- SENSITIVE: restricted column privileges
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

-- Link app_user to employee (1 : 0..1 relationship)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_app_user_employee') THEN
    ALTER TABLE app_user ADD CONSTRAINT fk_app_user_employee FOREIGN KEY (employee_id) REFERENCES employee (employee_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_employee ON app_user (employee_id) WHERE employee_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS unit_of_measure (
  unit_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_code   text NOT NULL UNIQUE,            -- 'kg', 'm', 'pcs'
  description text
);

CREATE TABLE IF NOT EXISTS supplier (
  supplier_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  contact     text,
  tax_id      text,                            -- optional GST / Tax ID
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_name ON supplier (lower(name));

CREATE TABLE IF NOT EXISTS buyer (
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
CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_name ON buyer (lower(name));

CREATE TABLE IF NOT EXISTS yarn_type (
  yarn_type_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL UNIQUE,
  specification text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

CREATE TABLE IF NOT EXISTS colour (
  colour_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

CREATE TABLE IF NOT EXISTS yarn_item (                               -- Stockable raw material (yarn type x colour)
  yarn_item_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  yarn_type_id  bigint NOT NULL REFERENCES yarn_type (yarn_type_id),
  colour_id     bigint NOT NULL REFERENCES colour (colour_id),
  unit_id       bigint NOT NULL REFERENCES unit_of_measure (unit_id),
  reorder_level qty_t  NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),   -- Low-stock threshold (FR-1.3)
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_yarn_item UNIQUE (yarn_type_id, colour_id)
);

CREATE TABLE IF NOT EXISTS fabric_product (
  product_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL UNIQUE,
  specification text,
  unit_id       bigint NOT NULL REFERENCES unit_of_measure (unit_id),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_fabric_product_unit UNIQUE (product_id, unit_id)       -- Target of composite FK from order_item
);

CREATE TABLE IF NOT EXISTS process_stage (
  stage_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL UNIQUE,                  -- spinning, weaving, dyeing
  sequence_hint smallint,                              -- advisory sequence
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

CREATE TABLE IF NOT EXISTS machine (
  machine_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  machine_code text   NOT NULL UNIQUE,
  stage_id     bigint NOT NULL REFERENCES process_stage (stage_id),
  description  text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  CONSTRAINT uq_machine_stage UNIQUE (machine_id, stage_id)            -- Target of composite FK from production_job
);

CREATE TABLE IF NOT EXISTS shift (
  shift_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  starts_at  time NOT NULL,
  ends_at    time NOT NULL,                            -- may cross midnight
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);

CREATE TABLE IF NOT EXISTS defect_type (
  defect_type_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           text NOT NULL UNIQUE,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     bigint NOT NULL DEFAULT app_current_user_id() REFERENCES app_user (user_id)
);
