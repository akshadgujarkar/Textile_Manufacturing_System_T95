-- Migration: 029_wage_record.sql
-- Depends on: employee
-- Run order: 29

CREATE TABLE IF NOT EXISTS wage_record (
  wage_id           INT           NOT NULL AUTO_INCREMENT,
  employee_id       INT           NOT NULL,
  payroll_month     DATE          NOT NULL,
  base_amount       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  piece_rate_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  bonus_overtime    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  gross_amount      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status            VARCHAR(20)   NOT NULL DEFAULT 'draft',
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (wage_id),
  UNIQUE KEY uq_emp_payroll_month (employee_id, payroll_month),

  KEY idx_wage_employee (employee_id),
  KEY idx_wage_month (payroll_month),
  KEY idx_wage_status (status),

  CONSTRAINT fk_wage_employee
    FOREIGN KEY (employee_id) REFERENCES employee (employee_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_wage_base
    CHECK (base_amount >= 0),

  CONSTRAINT chk_wage_piece_rate
    CHECK (piece_rate_amount >= 0),

  CONSTRAINT chk_wage_bonus
    CHECK (bonus_overtime >= 0),

  CONSTRAINT chk_wage_gross
    CHECK (gross_amount >= 0),

  CONSTRAINT chk_wage_status
    CHECK (status IN ('draft', 'approved', 'disbursed', 'reversed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
