-- Migration: 016_order_material_requirement.sql
-- Depends on: order_item, yarn_item
-- Run order: 16

CREATE TABLE IF NOT EXISTS order_material_requirement (
  requirement_id    INT           NOT NULL AUTO_INCREMENT,
  order_item_id     INT           NOT NULL,
  yarn_item_id      INT           NOT NULL,
  required_qty      DECIMAL(12,3) NOT NULL,
  waste_factor_pct  DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  reserved_qty      DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  allocation_status VARCHAR(20)   NOT NULL DEFAULT 'unallocated',

  PRIMARY KEY (requirement_id),
  KEY idx_omr_order_item (order_item_id),
  KEY idx_omr_yarn_item (yarn_item_id),

  CONSTRAINT fk_omr_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_item (order_item_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_omr_yarn_item
    FOREIGN KEY (yarn_item_id) REFERENCES yarn_item (yarn_item_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_omr_req_qty
    CHECK (required_qty > 0),

  CONSTRAINT chk_omr_waste_factor
    CHECK (waste_factor_pct >= 0),

  CONSTRAINT chk_omr_reserved_qty
    CHECK (reserved_qty >= 0),

  CONSTRAINT chk_omr_allocation_status
    CHECK (allocation_status IN ('unallocated', 'partial', 'reserved', 'issued', 'cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
