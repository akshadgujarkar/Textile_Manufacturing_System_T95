-- ============================================================================
-- Phase 1 Verification & Smoke Test Script
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- ============================================================================

\echo '=================================================='
\echo 'Running Everest Textile TMS: Phase 1 Verification'
\echo '=================================================='

-- 1. Verify all 48 tables exist (46 domain entities + doc_sequence + status_transition)
SELECT 
    COUNT(*) AS total_tables_count,
    CASE WHEN COUNT(*) = 48 THEN 'PASS (48/48 Tables Found)' ELSE 'FAIL' END AS table_verification_status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'role', 'app_user', 'user_role', 'employee', 'unit_of_measure', 'supplier', 'buyer',
    'yarn_type', 'colour', 'yarn_item', 'fabric_product', 'process_stage', 'machine', 'shift', 'defect_type',
    'purchase_order', 'purchase_order_item', 'goods_receipt', 'goods_receipt_item', 'supplier_bill', 'supplier_bill_line',
    'customer_order', 'order_item', 'order_status_history', 'order_material_requirement', 'yarn_reservation',
    'production_job', 'production_log', 'machine_status_event', 'yarn_stock_movement', 'yarn_stock_balance', 'stock_alert',
    'fabric_roll', 'qc_inspection', 'qc_defect', 'invoice', 'invoice_item', 'dispatch', 'dispatch_item',
    'accounting_period', 'buyer_payment', 'payment_allocation', 'attendance_record', 'wage_record', 'cost_entry', 'audit_log',
    'doc_sequence', 'status_transition'
  );

-- 2. Verify all custom domains exist
SELECT 
    domain_name, data_type, numeric_precision, numeric_scale
FROM information_schema.domains 
WHERE domain_schema = 'public' 
  AND domain_name IN ('qty_t', 'money_t', 'rate_t')
ORDER BY domain_name;

-- 3. Verify all business sequences exist
SELECT 
    sequence_name 
FROM information_schema.sequences 
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- 4. Verify btree_gist extension is active
SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist';

\echo '=================================================='
\echo 'Phase 1 Verification Complete.'
\echo '=================================================='
