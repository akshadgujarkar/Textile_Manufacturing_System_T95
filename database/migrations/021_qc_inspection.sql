-- Migration: 021_qc_inspection.sql
-- Depends on: fabric_roll, employee
-- Run order: 21

CREATE TABLE IF NOT EXISTS qc_inspection (
  inspection_id        INT          NOT NULL AUTO_INCREMENT,
  roll_id              INT          NOT NULL,
  inspector_id         INT          NOT NULL,
  attempt_no           INT          NOT NULL DEFAULT 1,
  result               VARCHAR(20)  NOT NULL,
  assigned_grade       VARCHAR(10)  NOT NULL,
  total_penalty_points INT          NOT NULL DEFAULT 0,
  points_per_100_sq_yd DECIMAL(6,2) NULL,
  inspected_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  remarks              TEXT         NULL,

  PRIMARY KEY (inspection_id),
  KEY idx_qc_roll (roll_id),
  KEY idx_qc_inspector (inspector_id),
  KEY idx_qc_result (result),
  KEY idx_qc_inspected_at (inspected_at),

  CONSTRAINT fk_qc_roll
    FOREIGN KEY (roll_id) REFERENCES fabric_roll (roll_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_qc_inspector
    FOREIGN KEY (inspector_id) REFERENCES employee (employee_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_qc_attempt
    CHECK (attempt_no >= 1),

  CONSTRAINT chk_qc_result
    CHECK (result IN ('passed', 'rework', 'rejected')),

  CONSTRAINT chk_qc_grade
    CHECK (assigned_grade IN ('A', 'B', 'C', 'Rejection')),

  CONSTRAINT chk_qc_points
    CHECK (total_penalty_points >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
