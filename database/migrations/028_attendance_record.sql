-- Migration: 028_attendance_record.sql
-- Depends on: employee
-- Run order: 28

CREATE TABLE IF NOT EXISTS attendance_record (
  attendance_id INT          NOT NULL AUTO_INCREMENT,
  employee_id   INT          NOT NULL,
  work_date     DATE         NOT NULL,
  shift_code    VARCHAR(30)  NOT NULL,
  status        VARCHAR(20)  NOT NULL,
  hours_worked  DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (attendance_id),
  UNIQUE KEY uq_emp_date_shift (employee_id, work_date, shift_code),

  KEY idx_attendance_employee (employee_id),
  KEY idx_attendance_date (work_date),
  KEY idx_attendance_status (status),

  CONSTRAINT fk_attendance_employee
    FOREIGN KEY (employee_id) REFERENCES employee (employee_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_attendance_status
    CHECK (status IN ('present', 'absent', 'half_day', 'leave', 'overtime')),

  CONSTRAINT chk_attendance_hours
    CHECK (hours_worked >= 0 AND hours_worked <= 24.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
