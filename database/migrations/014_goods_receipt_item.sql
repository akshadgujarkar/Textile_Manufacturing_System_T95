-- Migration: 014_goods_receipt_item.sql
-- Depends on: goods_receipt, yarn_item, customer_order
-- Run order: 14

CREATE TABLE IF NOT EXISTS goods_receipt_item (
  receipt_item_id    INT           NOT NULL AUTO_INCREMENT,
  receipt_id         INT           NOT NULL,
  yarn_item_id       INT           NOT NULL,
  lot_code           VARCHAR(50)   NOT NULL,
  quantity_received  DECIMAL(12,3) NOT NULL,
  earmarked_order_id INT           NULL,
  storage_location   VARCHAR(50)   NULL,

  PRIMARY KEY (receipt_item_id),
  UNIQUE KEY uq_gri_lot_code (lot_code),

  KEY idx_gri_receipt (receipt_id),
  KEY idx_gri_yarn (yarn_item_id),
  KEY idx_gri_earmarked_order (earmarked_order_id),

  CONSTRAINT fk_gri_receipt
    FOREIGN KEY (receipt_id) REFERENCES goods_receipt (receipt_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_gri_yarn
    FOREIGN KEY (yarn_item_id) REFERENCES yarn_item (yarn_item_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_gri_earmarked_order
    FOREIGN KEY (earmarked_order_id) REFERENCES customer_order (order_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_gri_qty
    CHECK (quantity_received > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
