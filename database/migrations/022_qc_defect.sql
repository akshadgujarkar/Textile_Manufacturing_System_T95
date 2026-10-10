-- Migration: 022_qc_defect.sql
-- Depends on: qc_inspection
-- Run order: 22

CREATE TABLE IF NOT EXISTS qc_defect (
  defect_id       INT           NOT NULL AUTO_INCREMENT,
  inspection_id   INT           NOT NULL,
  defect_code     VARCHAR(30)   NOT NULL,
  defect_name     VARCHAR(100)  NOT NULL,
  penalty_points  INT           NOT NULL,
  position_meters DECIMAL(10,2) NULL,
  severity        VARCHAR(20)   NOT NULL,

  PRIMARY KEY (defect_id),
  KEY idx_defect_inspection (inspection_id),
  KEY idx_defect_code (defect_code),

  CONSTRAINT fk_defect_inspection
    FOREIGN KEY (inspection_id) REFERENCES qc_inspection (inspection_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_defect_points
    CHECK (penalty_points IN (1, 2, 3, 4)),

  CONSTRAINT chk_defect_severity
    CHECK (severity IN ('minor', 'major', 'critical')),

  CONSTRAINT chk_defect_position
    CHECK (position_meters IS NULL OR position_meters >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
