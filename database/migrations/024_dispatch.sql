-- Migration: 024_dispatch.sql
-- Depends on: buyer, customer_order, invoice
-- Run order: 24

CREATE TABLE IF NOT EXISTS dispatch (
  dispatch_id   INT          NOT NULL AUTO_INCREMENT,
  dispatch_no   VARCHAR(30)  NOT NULL,
  buyer_id      INT          NOT NULL,
  order_id      INT          NOT NULL,
  invoice_id    INT          NULL,
  vehicle_no    VARCHAR(20)  NULL,
  driver_name   VARCHAR(100) NULL,
  driver_phone  VARCHAR(20)  NULL,
  destination   VARCHAR(150) NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'draft',
  dispatched_at DATETIME(3)  NULL,
  version       INT          NOT NULL DEFAULT 1,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (dispatch_id),
  UNIQUE KEY uq_dispatch_no (dispatch_no),

  KEY idx_dispatch_buyer (buyer_id),
  KEY idx_dispatch_order (order_id),
  KEY idx_dispatch_invoice (invoice_id),
  KEY idx_dispatch_status (status),

  CONSTRAINT fk_dispatch_buyer
    FOREIGN KEY (buyer_id) REFERENCES buyer (buyer_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_dispatch_order
    FOREIGN KEY (order_id) REFERENCES customer_order (order_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_dispatch_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoice (invoice_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_dispatch_status
    CHECK (status IN ('draft', 'loading', 'dispatched', 'cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
