-- Migration: 001_unit_of_measure.sql
-- Creates the unit_of_measure table (no dependencies)
-- Run order: 1

CREATE TABLE IF NOT EXISTS unit_of_measure (
  unit_id     INT          NOT NULL AUTO_INCREMENT,
  unit_code   VARCHAR(10)  NOT NULL,
  description VARCHAR(50)  NOT NULL,

  PRIMARY KEY (unit_id),
  UNIQUE KEY uq_unit_code (unit_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
