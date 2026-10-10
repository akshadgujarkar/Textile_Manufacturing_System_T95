-- Migration: 011_purchase_order_item.sql
-- Depends on: purchase_order, yarn_item
-- Run order: 11

CREATE TABLE IF NOT EXISTS purchase_order_item (
  po_item_id   INT            NOT NULL AUTO_INCREMENT,
  po_id        INT            NOT NULL,
  yarn_item_id INT            NOT NULL,
  quantity     DECIMAL(12,3)  NOT NULL,
  agreed_rate  DECIMAL(12,2)  NOT NULL,
  line_total   DECIMAL(14,2)  NOT NULL,

  PRIMARY KEY (po_item_id),
  KEY idx_poi_po (po_id),
  KEY idx_poi_yarn (yarn_item_id),

  CONSTRAINT fk_poi_po
    FOREIGN KEY (po_id) REFERENCES purchase_order (po_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_poi_yarn
    FOREIGN KEY (yarn_item_id) REFERENCES yarn_item (yarn_item_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_poi_qty
    CHECK (quantity > 0),

  CONSTRAINT chk_poi_rate
    CHECK (agreed_rate >= 0),

  CONSTRAINT chk_poi_line_total
    CHECK (line_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
