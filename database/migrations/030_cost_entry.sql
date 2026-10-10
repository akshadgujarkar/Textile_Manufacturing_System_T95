-- Migration: 030_cost_entry.sql
-- Depends on: customer_order, machine, fabric_roll, yarn_stock_movement, wage_record
-- Run order: 30

CREATE TABLE IF NOT EXISTS cost_entry (
  cost_id     INT           NOT NULL AUTO_INCREMENT,
  cost_type   VARCHAR(30)   NOT NULL,
  amount      DECIMAL(14,2) NOT NULL,
  cost_date   DATE          NOT NULL,
  order_id    INT           NULL,
  machine_id  INT           NULL,
  roll_id     INT           NULL,
  movement_id INT           NULL,
  wage_id     INT           NULL,
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (cost_id),
  KEY idx_cost_type (cost_type),
  KEY idx_cost_date (cost_date),
  KEY idx_cost_order (order_id),
  KEY idx_cost_machine (machine_id),
  KEY idx_cost_roll (roll_id),
  KEY idx_cost_movement (movement_id),
  KEY idx_cost_wage (wage_id),

  CONSTRAINT fk_cost_order
    FOREIGN KEY (order_id) REFERENCES customer_order (order_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_cost_machine
    FOREIGN KEY (machine_id) REFERENCES machine (machine_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_cost_roll
    FOREIGN KEY (roll_id) REFERENCES fabric_roll (roll_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_cost_movement
    FOREIGN KEY (movement_id) REFERENCES yarn_stock_movement (movement_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_cost_wage
    FOREIGN KEY (wage_id) REFERENCES wage_record (wage_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_cost_type
    CHECK (cost_type IN ('material', 'wage', 'power', 'maintenance', 'overhead')),

  CONSTRAINT chk_cost_amount
    CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
