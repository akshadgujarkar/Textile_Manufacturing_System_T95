-- Migration: 018_yarn_stock_movement.sql
-- Depends on: yarn_item, goods_receipt_item, production_job, employee
-- Run order: 18

CREATE TABLE IF NOT EXISTS yarn_stock_movement (
  movement_id             INT           NOT NULL AUTO_INCREMENT,
  yarn_item_id            INT           NOT NULL,
  movement_type           VARCHAR(20)   NOT NULL,
  quantity                DECIMAL(12,3) NOT NULL,
  unit_cost               DECIMAL(12,2) NULL,
  receipt_item_id         INT           NULL,
  production_job_id       INT           NULL,
  reverses_movement_id    INT           NULL,
  reason                  VARCHAR(255)  NULL,
  occurred_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by_employee_id  INT           NOT NULL,

  PRIMARY KEY (movement_id),
  KEY idx_ysm_yarn_item (yarn_item_id),
  KEY idx_ysm_receipt_item (receipt_item_id),
  KEY idx_ysm_production_job (production_job_id),
  KEY idx_ysm_reverses_movement (reverses_movement_id),
  KEY idx_ysm_created_by (created_by_employee_id),
  KEY idx_ysm_occurred_at (occurred_at),
  KEY idx_ysm_type (movement_type),

  CONSTRAINT fk_ysm_yarn_item
    FOREIGN KEY (yarn_item_id) REFERENCES yarn_item (yarn_item_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_ysm_receipt_item
    FOREIGN KEY (receipt_item_id) REFERENCES goods_receipt_item (receipt_item_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_ysm_production_job
    FOREIGN KEY (production_job_id) REFERENCES production_job (job_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_ysm_reverses_movement
    FOREIGN KEY (reverses_movement_id) REFERENCES yarn_stock_movement (movement_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_ysm_created_by
    FOREIGN KEY (created_by_employee_id) REFERENCES employee (employee_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_ysm_type
    CHECK (movement_type IN ('receipt', 'issue', 'return', 'adjustment', 'reversal'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
