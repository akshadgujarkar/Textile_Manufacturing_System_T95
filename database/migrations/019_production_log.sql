-- Migration: 019_production_log.sql
-- Depends on: production_job, employee
-- Run order: 19

CREATE TABLE IF NOT EXISTS production_log (
  log_id            INT           NOT NULL AUTO_INCREMENT,
  job_id            INT           NOT NULL,
  shift_code        VARCHAR(30)   NOT NULL,
  operator_id       INT           NOT NULL,
  output_qty        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  scrap_qty         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  power_kwh         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  logged_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  client_request_id VARCHAR(36)   NOT NULL,

  PRIMARY KEY (log_id),
  UNIQUE KEY uq_prod_log_client_request (client_request_id),

  KEY idx_prod_log_job (job_id),
  KEY idx_prod_log_operator (operator_id),
  KEY idx_prod_log_shift (shift_code),
  KEY idx_prod_log_logged_at (logged_at),

  CONSTRAINT fk_prod_log_job
    FOREIGN KEY (job_id) REFERENCES production_job (job_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_prod_log_operator
    FOREIGN KEY (operator_id) REFERENCES employee (employee_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_prod_log_output
    CHECK (output_qty >= 0),

  CONSTRAINT chk_prod_log_scrap
    CHECK (scrap_qty >= 0),

  CONSTRAINT chk_prod_log_power
    CHECK (power_kwh >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
