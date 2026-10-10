-- Migration: 009_machine.sql
-- Depends on: process_stage
-- Run order: 9

CREATE TABLE IF NOT EXISTS machine (
  machine_id             INT          NOT NULL AUTO_INCREMENT,
  machine_code           VARCHAR(30)  NOT NULL,
  stage_id               INT          NOT NULL,
  make_model             VARCHAR(100) NULL,
  rated_rpm              INT          NULL,
  is_active              TINYINT(1)   NOT NULL DEFAULT 1,
  current_status         VARCHAR(20)  NOT NULL DEFAULT 'idle',
  last_status_changed_at DATETIME(3)  NULL,

  PRIMARY KEY (machine_id),
  UNIQUE KEY uq_machine_code (machine_code),

  KEY idx_machine_stage (stage_id),

  CONSTRAINT fk_machine_stage
    FOREIGN KEY (stage_id) REFERENCES process_stage (stage_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_machine_status
    CHECK (current_status IN ('running', 'idle', 'maintenance', 'stopped')),

  CONSTRAINT chk_machine_rpm
    CHECK (rated_rpm IS NULL OR rated_rpm > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
