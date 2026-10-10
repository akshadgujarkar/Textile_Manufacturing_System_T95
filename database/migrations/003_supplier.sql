-- Migration: 003_supplier.sql
-- Run order: 3

CREATE TABLE IF NOT EXISTS supplier (
  supplier_id     INT          NOT NULL AUTO_INCREMENT,
  supplier_code   VARCHAR(20)  NOT NULL,
  name            VARCHAR(150) NOT NULL,
  gstin           VARCHAR(15)  NULL,
  contact_person  VARCHAR(100) NULL,
  phone           VARCHAR(20)  NULL,
  address         TEXT         NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,

  PRIMARY KEY (supplier_id),
  UNIQUE KEY uq_supplier_code (supplier_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
