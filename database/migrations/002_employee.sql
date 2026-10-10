-- Migration: 002_employee.sql
-- Creates the employee table (no dependencies)
-- Run order: 2

CREATE TABLE IF NOT EXISTS employee (
  employee_id   INT           NOT NULL AUTO_INCREMENT,
  employee_code VARCHAR(20)   NOT NULL,
  full_name     VARCHAR(100)  NOT NULL,
  designation   VARCHAR(50)   NOT NULL,
  pay_basis     VARCHAR(20)   NOT NULL,
  pay_rate      DECIMAL(12,2) NOT NULL,
  phone         VARCHAR(20)   NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (employee_id),
  UNIQUE KEY uq_employee_code (employee_code),

  CONSTRAINT chk_employee_pay_basis
    CHECK (pay_basis IN ('monthly', 'daily', 'piece_rate')),
  CONSTRAINT chk_employee_pay_rate
    CHECK (pay_rate >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
