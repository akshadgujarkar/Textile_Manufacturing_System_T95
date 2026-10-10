-- Migration: 010_purchase_order.sql
-- Depends on: supplier, employee
-- Run order: 10

CREATE TABLE IF NOT EXISTS purchase_order (
  po_id                  INT            NOT NULL AUTO_INCREMENT,
  po_no                  VARCHAR(30)    NOT NULL,
  supplier_id            INT            NOT NULL,
  order_date             DATE           NOT NULL,
  expected_delivery_date DATE           NULL,
  status                 VARCHAR(20)    NOT NULL DEFAULT 'draft',
  total_amount           DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  created_by             INT            NOT NULL,
  created_at             DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (po_id),
  UNIQUE KEY uq_po_no (po_no),

  KEY idx_po_supplier (supplier_id),
  KEY idx_po_created_by (created_by),
  KEY idx_po_status (status),

  CONSTRAINT fk_po_supplier
    FOREIGN KEY (supplier_id) REFERENCES supplier (supplier_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_po_employee
    FOREIGN KEY (created_by) REFERENCES employee (employee_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_po_status
    CHECK (status IN ('draft', 'sent', 'partially_received', 'closed', 'cancelled')),

  CONSTRAINT chk_po_total
    CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
