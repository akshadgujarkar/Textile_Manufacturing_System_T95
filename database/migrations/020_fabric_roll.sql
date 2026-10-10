-- Migration: 020_fabric_roll.sql
-- Depends on: production_job, employee
-- Run order: 20

CREATE TABLE IF NOT EXISTS fabric_roll (
  roll_id        INT           NOT NULL AUTO_INCREMENT,
  roll_code      VARCHAR(50)   NOT NULL,
  job_id         INT           NOT NULL,
  operator_id    INT           NOT NULL,
  length_m       DECIMAL(10,2) NOT NULL,
  weight_kg      DECIMAL(10,3) NOT NULL,
  gsm            DECIMAL(6,2)  NULL,
  width_inches   DECIMAL(5,2)  NULL,
  status         VARCHAR(20)   NOT NULL DEFAULT 'pending_qc',
  shelf_location VARCHAR(50)   NULL,
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version        INT           NOT NULL DEFAULT 1,

  PRIMARY KEY (roll_id),
  UNIQUE KEY uq_fabric_roll_code (roll_code),

  KEY idx_roll_job (job_id),
  KEY idx_roll_operator (operator_id),
  KEY idx_roll_status (status),

  CONSTRAINT fk_roll_job
    FOREIGN KEY (job_id) REFERENCES production_job (job_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_roll_operator
    FOREIGN KEY (operator_id) REFERENCES employee (employee_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_roll_length
    CHECK (length_m > 0),

  CONSTRAINT chk_roll_weight
    CHECK (weight_kg > 0),

  CONSTRAINT chk_roll_status
    CHECK (status IN ('pending_qc', 'in_stock', 'rework', 'rejected', 'loaded', 'dispatched', 'scrapped'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
