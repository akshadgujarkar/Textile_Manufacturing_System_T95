-- Migration: 027_buyer_payment.sql
-- Depends on: buyer, invoice, employee
-- Run order: 27

CREATE TABLE IF NOT EXISTS buyer_payment (
  payment_id             INT           NOT NULL AUTO_INCREMENT,
  payment_ref            VARCHAR(50)   NOT NULL,
  buyer_id               INT           NOT NULL,
  invoice_id             INT           NOT NULL,
  received_on            DATE          NOT NULL,
  amount                 DECIMAL(14,2) NOT NULL,
  mode                   VARCHAR(30)   NOT NULL,
  status                 VARCHAR(20)   NOT NULL DEFAULT 'recorded',
  client_request_id      VARCHAR(36)   NOT NULL,
  created_by_employee_id INT           NOT NULL,
  created_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (payment_id),
  UNIQUE KEY uq_payment_ref (payment_ref),
  UNIQUE KEY uq_payment_client_request (client_request_id),

  KEY idx_payment_buyer (buyer_id),
  KEY idx_payment_invoice (invoice_id),
  KEY idx_payment_status (status),
  KEY idx_payment_received_on (received_on),
  KEY idx_payment_created_by (created_by_employee_id),

  CONSTRAINT fk_payment_buyer
    FOREIGN KEY (buyer_id) REFERENCES buyer (buyer_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_payment_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoice (invoice_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT fk_payment_employee
    FOREIGN KEY (created_by_employee_id) REFERENCES employee (employee_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,

  CONSTRAINT chk_payment_amount
    CHECK (amount > 0),

  CONSTRAINT chk_payment_mode
    CHECK (mode IN ('NEFT/RTGS', 'Cheque', 'UPI', 'LC')),

  CONSTRAINT chk_payment_status
    CHECK (status IN ('recorded', 'reversed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
