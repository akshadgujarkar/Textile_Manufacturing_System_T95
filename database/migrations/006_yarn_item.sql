-- Migration: 006_yarn_item.sql
-- Depends on: yarn_type, unit_of_measure
-- Run order: 6

CREATE TABLE IF NOT EXISTS yarn_item (
  yarn_item_id  INT           NOT NULL AUTO_INCREMENT,
  yarn_type_id  INT           NOT NULL,
  colour_code   VARCHAR(30)   NOT NULL,
  colour_name   VARCHAR(100)  NULL,
  unit_id       INT           NOT NULL,
  reorder_level DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,

  PRIMARY KEY (yarn_item_id),
  UNIQUE KEY uq_yarn_item_type_colour (yarn_type_id, colour_code),

  KEY idx_yarn_item_unit (unit_id),

  CONSTRAINT fk_yarn_item_type
    FOREIGN KEY (yarn_type_id) REFERENCES yarn_type (yarn_type_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_yarn_item_unit
    FOREIGN KEY (unit_id) REFERENCES unit_of_measure (unit_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_yarn_item_reorder
    CHECK (reorder_level >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
