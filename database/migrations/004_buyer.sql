-- Migration: 004_buyer.sql
-- Run order: 4

CREATE TABLE IF NOT EXISTS buyer (
  buyer_id            INT           NOT NULL AUTO_INCREMENT,
  buyer_code          VARCHAR(20)   NOT NULL,
  name                VARCHAR(150)  NOT NULL,
  gstin               VARCHAR(15)   NULL,
  contact_person      VARCHAR(100)  NULL,
  phone               VARCHAR(20)   NULL,
  credit_limit        DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  payment_terms_days  INT           NOT NULL DEFAULT 30,
  is_active           TINYINT(1)    NOT NULL DEFAULT 1,

  PRIMARY KEY (buyer_id),
  UNIQUE KEY uq_buyer_code (buyer_code),

  CONSTRAINT chk_buyer_credit_limit
    CHECK (credit_limit >= 0),
  CONSTRAINT chk_buyer_payment_terms
    CHECK (payment_terms_days >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
