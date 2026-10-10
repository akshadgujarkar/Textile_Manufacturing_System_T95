-- Migration: 012_goods_receipt.sql
-- Depends on: supplier, purchase_order, employee
-- Run order: 12

CREATE TABLE IF NOT EXISTS goods_receipt (
  receipt_id              INT          NOT NULL AUTO_INCREMENT,
  receipt_no              VARCHAR(30)  NOT NULL,
  supplier_id             INT          NOT NULL,
  po_id                   INT          NULL,
  supplier_challan_no     VARCHAR(50)  NULL,
  vehicle_number          VARCHAR(20)  NULL,
  received_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  received_by_employee_id INT          NOT NULL,
  client_request_id       VARCHAR(36)  NOT NULL,
  status                  VARCHAR(20)  NOT NULL DEFAULT 'received',
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (receipt_id),
  UNIQUE KEY uq_gr_receipt_no (receipt_no),
  UNIQUE KEY uq_gr_client_request_id (client_request_id),

  KEY idx_gr_supplier (supplier_id),
  KEY idx_gr_po (po_id),
  KEY idx_gr_received_by (received_by_employee_id),
  KEY idx_gr_status (status),

  CONSTRAINT fk_gr_supplier
    FOREIGN KEY (supplier_id) REFERENCES supplier (supplier_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_gr_po
    FOREIGN KEY (po_id) REFERENCES purchase_order (po_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_gr_employee
    FOREIGN KEY (received_by_employee_id) REFERENCES employee (employee_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_gr_status
    CHECK (status IN ('received', 'cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
