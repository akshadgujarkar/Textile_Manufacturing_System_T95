-- Migration: 025_dispatch_item.sql
-- Depends on: dispatch, fabric_roll, employee
-- Run order: 25

CREATE TABLE IF NOT EXISTS dispatch_item (
  dispatch_item_id       INT         NOT NULL AUTO_INCREMENT,
  dispatch_id            INT         NOT NULL,
  roll_id                INT         NOT NULL,
  scanned_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  scanned_by_employee_id INT         NOT NULL,
  state                  VARCHAR(20) NOT NULL DEFAULT 'active',
  active_roll_id         INT         GENERATED ALWAYS AS (IF(state = 'active', roll_id, NULL)) VIRTUAL,

  PRIMARY KEY (dispatch_item_id),
  UNIQUE KEY uq_dispatch_item_active_roll (active_roll_id),

  KEY idx_disp_item_dispatch (dispatch_id),
  KEY idx_disp_item_roll (roll_id),
  KEY idx_disp_item_scanned_by (scanned_by_employee_id),
  KEY idx_disp_item_state (state),

  CONSTRAINT fk_disp_item_dispatch
    FOREIGN KEY (dispatch_id) REFERENCES dispatch (dispatch_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_disp_item_roll
    FOREIGN KEY (roll_id) REFERENCES fabric_roll (roll_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_disp_item_scanned_by
    FOREIGN KEY (scanned_by_employee_id) REFERENCES employee (employee_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_disp_item_state
    CHECK (state IN ('active', 'removed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
