-- Migration: 008_process_stage.sql
-- No dependencies
-- Run order: 8

CREATE TABLE IF NOT EXISTS process_stage (
  stage_id      INT         NOT NULL AUTO_INCREMENT,
  name          VARCHAR(50) NOT NULL,
  sequence_hint INT         NOT NULL,

  PRIMARY KEY (stage_id),
  UNIQUE KEY uq_process_stage_name (name),
  UNIQUE KEY uq_process_stage_seq  (sequence_hint),

  CONSTRAINT chk_process_stage_seq
    CHECK (sequence_hint > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
