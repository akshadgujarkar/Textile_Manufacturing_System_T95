-- Migration: 005_yarn_type.sql
-- Run order: 5

CREATE TABLE IF NOT EXISTS yarn_type (
  yarn_type_id  INT          NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  fiber_content VARCHAR(100) NULL,
  nominal_count VARCHAR(50)  NULL,
  description   TEXT         NULL,

  PRIMARY KEY (yarn_type_id),
  UNIQUE KEY uq_yarn_type_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
