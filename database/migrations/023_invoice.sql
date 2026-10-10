-- Migration: 023_invoice.sql
-- Depends on: buyer
-- Run order: 23

CREATE TABLE IF NOT EXISTS invoice (
  invoice_id   INT           NOT NULL AUTO_INCREMENT,
  invoice_no   VARCHAR(30)   NOT NULL,
  buyer_id     INT           NOT NULL,
  invoice_date DATE          NOT NULL,
  due_date     DATE          NULL,
  subtotal     DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  tax_rate     DECIMAL(5,2)  NOT NULL DEFAULT 5.00,
  tax_amount   DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  status       VARCHAR(20)   NOT NULL DEFAULT 'draft',
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version      INT           NOT NULL DEFAULT 1,

  PRIMARY KEY (invoice_id),
  UNIQUE KEY uq_invoice_no (invoice_no),

  KEY idx_invoice_buyer (buyer_id),
  KEY idx_invoice_status (status),
  KEY idx_invoice_date (invoice_date),

  CONSTRAINT fk_invoice_buyer
    FOREIGN KEY (buyer_id) REFERENCES buyer (buyer_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_invoice_status
    CHECK (status IN ('draft', 'issued', 'void')),

  CONSTRAINT chk_invoice_subtotal
    CHECK (subtotal >= 0),

  CONSTRAINT chk_invoice_tax_rate
    CHECK (tax_rate >= 0),

  CONSTRAINT chk_invoice_tax_amount
    CHECK (tax_amount >= 0),

  CONSTRAINT chk_invoice_total
    CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
