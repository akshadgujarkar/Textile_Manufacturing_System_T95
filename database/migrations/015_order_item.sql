-- Migration: 015_order_item.sql
-- Depends on: customer_order, fabric_product, unit_of_measure
-- Run order: 15

CREATE TABLE IF NOT EXISTS order_item (
  order_item_id INT            NOT NULL AUTO_INCREMENT,
  order_id      INT            NOT NULL,
  line_no       INT            NOT NULL,
  product_id    INT            NOT NULL,
  colour_code   VARCHAR(30)    NOT NULL,
  ordered_qty   DECIMAL(12,2)  NOT NULL,
  unit_id       INT            NOT NULL,
  agreed_rate   DECIMAL(12,2)  NOT NULL,
  line_total    DECIMAL(14,2)  NOT NULL,

  PRIMARY KEY (order_item_id),
  UNIQUE KEY uq_order_item_line (order_id, line_no),

  KEY idx_order_item_order (order_id),
  KEY idx_order_item_product (product_id),
  KEY idx_order_item_unit (unit_id),

  CONSTRAINT fk_order_item_order
    FOREIGN KEY (order_id) REFERENCES customer_order (order_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_order_item_product
    FOREIGN KEY (product_id) REFERENCES fabric_product (product_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_order_item_unit
    FOREIGN KEY (unit_id) REFERENCES unit_of_measure (unit_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_order_item_qty
    CHECK (ordered_qty > 0),

  CONSTRAINT chk_order_item_rate
    CHECK (agreed_rate >= 0),

  CONSTRAINT chk_order_item_total
    CHECK (line_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
