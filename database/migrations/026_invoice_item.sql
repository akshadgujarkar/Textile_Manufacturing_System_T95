-- Migration: 026_invoice_item.sql
-- Depends on: invoice, order_item
-- Run order: 26

CREATE TABLE IF NOT EXISTS invoice_item (
  invoice_item_id INT           NOT NULL AUTO_INCREMENT,
  invoice_id      INT           NOT NULL,
  order_item_id   INT           NOT NULL,
  hsn_code        VARCHAR(10)   NOT NULL DEFAULT '5208',
  quantity        DECIMAL(12,2) NOT NULL,
  rate            DECIMAL(12,2) NOT NULL,
  amount          DECIMAL(14,2) NOT NULL,

  PRIMARY KEY (invoice_item_id),
  KEY idx_inv_item_invoice (invoice_id),
  KEY idx_inv_item_order_item (order_item_id),

  CONSTRAINT fk_inv_item_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoice (invoice_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_inv_item_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_item (order_item_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_inv_item_qty
    CHECK (quantity > 0),

  CONSTRAINT chk_inv_item_rate
    CHECK (rate >= 0),

  CONSTRAINT chk_inv_item_amount
    CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
