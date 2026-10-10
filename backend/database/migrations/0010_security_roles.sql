-- ============================================================================
-- Migration 0010: Database Connection Roles & Column-Level Access Control
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- ============================================================================

-- 1. Database Connection Roles (Check existence before creating)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_migration_role') THEN
    CREATE ROLE app_migration_role NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_backend_role') THEN
    CREATE ROLE app_backend_role NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly_role') THEN
    CREATE ROLE app_readonly_role NOINHERIT;
  END IF;
END $$;

-- 2. Schema Usage Privileges
GRANT USAGE ON SCHEMA public TO app_backend_role, app_readonly_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_backend_role;

-- 3. Read Privileges on All Tables and Views
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_backend_role, app_readonly_role;

-- 4. Insert Privileges on Operational Tables and Ledgers
GRANT INSERT ON 
    app_user, user_role, employee, supplier, buyer, unit_of_measure, yarn_type, colour,
    yarn_item, fabric_product, process_stage, machine, shift, defect_type,
    purchase_order, purchase_order_item, goods_receipt, goods_receipt_item,
    yarn_stock_movement, stock_alert, supplier_bill, supplier_bill_line,
    customer_order, order_item, order_status_history, order_material_requirement, yarn_reservation,
    production_job, production_log, machine_status_event,
    fabric_roll, qc_inspection, qc_defect, dispatch, dispatch_item,
    invoice, invoice_item, buyer_payment, payment_allocation,
    attendance_record, accounting_period, wage_record, cost_entry,
    doc_sequence
TO app_backend_role;

-- 5. Update Privileges Strictly on Editable Operational Documents (Ledgers excluded)
GRANT UPDATE ON 
    app_user, employee, supplier, buyer, yarn_item, fabric_product, machine,
    customer_order, purchase_order, production_job, fabric_roll,
    dispatch, dispatch_item, invoice, stock_alert, yarn_reservation,
    attendance_record, wage_record, accounting_period, doc_sequence
TO app_backend_role;

-- 6. Strictly Revoke Physical Deletes on All Operational Tables
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM app_backend_role, app_readonly_role;

-- Controlled carve-out: DELETE permitted only on unconfirmed draft line items
GRANT DELETE ON purchase_order_item, order_item, invoice_item TO app_backend_role;

-- 7. Sensitive Column-Level Privileges
CREATE OR REPLACE VIEW v_employee_directory AS
SELECT 
    employee_id, employee_code, full_name, designation,
    pay_basis, is_active
FROM employee;

CREATE OR REPLACE VIEW v_employee_payroll AS
SELECT 
    employee_id, employee_code, full_name, designation,
    pay_basis, pay_rate, is_active
FROM employee;
