-- Migration: 007_fabric_product.sql
-- Depends on: unit_of_measure
-- Run order: 7

CREATE TABLE IF NOT EXISTS fabric_product (
  product_id           INT           NOT NULL AUTO_INCREMENT,
  product_code         VARCHAR(30)   NOT NULL,
  name                 VARCHAR(150)  NOT NULL,
  weave_type           VARCHAR(50)   NULL,
  nominal_gsm          DECIMAL(6,2)  NULL,
  nominal_width_inches DECIMAL(5,2)  NULL,
  unit_id              INT           NOT NULL,

  PRIMARY KEY (product_id),
  UNIQUE KEY uq_fabric_product_code (product_code),

  KEY idx_fabric_product_unit (unit_id),

  CONSTRAINT fk_fabric_product_unit
    FOREIGN KEY (unit_id) REFERENCES unit_of_measure (unit_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_fabric_product_gsm
    CHECK (nominal_gsm IS NULL OR nominal_gsm > 0),
  CONSTRAINT chk_fabric_product_width
    CHECK (nominal_width_inches IS NULL OR nominal_width_inches > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
