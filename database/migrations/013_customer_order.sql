-- Migration: 013_customer_order.sql
-- Depends on: buyer, employee
-- Run order: 13

CREATE TABLE IF NOT EXISTS customer_order (
  order_id               INT         NOT NULL AUTO_INCREMENT,
  order_no               VARCHAR(30) NOT NULL,
  buyer_id               INT         NOT NULL,
  order_date             DATE        NOT NULL,
  promised_delivery_date DATE        NULL,
  status                 VARCHAR(20) NOT NULL DEFAULT 'draft',
  version                INT         NOT NULL DEFAULT 1,
  created_by_employee_id INT         NOT NULL,
  created_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (order_id),
  UNIQUE KEY uq_customer_order_no (order_no),

  KEY idx_order_buyer (buyer_id),
  KEY idx_order_created_by (created_by_employee_id),
  KEY idx_order_status (status),

  CONSTRAINT fk_order_buyer
    FOREIGN KEY (buyer_id) REFERENCES buyer (buyer_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_order_created_by
    FOREIGN KEY (created_by_employee_id) REFERENCES employee (employee_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_order_status
    CHECK (status IN ('draft', 'confirmed', 'in_production', 'ready_for_dispatch', 'dispatched', 'closed', 'cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
