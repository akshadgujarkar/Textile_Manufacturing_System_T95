-- ============================================================================
-- Phase 2 Verification & Smoke Test Script
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- ============================================================================

\echo '=================================================='
\echo 'Running Everest Textile TMS: Phase 2 Verification'
\echo '=================================================='

-- 1. Verify all 28 SQL Views Exist
SELECT 
    COUNT(*) AS total_views_count,
    CASE WHEN COUNT(*) = 28 THEN 'PASS (28/28 Views Found)' ELSE 'FAIL' END AS view_verification_status
FROM information_schema.views 
WHERE table_schema = 'public'
  AND table_name IN (
    'v_yarn_stock', 'v_open_stock_alerts', 'v_unbilled_lots', 'v_supplier_bill_variance',
    'v_order_material_check', 'v_order_status', 'v_machine_status', 'v_job_progress', 'v_output_by_machine_shift',
    'v_roll_trace', 'v_defects_by_machine', 'v_defects_by_operator',
    'v_dispatch_progress', 'v_dispatch_lines', 'v_invoice_balance', 'v_dispatch_invoice_match', 'v_buyer_ledger',
    'v_wage_summary', 'v_order_cost', 'v_roll_cost', 'v_machine_output', 'v_monthly_pl',
    'v_recon_stock_balance_vs_ledger', 'v_recon_reserved_vs_reservations', 'v_recon_roll_status_vs_facts',
    'v_recon_machine_events', 'v_recon_dispatch_vs_invoice', 'v_recon_unallocated_payments', 'v_recon_cost_vs_issues'
  );

-- 2. Verify State Machine Transitions Table
SELECT 
    entity_name, COUNT(*) AS valid_transitions_count
FROM status_transition
GROUP BY entity_name
ORDER BY entity_name;

-- 3. Verify Standard Roles Seeded
SELECT role_name, description FROM role ORDER BY role_id;

-- 4. Verify Units of Measure Seeded
SELECT unit_code, description FROM unit_of_measure ORDER BY unit_id;

-- 5. Verify Process Stages Seeded
SELECT stage_id, name, sequence_hint FROM process_stage ORDER BY sequence_hint;

-- 6. Execute Health Check Reconciliation Views (Must all return 0 rows on clean DB)
SELECT '1. v_recon_stock_balance_vs_ledger' AS test_name, COUNT(*) AS violations FROM v_recon_stock_balance_vs_ledger
UNION ALL
SELECT '2. v_recon_reserved_vs_reservations', COUNT(*) FROM v_recon_reserved_vs_reservations
UNION ALL
SELECT '3. v_recon_roll_status_vs_facts', COUNT(*) FROM v_recon_roll_status_vs_facts
UNION ALL
SELECT '4. v_recon_machine_events', COUNT(*) FROM v_recon_machine_events
UNION ALL
SELECT '5. v_recon_dispatch_vs_invoice', COUNT(*) FROM v_recon_dispatch_vs_invoice
UNION ALL
SELECT '6. v_recon_unallocated_payments', COUNT(*) FROM v_recon_unallocated_payments
UNION ALL
SELECT '7. v_recon_cost_vs_issues', COUNT(*) FROM v_recon_cost_vs_issues;

\echo '=================================================='
\echo 'Phase 2 Verification Complete.'
\echo '=================================================='
