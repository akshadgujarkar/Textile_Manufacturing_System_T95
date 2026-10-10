-- Migration: 017_production_job.sql
-- Depends on: order_item, process_stage, machine
-- Run order: 17

CREATE TABLE IF NOT EXISTS production_job (
  job_id        INT           NOT NULL AUTO_INCREMENT,
  job_no        VARCHAR(30)   NOT NULL,
  order_item_id INT           NOT NULL,
  stage_id      INT           NOT NULL,
  machine_id    INT           NOT NULL,
  planned_qty   DECIMAL(12,2) NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'planned',
  priority      VARCHAR(20)   NOT NULL DEFAULT 'Medium',
  started_at    DATETIME(3)   NULL,
  ended_at      DATETIME(3)   NULL,
  version       INT           NOT NULL DEFAULT 1,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (job_id),
  UNIQUE KEY uq_production_job_no (job_no),

  KEY idx_job_order_item (order_item_id),
  KEY idx_job_stage (stage_id),
  KEY idx_job_machine (machine_id),
  KEY idx_job_status (status),

  CONSTRAINT fk_job_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_item (order_item_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_job_stage
    FOREIGN KEY (stage_id) REFERENCES process_stage (stage_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_job_machine
    FOREIGN KEY (machine_id) REFERENCES machine (machine_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_job_planned_qty
    CHECK (planned_qty > 0),

  CONSTRAINT chk_job_status
    CHECK (status IN ('planned', 'running', 'interrupted', 'completed', 'cancelled')),

  CONSTRAINT chk_job_priority
    CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
