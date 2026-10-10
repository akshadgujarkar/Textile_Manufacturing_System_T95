# 06 — Query and Index Strategy

**Project:** Textile Manufacturing System — Everest Textile Mills  
**Database:** PostgreSQL 15+ (single instance, schema `public`)  
**Depends on:** `01-requirements-analysis.md` (FR-x.y, BR-x, workflows W1–W6), `03-entity-relationship-design.md` (entities 1–46, invariants INV-1…INV-11), `04-database-schema.md` (table DDL, triggers, custom SQLSTATEs), `05-data-flow-and-transactions.md` (transaction workflows WF-1…WF-15).  
**Scope:** Complete production SQL view definitions (`v_…`), core query catalog for all user roles/screens, comprehensive index strategy (Migration 0009 DDL with explicit justifications), pagination strategies, materialized views & snapshot policies, scaling triggers, and query performance risk mitigations.

---

## 1. Architectural Principles for Queries and Indexes

1. **The Database is the Single Source of Truth for Calculations:** Derived values, order progress percentages, stock availability, machine states, traceability chains, and P&L statements are defined in versioned SQL views. The application never re-implements SQL calculation logic in client or backend code.
2. **Read/Write Performance Balance:** Everest Textile Mills operates in real time. We do not index every column blindly. Every index must be justified by at least one high-frequency operational query, a strict foreign key cascading/lock-prevention requirement, or a uniqueness constraint.
3. **No Unindexed Foreign Keys on Child Tables:** In PostgreSQL, foreign keys without an index on the referencing column cause sequential table scans on the child table whenever parent records are referenced in joins or verified during transactions.
4. **Predictable Query Execution:** Complex views use explicit join topologies and avoid cartesian explosions. Compound indexes strictly follow the **Equality → Range → Sort** rule.
5. **Keyset / Cursor Pagination for High-Volume Ledgers:** Queries serving unbounded history (production logs, audit logs, roll traces, ledger movements) use keyset pagination (`WHERE (created_at, id) < ($last_time, $last_id) ORDER BY created_at DESC, id DESC LIMIT $page_size`) to guarantee $O(1)$ response times regardless of page depth.

---

## 2. Complete SQL View Catalog

The following SQL DDL creates all business, operational, traceability, reporting, and reconciliation views required by the system.

```sql
-- ============================================================================
-- Migration 0009_views.sql
-- Everest Textile Mills — Complete Production View Definitions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 Raw Material & Inventory Views (W1)
-- ----------------------------------------------------------------------------

-- v_yarn_stock: Live raw material stock, reserved quantities, available balance, and reorder status (FR-1.2, FR-1.3)
CREATE OR REPLACE VIEW v_yarn_stock AS
SELECT 
    yi.yarn_item_id,
    yt.name AS yarn_type_name,
    c.name AS colour_name,
    u.unit_code,
    COALESCE(sb.on_hand_qty, 0.000) AS on_hand_qty,
    COALESCE(sb.reserved_qty, 0.000) AS reserved_qty,
    (COALESCE(sb.on_hand_qty, 0.000) - COALESCE(sb.reserved_qty, 0.000)) AS available_qty,
    yi.reorder_level,
    COALESCE(sb.avg_cost, 0.0000) AS avg_unit_cost,
    ROUND(COALESCE(sb.on_hand_qty, 0.000) * COALESCE(sb.avg_cost, 0.0000), 2) AS total_stock_value,
    CASE 
        WHEN COALESCE(sb.on_hand_qty, 0.000) <= yi.reorder_level THEN true 
        ELSE false 
    END AS is_low_stock,
    sa.alert_id AS open_alert_id,
    sa.status AS alert_status,
    sb.refreshed_at
FROM yarn_item yi
JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
JOIN colour c ON yi.colour_id = c.colour_id
JOIN unit_of_measure u ON yi.unit_id = u.unit_id
LEFT JOIN yarn_stock_balance sb ON yi.yarn_item_id = sb.yarn_item_id
LEFT JOIN stock_alert sa ON yi.yarn_item_id = sa.yarn_item_id AND sa.status IN ('open', 'acknowledged')
WHERE yi.is_active = true;

-- v_open_stock_alerts: Active low-stock alerts requiring management acknowledgement or purchasing action
CREATE OR REPLACE VIEW v_open_stock_alerts AS
SELECT 
    sa.alert_id,
    sa.yarn_item_id,
    yt.name AS yarn_type_name,
    c.name AS colour_name,
    u.unit_code,
    sa.balance_at_trigger,
    yi.reorder_level,
    sa.status,
    sa.opened_at,
    sa.acknowledged_at,
    u_ack.username AS acknowledged_by_username
FROM stock_alert sa
JOIN yarn_item yi ON sa.yarn_item_id = yi.yarn_item_id
JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
JOIN colour c ON yi.colour_id = c.colour_id
JOIN unit_of_measure u ON yi.unit_id = u.unit_id
LEFT JOIN app_user u_ack ON sa.acknowledged_by = u_ack.user_id
WHERE sa.status IN ('open', 'acknowledged');

-- v_unbilled_lots: Received yarn lots awaiting supplier billing/invoicing (FR-1.5, FR-6.1)
CREATE OR REPLACE VIEW v_unbilled_lots AS
SELECT 
    gri.receipt_item_id,
    gr.receipt_no,
    gr.received_at,
    s.supplier_id,
    s.name AS supplier_name,
    gr.supplier_challan_no,
    gri.lot_code,
    yt.name AS yarn_type_name,
    c.name AS colour_name,
    gri.quantity_received,
    u.unit_code,
    gri.unit_rate AS gate_entry_unit_rate,
    ROUND(gri.quantity_received * COALESCE(gri.unit_rate, 0), 2) AS estimated_lot_value,
    sbl.bill_id,
    sb.supplier_bill_no,
    sb.status AS bill_status
FROM goods_receipt_item gri
JOIN goods_receipt gr ON gri.receipt_id = gr.receipt_id
JOIN supplier s ON gr.supplier_id = s.supplier_id
JOIN yarn_item yi ON gri.yarn_item_id = yi.yarn_item_id
JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
JOIN colour c ON yi.colour_id = c.colour_id
JOIN unit_of_measure u ON yi.unit_id = u.unit_id
LEFT JOIN supplier_bill_line sbl ON gri.receipt_item_id = sbl.receipt_item_id
LEFT JOIN supplier_bill sb ON sbl.bill_id = sb.bill_id AND sb.status = 'recorded'
WHERE gr.status = 'received' 
  AND (sbl.bill_line_id IS NULL OR sb.status = 'void');

-- v_supplier_bill_variance: Price and quantity variance between gate receipt and formal supplier invoice (Q6)
CREATE OR REPLACE VIEW v_supplier_bill_variance AS
SELECT 
    sb.bill_id,
    sb.supplier_bill_no,
    sb.bill_date,
    s.name AS supplier_name,
    gr.receipt_no,
    gri.lot_code,
    yt.name AS yarn_type_name,
    c.name AS colour_name,
    gri.quantity_received AS gate_qty,
    sbl.quantity AS billed_qty,
    (sbl.quantity - gri.quantity_received) AS qty_variance,
    gri.unit_rate AS gate_provisional_rate,
    sbl.rate AS billed_rate,
    (sbl.rate - COALESCE(gri.unit_rate, 0)) AS rate_variance,
    sbl.amount AS billed_amount,
    ROUND(gri.quantity_received * COALESCE(gri.unit_rate, 0), 2) AS gate_amount,
    (sbl.amount - ROUND(gri.quantity_received * COALESCE(gri.unit_rate, 0), 2)) AS amount_variance
FROM supplier_bill_line sbl
JOIN supplier_bill sb ON sbl.bill_id = sb.bill_id
JOIN goods_receipt_item gri ON sbl.receipt_item_id = gri.receipt_item_id
JOIN goods_receipt gr ON gri.receipt_id = gr.receipt_id
JOIN supplier s ON sb.supplier_id = s.supplier_id
JOIN yarn_item yi ON gri.yarn_item_id = yi.yarn_item_id
JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
JOIN colour c ON yi.colour_id = c.colour_id
WHERE sb.status = 'recorded';


-- ----------------------------------------------------------------------------
-- 2.2 Customer Orders & Material Requirements Views (W1, W4)
-- ----------------------------------------------------------------------------

-- v_order_material_check: Real-time yarn feasibility check for customer orders (FR-1.4, FR-4.1)
CREATE OR REPLACE VIEW v_order_material_check AS
SELECT 
    co.order_id,
    co.order_no,
    co.status AS order_status,
    oi.order_item_id,
    oi.line_no AS order_line_no,
    fp.name AS fabric_product_name,
    omr.requirement_id,
    yi.yarn_item_id,
    yt.name AS yarn_type_name,
    c.name AS yarn_colour_name,
    omr.required_qty,
    u.unit_code,
    COALESCE(sb.on_hand_qty, 0.000) AS total_on_hand_qty,
    COALESCE(sb.reserved_qty, 0.000) AS total_reserved_qty,
    (COALESCE(sb.on_hand_qty, 0.000) - COALESCE(sb.reserved_qty, 0.000)) AS unreserved_available_qty,
    COALESCE(yr.reserved_qty, 0.000) AS this_order_reserved_qty,
    CASE 
        WHEN COALESCE(yr.reserved_qty, 0.000) >= omr.required_qty THEN 'fully_reserved'
        WHEN (COALESCE(sb.on_hand_qty, 0.000) - COALESCE(sb.reserved_qty, 0.000) + COALESCE(yr.reserved_qty, 0.000)) >= omr.required_qty THEN 'stock_available'
        ELSE 'stock_deficit'
    END AS feasibility_status,
    GREATEST(0.000, omr.required_qty - (COALESCE(sb.on_hand_qty, 0.000) - COALESCE(sb.reserved_qty, 0.000) + COALESCE(yr.reserved_qty, 0.000))) AS shortage_qty
FROM customer_order co
JOIN order_item oi ON co.order_id = oi.order_id
JOIN fabric_product fp ON oi.product_id = fp.product_id
JOIN order_material_requirement omr ON oi.order_item_id = omr.order_item_id
JOIN yarn_item yi ON omr.yarn_item_id = yi.yarn_item_id
JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
JOIN colour c ON yi.colour_id = c.colour_id
JOIN unit_of_measure u ON yi.unit_id = u.unit_id
LEFT JOIN yarn_stock_balance sb ON yi.yarn_item_id = sb.yarn_item_id
LEFT JOIN yarn_reservation yr ON omr.requirement_id = yr.requirement_id AND yr.status = 'active';

-- v_order_status: Centralized Customer Order tracking with dynamic operational stage (FR-4.1, BR-11)
CREATE OR REPLACE VIEW v_order_status AS
WITH order_progress AS (
    SELECT 
        oi.order_id,
        COUNT(DISTINCT oi.order_item_id) AS total_items,
        SUM(oi.ordered_qty) AS total_ordered_qty,
        COALESCE(SUM(fr_stats.total_produced_m), 0.000) AS total_produced_m,
        COALESCE(SUM(fr_stats.passed_qc_m), 0.000) AS passed_qc_m,
        COALESCE(SUM(fr_stats.dispatched_m), 0.000) AS dispatched_m,
        COUNT(DISTINCT pj.job_id) FILTER (WHERE pj.status = 'running') AS active_jobs_count,
        COUNT(DISTINCT pj.job_id) FILTER (WHERE pj.status = 'completed') AS completed_jobs_count,
        COUNT(DISTINCT pj.job_id) AS total_jobs_count
    FROM order_item oi
    LEFT JOIN production_job pj ON oi.order_item_id = pj.order_item_id
    LEFT JOIN (
        SELECT 
            pj2.order_item_id,
            SUM(fr.length_m) AS total_produced_m,
            SUM(fr.length_m) FILTER (WHERE fr.status IN ('in_stock', 'loaded', 'dispatched')) AS passed_qc_m,
            SUM(fr.length_m) FILTER (WHERE fr.status = 'dispatched') AS dispatched_m
        FROM fabric_roll fr
        JOIN production_job pj2 ON fr.job_id = pj2.job_id
        GROUP BY pj2.order_item_id
    ) fr_stats ON oi.order_item_id = fr_stats.order_item_id
    GROUP BY oi.order_id
)
SELECT 
    co.order_id,
    co.order_no,
    b.buyer_id,
    b.name AS buyer_name,
    b.contact AS buyer_contact,
    co.order_date,
    co.promised_delivery_date,
    co.status AS commercial_status,
    COALESCE(op.total_items, 0) AS total_items,
    COALESCE(op.total_ordered_qty, 0.000) AS total_ordered_qty,
    COALESCE(op.total_produced_m, 0.000) AS total_produced_m,
    COALESCE(op.passed_qc_m, 0.000) AS passed_qc_m,
    COALESCE(op.dispatched_m, 0.000) AS dispatched_m,
    CASE 
        WHEN co.status = 'cancelled' THEN 'Cancelled'
        WHEN co.status = 'closed' THEN 'Closed / Completed'
        WHEN co.status = 'draft' THEN 'Draft Order'
        WHEN COALESCE(op.dispatched_m, 0.000) >= COALESCE(op.total_ordered_qty, 0.000) AND op.total_ordered_qty > 0 THEN 'Fully Dispatched'
        WHEN COALESCE(op.dispatched_m, 0.000) > 0 THEN 'Partially Dispatched'
        WHEN COALESCE(op.passed_qc_m, 0.000) >= COALESCE(op.total_ordered_qty, 0.000) AND op.total_ordered_qty > 0 THEN 'Ready for Dispatch'
        WHEN COALESCE(op.total_produced_m, 0.000) > 0 AND COALESCE(op.passed_qc_m, 0.000) < COALESCE(op.total_produced_m, 0.000) THEN 'In Quality Inspection'
        WHEN COALESCE(op.active_jobs_count, 0) > 0 THEN 'In Production'
        WHEN COALESCE(op.total_jobs_count, 0) > 0 THEN 'Production Scheduled'
        ELSE 'Awaiting Material / Planning'
    END AS operational_stage,
    ROUND(
        CASE 
            WHEN COALESCE(op.total_ordered_qty, 0) = 0 THEN 0.00
            ELSE LEAST(100.00, (COALESCE(op.total_produced_m, 0.000) / op.total_ordered_qty) * 100)
        END, 2
    ) AS production_completion_pct,
    co.created_at,
    co.confirmed_at
FROM customer_order co
JOIN buyer b ON co.buyer_id = b.buyer_id
LEFT JOIN order_progress op ON co.order_id = op.order_id;


-- ----------------------------------------------------------------------------
-- 2.3 Production Floor & Live Machine Monitoring Views (W2)
-- ----------------------------------------------------------------------------

-- v_machine_status: Live floor dashboard for machine operations and real-time state (FR-2.1, FR-2.2, FR-2.3)
CREATE OR REPLACE VIEW v_machine_status AS
SELECT 
    m.machine_id,
    m.machine_code,
    ps.stage_id,
    ps.name AS process_stage_name,
    m.description AS machine_description,
    m.is_active AS machine_is_active,
    COALESCE(mse.state, 'idle') AS current_state,
    mse.started_at AS state_started_at,
    ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(mse.started_at, now()))) / 3600.0, 2) AS hours_in_current_state,
    mse.note AS status_note,
    emp_rep.full_name AS reported_by_employee,
    pj.job_id AS current_job_id,
    pj.job_no AS current_job_no,
    pj.planned_qty AS job_planned_qty,
    co.order_no AS current_order_no,
    b.name AS current_buyer_name,
    fp.name AS current_product_name,
    c.name AS current_colour_name,
    COALESCE(today_prod.output_today, 0.000) AS output_produced_today_m,
    u.unit_code AS output_unit
FROM machine m
JOIN process_stage ps ON m.stage_id = ps.stage_id
LEFT JOIN machine_status_event mse ON m.machine_id = mse.machine_id AND mse.ended_at IS NULL
LEFT JOIN employee emp_rep ON mse.reported_by = emp_rep.employee_id
LEFT JOIN production_job pj ON m.machine_id = pj.machine_id AND pj.status = 'running'
LEFT JOIN order_item oi ON pj.order_item_id = oi.order_item_id
LEFT JOIN customer_order co ON oi.order_id = co.order_id
LEFT JOIN buyer b ON co.buyer_id = b.buyer_id
LEFT JOIN fabric_product fp ON oi.product_id = fp.product_id
LEFT JOIN colour c ON oi.colour_id = c.colour_id
LEFT JOIN unit_of_measure u ON fp.unit_id = u.unit_id
LEFT JOIN (
    SELECT 
        pj_sub.machine_id,
        SUM(pl.output_qty) AS output_today
    FROM production_log pl
    JOIN production_job pj_sub ON pl.job_id = pj_sub.job_id
    WHERE pl.logged_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
    GROUP BY pj_sub.machine_id
) today_prod ON m.machine_id = today_prod.machine_id;

-- v_job_progress: Tracking progress against planned quantity for each production job
CREATE OR REPLACE VIEW v_job_progress AS
SELECT 
    pj.job_id,
    pj.job_no,
    co.order_no,
    b.name AS buyer_name,
    ps.name AS process_stage_name,
    m.machine_code,
    fp.name AS fabric_product_name,
    c.name AS colour_name,
    pj.planned_qty,
    u.unit_code,
    COALESCE(SUM(pl.output_qty), 0.000) AS total_logged_output,
    COUNT(DISTINCT fr.roll_id) AS rolls_created_count,
    COALESCE(SUM(fr.length_m), 0.000) AS total_roll_meters,
    (pj.planned_qty - COALESCE(SUM(pl.output_qty), 0.000)) AS remaining_qty,
    ROUND(
        CASE 
            WHEN pj.planned_qty = 0 THEN 0.00
            ELSE LEAST(100.00, (COALESCE(SUM(pl.output_qty), 0.000) / pj.planned_qty) * 100)
        END, 2
    ) AS progress_pct,
    pj.status AS job_status,
    pj.started_at,
    pj.ended_at
FROM production_job pj
JOIN order_item oi ON pj.order_item_id = oi.order_item_id
JOIN customer_order co ON oi.order_id = co.order_id
JOIN buyer b ON co.buyer_id = b.buyer_id
JOIN process_stage ps ON pj.stage_id = ps.stage_id
JOIN machine m ON pj.machine_id = m.machine_id
JOIN fabric_product fp ON oi.product_id = fp.product_id
JOIN colour c ON oi.colour_id = c.colour_id
JOIN unit_of_measure u ON fp.unit_id = u.unit_id
LEFT JOIN production_log pl ON pj.job_id = pl.job_id
LEFT JOIN fabric_roll fr ON pj.job_id = fr.job_id
GROUP BY pj.job_id, pj.job_no, co.order_no, b.name, ps.name, m.machine_code, fp.name, c.name, pj.planned_qty, u.unit_code, pj.status, pj.started_at, pj.ended_at;

-- v_output_by_machine_shift: Shift-wise machine production output aggregation (FR-2.4)
CREATE OR REPLACE VIEW v_output_by_machine_shift AS
SELECT 
    (pl.logged_at AT TIME ZONE 'Asia/Kolkata')::date AS production_date,
    sh.shift_id,
    sh.name AS shift_name,
    m.machine_id,
    m.machine_code,
    ps.name AS process_stage_name,
    emp.employee_id AS operator_id,
    emp.full_name AS operator_name,
    SUM(pl.output_qty) AS shift_output_qty,
    COUNT(pl.log_id) AS log_entries_count
FROM production_log pl
JOIN production_job pj ON pl.job_id = pj.job_id
JOIN machine m ON pj.machine_id = m.machine_id
JOIN process_stage ps ON m.stage_id = ps.stage_id
JOIN shift sh ON pl.shift_id = sh.shift_id
LEFT JOIN employee emp ON pl.operator_id = emp.employee_id
GROUP BY (pl.logged_at AT TIME ZONE 'Asia/Kolkata')::date, sh.shift_id, sh.name, m.machine_id, m.machine_code, ps.name, emp.employee_id, emp.full_name;


-- ----------------------------------------------------------------------------
-- 2.4 Quality Control & Traceability Spine Views (W3)
-- ----------------------------------------------------------------------------

-- v_roll_trace: Complete end-to-end traceability for any fabric roll (FR-3.1, FR-3.4)
CREATE OR REPLACE VIEW v_roll_trace AS
SELECT 
    fr.roll_id,
    fr.roll_code,
    fr.status AS roll_status,
    fr.length_m,
    fr.weight_kg,
    fr.shelf_location,
    fr.created_at AS roll_manufactured_at,
    emp_op.full_name AS operator_name,
    pj.job_no,
    m.machine_code,
    ps.name AS process_stage_name,
    co.order_id,
    co.order_no,
    co.order_date,
    b.buyer_id,
    b.name AS buyer_name,
    fp.name AS fabric_product_name,
    col.name AS colour_name,
    -- QC Inspection summary
    latest_qc.attempt_no AS latest_qc_attempt,
    latest_qc.result AS latest_qc_result,
    latest_qc.inspector_name,
    latest_qc.inspected_at AS latest_inspected_at,
    COALESCE(latest_qc.defect_count, 0) AS total_defects_found,
    latest_qc.defect_summary,
    -- Dispatch and Invoicing summary
    dsp.dispatch_id,
    dsp.dispatch_no,
    dsp.dispatched_at,
    dsp.vehicle_no,
    inv.invoice_id,
    inv.invoice_no,
    inv.invoice_date
FROM fabric_roll fr
JOIN production_job pj ON fr.job_id = pj.job_id
JOIN machine m ON pj.machine_id = m.machine_id
JOIN process_stage ps ON m.stage_id = ps.stage_id
JOIN order_item oi ON pj.order_item_id = oi.order_item_id
JOIN customer_order co ON oi.order_id = co.order_id
JOIN buyer b ON co.buyer_id = b.buyer_id
JOIN fabric_product fp ON oi.product_id = fp.product_id
JOIN colour col ON oi.colour_id = col.colour_id
LEFT JOIN employee emp_op ON fr.operator_id = emp_op.employee_id
LEFT JOIN LATERAL (
    SELECT 
        qi.inspection_id,
        qi.attempt_no,
        qi.result,
        qi.inspected_at,
        emp_qc.full_name AS inspector_name,
        COUNT(qd.defect_id) AS defect_count,
        string_agg(dt.name || ' (' || qd.severity || ' x' || qd.defect_count || ')', ', ') AS defect_summary
    FROM qc_inspection qi
    JOIN employee emp_qc ON qi.inspector_id = emp_qc.employee_id
    LEFT JOIN qc_defect qd ON qi.inspection_id = qd.inspection_id
    LEFT JOIN defect_type dt ON qd.defect_type_id = dt.defect_type_id
    WHERE qi.roll_id = fr.roll_id
    GROUP BY qi.inspection_id, qi.attempt_no, qi.result, qi.inspected_at, emp_qc.full_name
    ORDER BY qi.attempt_no DESC
    LIMIT 1
) latest_qc ON true
LEFT JOIN dispatch_item di ON fr.roll_id = di.roll_id AND di.state = 'active'
LEFT JOIN dispatch dsp ON di.dispatch_id = dsp.dispatch_id
LEFT JOIN invoice inv ON dsp.invoice_id = inv.invoice_id;

-- v_defects_by_machine: Machine-level defect analytics for quality improvements (FR-3.4)
CREATE OR REPLACE VIEW v_defects_by_machine AS
SELECT 
    m.machine_id,
    m.machine_code,
    ps.name AS process_stage_name,
    dt.defect_type_id,
    dt.name AS defect_type_name,
    qd.severity,
    COUNT(qd.defect_id) AS incident_count,
    SUM(qd.defect_count) AS total_defects_count
FROM qc_defect qd
JOIN qc_inspection qi ON qd.inspection_id = qi.inspection_id
JOIN fabric_roll fr ON qi.roll_id = fr.roll_id
JOIN production_job pj ON fr.job_id = pj.job_id
JOIN machine m ON pj.machine_id = m.machine_id
JOIN process_stage ps ON m.stage_id = ps.stage_id
JOIN defect_type dt ON qd.defect_type_id = dt.defect_type_id
GROUP BY m.machine_id, m.machine_code, ps.name, dt.defect_type_id, dt.name, qd.severity;

-- v_defects_by_operator: Operator-level defect analytics
CREATE OR REPLACE VIEW v_defects_by_operator AS
SELECT 
    emp.employee_id AS operator_id,
    emp.full_name AS operator_name,
    dt.defect_type_id,
    dt.name AS defect_type_name,
    qd.severity,
    COUNT(qd.defect_id) AS incident_count,
    SUM(qd.defect_count) AS total_defects_count
FROM qc_defect qd
JOIN qc_inspection qi ON qd.inspection_id = qi.inspection_id
JOIN fabric_roll fr ON qi.roll_id = fr.roll_id
JOIN employee emp ON fr.operator_id = emp.employee_id
JOIN defect_type dt ON qd.defect_type_id = dt.defect_type_id
GROUP BY emp.employee_id, emp.full_name, dt.defect_type_id, dt.name, qd.severity;


-- ----------------------------------------------------------------------------
-- 2.5 Inventory Shelf, Dispatch & Invoicing Views (W5)
-- ----------------------------------------------------------------------------

-- v_dispatch_progress: Real-time loading progress and missing item detection (FR-5.4)
CREATE OR REPLACE VIEW v_dispatch_progress AS
SELECT 
    co.order_id,
    co.order_no,
    b.name AS buyer_name,
    oi.order_item_id,
    fp.name AS fabric_product_name,
    c.name AS colour_name,
    oi.ordered_qty,
    u.unit_code,
    COALESCE(stock_stats.ready_in_stock_rolls, 0) AS ready_in_stock_rolls,
    COALESCE(stock_stats.ready_in_stock_meters, 0.000) AS ready_in_stock_meters,
    COALESCE(disp_stats.loaded_rolls, 0) AS currently_loaded_rolls,
    COALESCE(disp_stats.loaded_meters, 0.000) AS currently_loaded_meters,
    COALESCE(disp_stats.dispatched_rolls, 0) AS dispatched_rolls,
    COALESCE(disp_stats.dispatched_meters, 0.000) AS dispatched_meters,
    GREATEST(0.000, oi.ordered_qty - (COALESCE(disp_stats.dispatched_meters, 0.000) + COALESCE(disp_stats.loaded_meters, 0.000))) AS remaining_to_dispatch_meters
FROM order_item oi
JOIN customer_order co ON oi.order_id = co.order_id
JOIN buyer b ON co.buyer_id = b.buyer_id
JOIN fabric_product fp ON oi.product_id = fp.product_id
JOIN colour c ON oi.colour_id = c.colour_id
JOIN unit_of_measure u ON fp.unit_id = u.unit_id
LEFT JOIN (
    SELECT 
        pj.order_item_id,
        COUNT(fr.roll_id) AS ready_in_stock_rolls,
        SUM(fr.length_m) AS ready_in_stock_meters
    FROM fabric_roll fr
    JOIN production_job pj ON fr.job_id = pj.job_id
    WHERE fr.status = 'in_stock'
    GROUP BY pj.order_item_id
) stock_stats ON oi.order_item_id = stock_stats.order_item_id
LEFT JOIN (
    SELECT 
        pj.order_item_id,
        COUNT(fr.roll_id) FILTER (WHERE fr.status = 'loaded') AS loaded_rolls,
        SUM(fr.length_m) FILTER (WHERE fr.status = 'loaded') AS loaded_meters,
        COUNT(fr.roll_id) FILTER (WHERE fr.status = 'dispatched') AS dispatched_rolls,
        SUM(fr.length_m) FILTER (WHERE fr.status = 'dispatched') AS dispatched_meters
    FROM fabric_roll fr
    JOIN production_job pj ON fr.job_id = pj.job_id
    GROUP BY pj.order_item_id
) disp_stats ON oi.order_item_id = disp_stats.order_item_id
WHERE co.status IN ('confirmed', 'closed');

-- v_dispatch_lines: Roll summary per dispatch ready for invoice creation (FR-5.5)
CREATE OR REPLACE VIEW v_dispatch_lines AS
SELECT 
    d.dispatch_id,
    d.dispatch_no,
    d.status AS dispatch_status,
    d.buyer_id,
    b.name AS buyer_name,
    d.order_id,
    co.order_no,
    oi.order_item_id,
    fp.name AS fabric_product_name,
    c.name AS colour_name,
    oi.agreed_rate,
    COUNT(di.dispatch_item_id) AS roll_count,
    SUM(fr.length_m) AS total_length_m,
    SUM(COALESCE(fr.weight_kg, 0.000)) AS total_weight_kg,
    ROUND(SUM(fr.length_m) * oi.agreed_rate, 2) AS calculated_line_amount
FROM dispatch d
JOIN buyer b ON d.buyer_id = b.buyer_id
JOIN customer_order co ON d.order_id = co.order_id
JOIN dispatch_item di ON d.dispatch_id = di.dispatch_id AND di.state = 'active'
JOIN fabric_roll fr ON di.roll_id = fr.roll_id
JOIN production_job pj ON fr.job_id = pj.job_id
JOIN order_item oi ON pj.order_item_id = oi.order_item_id
GROUP BY d.dispatch_id, d.dispatch_no, d.status, d.buyer_id, b.name, d.order_id, co.order_no, oi.order_item_id, fp.name, c.name, oi.agreed_rate;

-- v_invoice_balance: Customer sales invoice balances and payment reconciliation (FR-6.3)
CREATE OR REPLACE VIEW v_invoice_balance AS
SELECT 
    i.invoice_id,
    i.invoice_no,
    i.buyer_id,
    b.name AS buyer_name,
    i.invoice_date,
    i.status AS invoice_status,
    i.total_amount AS invoice_total_amount,
    COALESCE(SUM(pa.allocated_amount), 0.00) AS total_paid_amount,
    (i.total_amount - COALESCE(SUM(pa.allocated_amount), 0.00)) AS outstanding_balance,
    CASE 
        WHEN i.status = 'void' THEN 'Void'
        WHEN i.status = 'draft' THEN 'Draft'
        WHEN COALESCE(SUM(pa.allocated_amount), 0.00) >= i.total_amount THEN 'Paid'
        WHEN COALESCE(SUM(pa.allocated_amount), 0.00) > 0 THEN 'Partially Paid'
        ELSE 'Unpaid'
    END AS payment_status,
    (CURRENT_DATE - i.invoice_date) AS invoice_age_days
FROM invoice i
JOIN buyer b ON i.buyer_id = b.buyer_id
LEFT JOIN payment_allocation pa ON i.invoice_id = pa.invoice_id
GROUP BY i.invoice_id, i.invoice_no, i.buyer_id, b.name, i.invoice_date, i.status, i.total_amount;

-- v_dispatch_invoice_match: Exception reconciliation: dispatched loads vs invoiced quantities (FR-5.5)
CREATE OR REPLACE VIEW v_dispatch_invoice_match AS
SELECT 
    d.dispatch_id,
    d.dispatch_no,
    d.dispatched_at,
    d.status AS dispatch_status,
    b.name AS buyer_name,
    co.order_no,
    d.invoice_id,
    inv.invoice_no,
    inv.status AS invoice_status,
    disp_summary.total_dispatched_rolls,
    disp_summary.total_dispatched_meters,
    inv_summary.total_invoiced_qty,
    (COALESCE(disp_summary.total_dispatched_meters, 0.000) - COALESCE(inv_summary.total_invoiced_qty, 0.000)) AS quantity_discrepancy,
    CASE 
        WHEN d.invoice_id IS NULL THEN 'Dispatched Without Invoice'
        WHEN inv.status = 'void' THEN 'Invoice Voided'
        WHEN ABS(COALESCE(disp_summary.total_dispatched_meters, 0.000) - COALESCE(inv_summary.total_invoiced_qty, 0.000)) > 0.001 THEN 'Quantity Mismatch'
        ELSE 'Matched'
    END AS reconciliation_status
FROM dispatch d
JOIN buyer b ON d.buyer_id = b.buyer_id
JOIN customer_order co ON d.order_id = co.order_id
LEFT JOIN invoice inv ON d.invoice_id = inv.invoice_id
LEFT JOIN (
    SELECT 
        di.dispatch_id,
        COUNT(di.dispatch_item_id) AS total_dispatched_rolls,
        SUM(fr.length_m) AS total_dispatched_meters
    FROM dispatch_item di
    JOIN fabric_roll fr ON di.roll_id = fr.roll_id
    WHERE di.state = 'active'
    GROUP BY di.dispatch_id
) disp_summary ON d.dispatch_id = disp_summary.dispatch_id
LEFT JOIN (
    SELECT 
        ii.invoice_id,
        SUM(ii.quantity) AS total_invoiced_qty
    FROM invoice_item ii
    GROUP BY ii.invoice_id
) inv_summary ON d.invoice_id = inv_summary.invoice_id
WHERE d.status = 'dispatched';

-- v_buyer_ledger: Chronological financial ledger of customer transactions, debits, credits, and balances
CREATE OR REPLACE VIEW v_buyer_ledger AS
WITH transactions AS (
    -- Invoices as Debits
    SELECT 
        i.buyer_id,
        i.invoice_date AS txn_date,
        i.created_at AS recorded_at,
        'INVOICE' AS txn_type,
        i.invoice_no AS document_ref,
        i.total_amount AS debit_amount,
        0.00::money_t AS credit_amount,
        'Invoice issued' AS description
    FROM invoice i
    WHERE i.status = 'issued'

    UNION ALL

    -- Payments as Credits
    SELECT 
        bp.buyer_id,
        bp.received_on AS txn_date,
        bp.created_at AS recorded_at,
        'PAYMENT' AS txn_type,
        bp.payment_ref AS document_ref,
        0.00::money_t AS debit_amount,
        bp.amount AS credit_amount,
        'Payment received (' || bp.mode || COALESCE(' Ref: ' || bp.instrument_ref, '') || ')' AS description
    FROM buyer_payment bp
    WHERE bp.status = 'recorded'
)
SELECT 
    t.buyer_id,
    b.name AS buyer_name,
    t.txn_date,
    t.recorded_at,
    t.txn_type,
    t.document_ref,
    t.description,
    t.debit_amount,
    t.credit_amount,
    SUM(t.debit_amount - t.credit_amount) OVER (
        PARTITION BY t.buyer_id 
        ORDER BY t.txn_date, t.recorded_at, t.document_ref
    ) AS running_balance
FROM transactions t
JOIN buyer b ON t.buyer_id = b.buyer_id;


-- ----------------------------------------------------------------------------
-- 2.6 Workforce, Costing & Financial Analytics Views (W6)
-- ----------------------------------------------------------------------------

-- v_wage_summary: Monthly wage calculation summary per employee (FR-6.2)
CREATE OR REPLACE VIEW v_wage_summary AS
SELECT 
    wr.wage_id,
    wr.period_id,
    ap.period_start,
    ap.period_end,
    emp.employee_id,
    emp.employee_code,
    emp.full_name AS employee_name,
    emp.designation,
    emp.pay_basis,
    emp.pay_rate,
    COALESCE(att_summary.days_present, 0) AS days_present,
    COALESCE(att_summary.days_half_day, 0) AS days_half_day,
    COALESCE(att_summary.days_absent, 0) AS days_absent,
    COALESCE(att_summary.total_hours_worked, 0.00) AS total_hours_worked,
    wr.gross_amount AS computed_gross_wage,
    wr.basis_note,
    wr.status AS wage_status,
    wr.approved_at,
    u_appr.username AS approved_by_username
FROM wage_record wr
JOIN accounting_period ap ON wr.period_id = ap.period_id
JOIN employee emp ON wr.employee_id = emp.employee_id
LEFT JOIN app_user u_appr ON wr.approved_by = u_appr.user_id
LEFT JOIN (
    SELECT 
        ar.employee_id,
        COUNT(ar.attendance_id) FILTER (WHERE ar.status = 'present') AS days_present,
        COUNT(ar.attendance_id) FILTER (WHERE ar.status = 'half_day') AS days_half_day,
        COUNT(ar.attendance_id) FILTER (WHERE ar.status = 'absent') AS days_absent,
        SUM(ar.hours_worked) AS total_hours_worked,
        ap2.period_id
    FROM attendance_record ar
    JOIN accounting_period ap2 ON ar.work_date BETWEEN ap2.period_start AND ap2.period_end
    GROUP BY ar.employee_id, ap2.period_id
) att_summary ON wr.employee_id = att_summary.employee_id AND wr.period_id = att_summary.period_id;

-- v_order_cost: Direct material consumption cost and revenue margin per order (FR-6.4, BR-9)
CREATE OR REPLACE VIEW v_order_cost AS
WITH order_material_cost AS (
    SELECT 
        ce.order_id,
        SUM(ce.amount) AS total_material_cost
    FROM cost_entry ce
    WHERE ce.cost_type = 'material' AND ce.order_id IS NOT NULL
    GROUP BY ce.order_id
),
order_revenue AS (
    SELECT 
        co.order_id,
        SUM(ii.amount) AS invoiced_revenue
    FROM customer_order co
    JOIN order_item oi ON co.order_id = oi.order_id
    JOIN invoice_item ii ON oi.order_item_id = ii.order_item_id
    JOIN invoice i ON ii.invoice_id = i.invoice_id
    WHERE i.status = 'issued'
    GROUP BY co.order_id
)
SELECT 
    co.order_id,
    co.order_no,
    b.name AS buyer_name,
    co.order_date,
    co.status AS order_status,
    COALESCE(rev.invoiced_revenue, 0.00) AS total_revenue,
    COALESCE(mat.total_material_cost, 0.00) AS total_material_cost,
    (COALESCE(rev.invoiced_revenue, 0.00) - COALESCE(mat.total_material_cost, 0.00)) AS gross_contribution_margin,
    ROUND(
        CASE 
            WHEN COALESCE(rev.invoiced_revenue, 0) = 0 THEN 0.00
            ELSE ((COALESCE(rev.invoiced_revenue, 0.00) - COALESCE(mat.total_material_cost, 0.00)) / rev.invoiced_revenue) * 100
        END, 2
    ) AS gross_margin_pct
FROM customer_order co
JOIN buyer b ON co.buyer_id = b.buyer_id
LEFT JOIN order_material_cost mat ON co.order_id = mat.order_id
LEFT JOIN order_revenue rev ON co.order_id = rev.order_id;

-- v_roll_cost: Direct material and allocated indirect cost per fabric roll (Q7, FR-6.7)
CREATE OR REPLACE VIEW v_roll_cost AS
WITH period_totals AS (
    SELECT 
        ce.period_id,
        SUM(ce.amount) FILTER (WHERE ce.cost_type = 'wage') AS total_wages,
        SUM(ce.amount) FILTER (WHERE ce.cost_type = 'overhead') AS total_overhead,
        COALESCE(SUM(fr_sub.length_m), 1.000) AS total_plant_meters
    FROM cost_entry ce
    LEFT JOIN (
        SELECT 
            ap_sub.period_id,
            SUM(fr2.length_m) AS length_m
        FROM fabric_roll fr2
        JOIN accounting_period ap_sub ON (fr2.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN ap_sub.period_start AND ap_sub.period_end
        GROUP BY ap_sub.period_id
    ) fr_sub ON ce.period_id = fr_sub.period_id
    GROUP BY ce.period_id
)
SELECT 
    fr.roll_id,
    fr.roll_code,
    fr.length_m,
    co.order_no,
    b.name AS buyer_name,
    fp.name AS fabric_product_name,
    ap.period_id,
    -- Material cost pro-rata to roll length over total order length
    ROUND(COALESCE(ord_cost.total_material_cost, 0.00) * (fr.length_m / NULLIF(ord_len.total_order_m, 0)), 2) AS estimated_material_cost,
    -- Indirect wage & overhead cost allocated pro-rata to plant production meters (Q7)
    ROUND(COALESCE(pt.total_wages, 0.00) * (fr.length_m / NULLIF(pt.total_plant_meters, 0)), 2) AS allocated_wage_cost,
    ROUND(COALESCE(pt.total_overhead, 0.00) * (fr.length_m / NULLIF(pt.total_plant_meters, 0)), 2) AS allocated_overhead_cost,
    (
        ROUND(COALESCE(ord_cost.total_material_cost, 0.00) * (fr.length_m / NULLIF(ord_len.total_order_m, 0)), 2) +
        ROUND(COALESCE(pt.total_wages, 0.00) * (fr.length_m / NULLIF(pt.total_plant_meters, 0)), 2) +
        ROUND(COALESCE(pt.total_overhead, 0.00) * (fr.length_m / NULLIF(pt.total_plant_meters, 0)), 2)
    ) AS total_estimated_roll_cost
FROM fabric_roll fr
JOIN production_job pj ON fr.job_id = pj.job_id
JOIN order_item oi ON pj.order_item_id = oi.order_item_id
JOIN customer_order co ON oi.order_id = co.order_id
JOIN buyer b ON co.buyer_id = b.buyer_id
JOIN fabric_product fp ON oi.product_id = fp.product_id
JOIN accounting_period ap ON (fr.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN ap.period_start AND ap.period_end
LEFT JOIN period_totals pt ON ap.period_id = pt.period_id
LEFT JOIN (
    SELECT order_id, SUM(amount) AS total_material_cost FROM cost_entry WHERE cost_type = 'material' GROUP BY order_id
) ord_cost ON co.order_id = ord_cost.order_id
LEFT JOIN (
    SELECT pj_in.order_item_id, SUM(fr_in.length_m) AS total_order_m 
    FROM fabric_roll fr_in JOIN production_job pj_in ON fr_in.job_id = pj_in.job_id GROUP BY pj_in.order_item_id
) ord_len ON oi.order_item_id = ord_len.order_item_id;

-- v_machine_output: Monthly machine utilization and productivity reporting (FR-6.5)
CREATE OR REPLACE VIEW v_machine_output AS
SELECT 
    m.machine_id,
    m.machine_code,
    ps.name AS process_stage_name,
    ap.period_id,
    ap.period_start,
    ap.period_end,
    COALESCE(prod.total_output_qty, 0.000) AS total_output_produced,
    COALESCE(prod.logs_count, 0) AS total_logs_count,
    COALESCE(downtime.breakdown_hours, 0.00) AS breakdown_hours,
    COALESCE(downtime.maintenance_hours, 0.00) AS maintenance_hours
FROM machine m
JOIN process_stage ps ON m.stage_id = ps.stage_id
CROSS JOIN accounting_period ap
LEFT JOIN (
    SELECT 
        pj.machine_id,
        ap_sub.period_id,
        SUM(pl.output_qty) AS total_output_qty,
        COUNT(pl.log_id) AS logs_count
    FROM production_log pl
    JOIN production_job pj ON pl.job_id = pj.job_id
    JOIN accounting_period ap_sub ON (pl.logged_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN ap_sub.period_start AND ap_sub.period_end
    GROUP BY pj.machine_id, ap_sub.period_id
) prod ON m.machine_id = prod.machine_id AND ap.period_id = prod.period_id
LEFT JOIN (
    SELECT 
        mse.machine_id,
        ap_sub.period_id,
        ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(mse.ended_at, now()) - mse.started_at)) / 3600.0) FILTER (WHERE mse.state = 'breakdown'), 2) AS breakdown_hours,
        ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(mse.ended_at, now()) - mse.started_at)) / 3600.0) FILTER (WHERE mse.state = 'maintenance'), 2) AS maintenance_hours
    FROM machine_status_event mse
    JOIN accounting_period ap_sub ON (mse.started_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN ap_sub.period_start AND ap_sub.period_end
    GROUP BY mse.machine_id, ap_sub.period_id
) downtime ON m.machine_id = downtime.machine_id AND ap.period_id = downtime.period_id;

-- v_monthly_pl: Executive Monthly Mill Profit and Loss Statement (FR-6.6)
CREATE OR REPLACE VIEW v_monthly_pl AS
WITH period_revenue AS (
    SELECT 
        ap.period_id,
        COALESCE(SUM(i.total_amount), 0.00) AS gross_sales_revenue
    FROM accounting_period ap
    LEFT JOIN invoice i ON i.invoice_date BETWEEN ap.period_start AND ap.period_end AND i.status = 'issued'
    GROUP BY ap.period_id
),
period_costs AS (
    SELECT 
        ce.period_id,
        COALESCE(SUM(ce.amount) FILTER (WHERE ce.cost_type = 'material'), 0.00) AS material_expense,
        COALESCE(SUM(ce.amount) FILTER (WHERE ce.cost_type = 'wage'), 0.00) AS wage_expense,
        COALESCE(SUM(ce.amount) FILTER (WHERE ce.cost_type = 'overhead'), 0.00) AS overhead_expense,
        COALESCE(SUM(ce.amount), 0.00) AS total_expense
    FROM cost_entry ce
    GROUP BY ce.period_id
)
SELECT 
    ap.period_id,
    ap.period_start,
    ap.period_end,
    ap.status AS period_status,
    COALESCE(r.gross_sales_revenue, 0.00) AS gross_sales_revenue,
    COALESCE(c.material_expense, 0.00) AS material_expense,
    COALESCE(c.wage_expense, 0.00) AS wage_expense,
    COALESCE(c.overhead_expense, 0.00) AS overhead_expense,
    COALESCE(c.total_expense, 0.00) AS total_operating_expenses,
    (COALESCE(r.gross_sales_revenue, 0.00) - COALESCE(c.total_expense, 0.00)) AS net_profit_loss,
    ROUND(
        CASE 
            WHEN COALESCE(r.gross_sales_revenue, 0) = 0 THEN 0.00
            ELSE ((COALESCE(r.gross_sales_revenue, 0.00) - COALESCE(c.total_expense, 0.00)) / r.gross_sales_revenue) * 100
        END, 2
    ) AS net_profit_margin_pct
FROM accounting_period ap
LEFT JOIN period_revenue r ON ap.period_id = r.period_id
LEFT JOIN period_costs c ON ap.period_id = c.period_id;


-- ----------------------------------------------------------------------------
-- 2.7 Mandatory Health & Reconciliation Views (Doc 05 §13 / Section 7)
-- ----------------------------------------------------------------------------

-- 1. v_recon_stock_balance_vs_ledger: Verifies INV-1 (Stock Balance cache equals sum of ledger)
CREATE OR REPLACE VIEW v_recon_stock_balance_vs_ledger AS
SELECT 
    yi.yarn_item_id,
    yt.name AS yarn_type_name,
    c.name AS colour_name,
    sb.on_hand_qty AS cached_on_hand_qty,
    COALESCE(SUM(m.quantity), 0.000) AS ledger_sum_qty,
    (sb.on_hand_qty - COALESCE(SUM(m.quantity), 0.000)) AS discrepancy_qty
FROM yarn_item yi
JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
JOIN colour c ON yi.colour_id = c.colour_id
JOIN yarn_stock_balance sb ON yi.yarn_item_id = sb.yarn_item_id
LEFT JOIN yarn_stock_movement m ON yi.yarn_item_id = m.yarn_item_id
GROUP BY yi.yarn_item_id, yt.name, c.name, sb.on_hand_qty
HAVING sb.on_hand_qty <> COALESCE(SUM(m.quantity), 0.000);

-- 2. v_recon_reserved_vs_reservations: Verifies INV-9 (Cached reserved quantity equals sum of active reservations)
CREATE OR REPLACE VIEW v_recon_reserved_vs_reservations AS
SELECT 
    yi.yarn_item_id,
    yt.name AS yarn_type_name,
    c.name AS colour_name,
    sb.reserved_qty AS cached_reserved_qty,
    COALESCE(SUM(yr.reserved_qty), 0.000) AS active_reservations_sum,
    (sb.reserved_qty - COALESCE(SUM(yr.reserved_qty), 0.000)) AS discrepancy_qty
FROM yarn_item yi
JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
JOIN colour c ON yi.colour_id = c.colour_id
JOIN yarn_stock_balance sb ON yi.yarn_item_id = sb.yarn_item_id
LEFT JOIN order_material_requirement omr ON yi.yarn_item_id = omr.yarn_item_id
LEFT JOIN yarn_reservation yr ON omr.requirement_id = yr.requirement_id AND yr.status = 'active'
GROUP BY yi.yarn_item_id, yt.name, c.name, sb.reserved_qty
HAVING sb.reserved_qty <> COALESCE(SUM(yr.reserved_qty), 0.000);

-- 3. v_recon_roll_status_vs_facts: Detects inconsistencies between fabric roll status and operational facts
CREATE OR REPLACE VIEW v_recon_roll_status_vs_facts AS
SELECT 
    fr.roll_id,
    fr.roll_code,
    fr.status AS stored_status,
    di.dispatch_item_id,
    di.state AS dispatch_line_state,
    d.status AS dispatch_status,
    last_qc.result AS latest_qc_result,
    CASE 
        WHEN fr.status = 'loaded' AND (di.dispatch_item_id IS NULL OR di.state <> 'active' OR d.status <> 'loading') 
            THEN 'Roll is marked loaded but has no active loading dispatch item'
        WHEN fr.status = 'dispatched' AND (di.dispatch_item_id IS NULL OR di.state <> 'active' OR d.status <> 'dispatched') 
            THEN 'Roll is marked dispatched but has no active dispatched dispatch item'
        WHEN fr.status = 'in_stock' AND last_qc.result IS DISTINCT FROM 'passed' 
            THEN 'Roll is marked in_stock but did not pass latest QC inspection'
        WHEN di.state = 'active' AND d.status = 'loading' AND fr.status <> 'loaded' 
            THEN 'Active loading line exists but roll status is not loaded'
        WHEN di.state = 'active' AND d.status = 'dispatched' AND fr.status <> 'dispatched' 
            THEN 'Active dispatched line exists but roll status is not dispatched'
        ELSE 'Unknown inconsistency'
    END AS violation_description
FROM fabric_roll fr
LEFT JOIN dispatch_item di ON fr.roll_id = di.roll_id AND di.state = 'active'
LEFT JOIN dispatch d ON di.dispatch_id = d.dispatch_id
LEFT JOIN LATERAL (
    SELECT result FROM qc_inspection qi WHERE qi.roll_id = fr.roll_id ORDER BY qi.attempt_no DESC LIMIT 1
) last_qc ON true
WHERE (fr.status = 'loaded' AND (di.dispatch_item_id IS NULL OR di.state <> 'active' OR d.status <> 'loading'))
   OR (fr.status = 'dispatched' AND (di.dispatch_item_id IS NULL OR di.state <> 'active' OR d.status <> 'dispatched'))
   OR (fr.status = 'in_stock' AND last_qc.result IS DISTINCT FROM 'passed')
   OR (di.state = 'active' AND d.status = 'loading' AND fr.status <> 'loaded')
   OR (di.state = 'active' AND d.status = 'dispatched' AND fr.status <> 'dispatched');

-- 4. v_recon_machine_events: Detects mismatch between running jobs and open machine status events (INV-3)
CREATE OR REPLACE VIEW v_recon_machine_events AS
SELECT 
    m.machine_id,
    m.machine_code,
    pj.job_id AS running_job_id,
    pj.job_no AS running_job_no,
    mse.event_id AS open_event_id,
    mse.state AS open_event_state,
    CASE 
        WHEN pj.job_id IS NOT NULL AND mse.event_id IS NULL THEN 'Job is running but machine has no open status event'
        WHEN pj.job_id IS NOT NULL AND mse.state <> 'running' THEN 'Job is running but open machine status is ' || mse.state
        WHEN pj.job_id IS NULL AND mse.state = 'running' THEN 'Machine open status is running but no running job exists'
        ELSE 'Unknown inconsistency'
    END AS anomaly_reason
FROM machine m
LEFT JOIN production_job pj ON m.machine_id = pj.machine_id AND pj.status = 'running'
LEFT JOIN machine_status_event mse ON m.machine_id = mse.machine_id AND mse.ended_at IS NULL
WHERE (pj.job_id IS NOT NULL AND (mse.event_id IS NULL OR mse.state <> 'running'))
   OR (pj.job_id IS NULL AND mse.state = 'running');

-- 5. v_recon_dispatch_vs_invoice: Dispatched loads with invoice mismatches or missing billings
CREATE OR REPLACE VIEW v_recon_dispatch_vs_invoice AS
SELECT * FROM v_dispatch_invoice_match WHERE reconciliation_status <> 'Matched';

-- 6. v_recon_unallocated_payments: Buyer payments with unallocated credit balances (advances)
CREATE OR REPLACE VIEW v_recon_unallocated_payments AS
SELECT 
    bp.payment_id,
    bp.payment_ref,
    bp.buyer_id,
    b.name AS buyer_name,
    bp.received_on,
    bp.amount AS payment_amount,
    COALESCE(SUM(pa.allocated_amount), 0.00) AS allocated_amount,
    (bp.amount - COALESCE(SUM(pa.allocated_amount), 0.00)) AS unallocated_credit_balance
FROM buyer_payment bp
JOIN buyer b ON bp.buyer_id = b.buyer_id
LEFT JOIN payment_allocation pa ON bp.payment_id = pa.payment_id
WHERE bp.status = 'recorded'
GROUP BY bp.payment_id, bp.payment_ref, bp.buyer_id, b.name, bp.received_on, bp.amount
HAVING (bp.amount - COALESCE(SUM(pa.allocated_amount), 0.00)) > 0.00;

-- 7. v_recon_cost_vs_issues: Raw material issue movements without matching cost ledger entries
CREATE OR REPLACE VIEW v_recon_cost_vs_issues AS
SELECT 
    ysm.movement_id,
    ysm.yarn_item_id,
    yt.name AS yarn_type_name,
    c.name AS colour_name,
    ysm.quantity,
    ysm.unit_cost,
    ysm.production_job_id,
    pj.job_no,
    ysm.occurred_at
FROM yarn_stock_movement ysm
JOIN yarn_item yi ON ysm.yarn_item_id = yi.yarn_item_id
JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
JOIN colour c ON yi.colour_id = c.colour_id
JOIN production_job pj ON ysm.production_job_id = pj.job_id
LEFT JOIN cost_entry ce ON ysm.movement_id = ce.movement_id
WHERE ysm.movement_type = 'issue' AND ce.cost_id IS NULL;
```

---

## 3. Core Query Catalog & Access Patterns

This catalog defines the exact parameterized SQL queries executed by the application backend for each business workflow, specifying sorting, filtering, joins, and supported indexes.

### 3.1 Gate Store & Raw Material Queries (W1)

#### Query Q-W1.1: Live Yarn Stock List with Low-Stock Filter
* **Triggered by:** Gate Store screen, Material Purchasing screen.
* **Access pattern:** Filter by low-stock status or yarn type; sort by yarn name.
```sql
SELECT 
    yarn_item_id, yarn_type_name, colour_name, unit_code,
    on_hand_qty, reserved_qty, available_qty, reorder_level,
    avg_unit_cost, total_stock_value, is_low_stock, open_alert_id
FROM v_yarn_stock
WHERE ($1::boolean IS NULL OR is_low_stock = $1)
  AND ($2::text IS NULL OR yarn_type_name ILIKE $2 || '%')
ORDER BY yarn_type_name ASC, colour_name ASC;
```

#### Query Q-W1.2: Unbilled Gate Receipts for Supplier Bill Entry
* **Triggered by:** Accounts Clerk entering supplier invoice.
```sql
SELECT 
    receipt_item_id, receipt_no, received_at, supplier_name,
    supplier_challan_no, lot_code, yarn_type_name, colour_name,
    quantity_received, unit_code, gate_entry_unit_rate, estimated_lot_value
FROM v_unbilled_lots
WHERE supplier_id = $1
ORDER BY received_at ASC;
```

---

### 3.2 Production Floor & Live Machine Monitoring Queries (W2)

#### Query Q-W2.1: Real-Time Factory Floor Machine Matrix
* **Triggered by:** Floor Manager Live Dashboard (refreshes periodically or on WebSocket event).
```sql
SELECT 
    machine_id, machine_code, process_stage_name, current_state,
    hours_in_current_state, status_note, reported_by_employee,
    current_job_no, current_order_no, current_buyer_name,
    current_product_name, current_colour_name, output_produced_today_m, output_unit
FROM v_machine_status
WHERE ($1::bigint IS NULL OR stage_id = $1)
ORDER BY stage_id ASC, machine_code ASC;
```

#### Query Q-W2.2: Shift Output Audit Log (Keyset Paginated)
* **Triggered by:** Shift Supervisor closing shift or viewing historical logs.
```sql
SELECT 
    pl.log_id, pl.logged_at, pj.job_no, m.machine_code,
    sh.name AS shift_name, emp.full_name AS operator_name,
    pl.output_qty, pl.reason
FROM production_log pl
JOIN production_job pj ON pl.job_id = pj.job_id
JOIN machine m ON pj.machine_id = m.machine_id
JOIN shift sh ON pl.shift_id = sh.shift_id
LEFT JOIN employee emp ON pl.operator_id = emp.employee_id
WHERE ($1::bigint IS NULL OR pj.job_id = $1)
  AND ($2::timestamptz IS NULL OR pl.logged_at < $2)
ORDER BY pl.logged_at DESC, pl.log_id DESC
LIMIT $3;
```

---

### 3.3 Quality Inspection & Roll Tagging Queries (W3)

#### Query Q-W3.1: Pending QC Roll Queue
* **Triggered by:** Quality Checker terminal / barcode scan lookup.
```sql
SELECT 
    fr.roll_id, fr.roll_code, fr.length_m, fr.weight_kg,
    fr.status, fr.created_at, m.machine_code, co.order_no,
    fp.name AS fabric_product_name, c.name AS colour_name
FROM fabric_roll fr
JOIN production_job pj ON fr.job_id = pj.job_id
JOIN machine m ON pj.machine_id = m.machine_id
JOIN order_item oi ON pj.order_item_id = oi.order_item_id
JOIN customer_order co ON oi.order_id = co.order_id
JOIN fabric_product fp ON oi.product_id = fp.product_id
JOIN colour c ON oi.colour_id = c.colour_id
WHERE fr.status = 'pending_qc'
ORDER BY fr.created_at ASC;
```

#### Query Q-W3.2: Complete Single-Roll Traceability Dossier
* **Triggered by:** Scanning roll QR code or investigating customer defect complaint.
```sql
SELECT * FROM v_roll_trace WHERE roll_code = $1;
```

---

### 3.4 Customer Order Status & Phone Inquiry Queries (W4)

#### Query Q-W4.1: Instant Buyer Phone Inquiry Lookup (Fast Search)
* **Triggered by:** Sales / Customer Support desk when buyer calls (FR-4.1, FR-4.2).
```sql
SELECT 
    order_id, order_no, buyer_name, buyer_contact,
    order_date, promised_delivery_date, commercial_status,
    operational_stage, production_completion_pct,
    total_ordered_qty, total_produced_m, passed_qc_m, dispatched_m
FROM v_order_status
WHERE ($1::text IS NOT NULL AND order_no = $1)
   OR ($2::text IS NOT NULL AND buyer_name ILIKE '%' || $2 || '%')
ORDER BY order_date DESC
LIMIT 20;
```

---

### 3.5 Dispatch Scanning & Invoicing Queries (W5)

#### Query Q-W5.1: Active Dispatch Truck Loading Screen
* **Triggered by:** Dispatch loader scanning rolls onto a truck (FR-5.3, FR-5.4).
```sql
-- Read active dispatch header and progress
SELECT 
    d.dispatch_id, d.dispatch_no, d.status, d.vehicle_no,
    b.name AS buyer_name, co.order_no
FROM dispatch d
JOIN buyer b ON d.buyer_id = b.buyer_id
JOIN customer_order co ON d.order_id = co.order_id
WHERE d.dispatch_id = $1;

-- Read scanned rolls on this dispatch
SELECT 
    di.dispatch_item_id, di.scanned_at, fr.roll_code,
    fr.length_m, fr.weight_kg, fr.shelf_location,
    fp.name AS fabric_product_name, c.name AS colour_name
FROM dispatch_item di
JOIN fabric_roll fr ON di.roll_id = fr.roll_id
JOIN production_job pj ON fr.job_id = pj.job_id
JOIN order_item oi ON pj.order_item_id = oi.order_item_id
JOIN fabric_product fp ON oi.product_id = fp.product_id
JOIN colour c ON oi.colour_id = c.colour_id
WHERE di.dispatch_id = $1 AND di.state = 'active'
ORDER BY di.scanned_at DESC;
```

---

### 3.6 Financial & P&L Reporting Queries (W6)

#### Query Q-W6.1: Executive Monthly P&L and Margin Overview
* **Triggered by:** Mill Owner dashboard (FR-6.6).
```sql
SELECT 
    period_id, period_start, period_end, period_status,
    gross_sales_revenue, material_expense, wage_expense, overhead_expense,
    total_operating_expenses, net_profit_loss, net_profit_margin_pct
FROM v_monthly_pl
ORDER BY period_start DESC
LIMIT 12;
```

#### Query Q-W6.2: System Health & Invariant Reconciliation Check
* **Triggered by:** Automated nightly integrity job and Month-End closing pre-check.
```sql
SELECT 'INV-1 Stock Balance' AS check_name, COUNT(*) AS anomaly_count FROM v_recon_stock_balance_vs_ledger
UNION ALL
SELECT 'INV-9 Reservations', COUNT(*) FROM v_recon_reserved_vs_reservations
UNION ALL
SELECT 'Roll Status Consistency', COUNT(*) FROM v_recon_roll_status_vs_facts
UNION ALL
SELECT 'INV-3 Machine Events', COUNT(*) FROM v_recon_machine_events
UNION ALL
SELECT 'Dispatch vs Invoice Match', COUNT(*) FROM v_recon_dispatch_vs_invoice
UNION ALL
SELECT 'Cost vs Movement Link', COUNT(*) FROM v_recon_cost_vs_issues;
```

---

## 4. Complete Indexing Strategy & Migration 0009 DDL

Doc 04 established primary keys, unique constraints, and partial unique business rules. The following DDL establishes all **foreign-key supporting indexes**, **compound search indexes**, and **performance filtering partial indexes**.

```sql
-- ============================================================================
-- Migration 0009_indexes.sql
-- Everest Textile Mills — Complete Performance Index Catalog
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 Master & Access Foreign Keys
-- ----------------------------------------------------------------------------
CREATE INDEX idx_app_user_employee_id ON app_user (employee_id);
CREATE INDEX idx_user_role_role_id ON user_role (role_id);
CREATE INDEX idx_yarn_item_yarn_type_id ON yarn_item (yarn_type_id);
CREATE INDEX idx_yarn_item_colour_id ON yarn_item (colour_id);
CREATE INDEX idx_yarn_item_unit_id ON yarn_item (unit_id);
CREATE INDEX idx_fabric_product_unit_id ON fabric_product (unit_id);
CREATE INDEX idx_machine_stage_id ON machine (stage_id);

-- ----------------------------------------------------------------------------
-- 4.2 Raw Material & Purchasing Indexes
-- ----------------------------------------------------------------------------
-- purchase_order & items
CREATE INDEX idx_purchase_order_supplier_id ON purchase_order (supplier_id);
CREATE INDEX idx_purchase_order_order_date ON purchase_order (order_date DESC);
CREATE INDEX idx_purchase_order_item_yarn_item_id ON purchase_order_item (yarn_item_id);

-- goods_receipt & items
CREATE INDEX idx_goods_receipt_supplier_id ON goods_receipt (supplier_id);
CREATE INDEX idx_goods_receipt_po_id ON goods_receipt (po_id);
CREATE INDEX idx_goods_receipt_received_at ON goods_receipt (received_at DESC);
CREATE INDEX idx_goods_receipt_item_receipt_id ON goods_receipt_item (receipt_id);
CREATE INDEX idx_goods_receipt_item_yarn_item_id ON goods_receipt_item (yarn_item_id);
CREATE INDEX idx_goods_receipt_item_earmarked_order ON goods_receipt_item (earmarked_order_id) WHERE earmarked_order_id IS NOT NULL;

-- supplier_bill & lines
CREATE INDEX idx_supplier_bill_supplier_id ON supplier_bill (supplier_id);
CREATE INDEX idx_supplier_bill_bill_date ON supplier_bill (bill_date DESC);
CREATE INDEX idx_supplier_bill_line_receipt_item_id ON supplier_bill_line (receipt_item_id);

-- yarn_stock_movement (Ledger search & chronological balance calculations)
CREATE INDEX idx_yarn_stock_movement_yarn_occurred ON yarn_stock_movement (yarn_item_id, occurred_at DESC);
CREATE INDEX idx_yarn_stock_movement_job_id ON yarn_stock_movement (production_job_id) WHERE production_job_id IS NOT NULL;
CREATE INDEX idx_yarn_stock_movement_type ON yarn_stock_movement (movement_type);

-- yarn_reservation & stock_alert
CREATE INDEX idx_yarn_reservation_requirement_id ON yarn_reservation (requirement_id);
CREATE INDEX idx_yarn_reservation_active ON yarn_reservation (requirement_id) WHERE status = 'active';
CREATE INDEX idx_stock_alert_status ON stock_alert (status) WHERE status IN ('open', 'acknowledged');

-- ----------------------------------------------------------------------------
-- 4.3 Customer Order Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX idx_customer_order_buyer_date ON customer_order (buyer_id, order_date DESC);
CREATE INDEX idx_customer_order_status ON customer_order (status);
CREATE INDEX idx_customer_order_promised_date ON customer_order (promised_delivery_date) WHERE status = 'confirmed';
CREATE INDEX idx_order_item_order_id ON order_item (order_id);
CREATE INDEX idx_order_item_product_id ON order_item (product_id);
CREATE INDEX idx_order_item_colour_id ON order_item (colour_id);
CREATE INDEX idx_order_status_history_order_changed ON order_status_history (order_id, changed_at DESC);
CREATE INDEX idx_order_material_requirement_yarn ON order_material_requirement (yarn_item_id);

-- ----------------------------------------------------------------------------
-- 4.4 Production Floor Indexes
-- ----------------------------------------------------------------------------
-- production_job
CREATE INDEX idx_production_job_order_item_id ON production_job (order_item_id);
CREATE INDEX idx_production_job_machine_status ON production_job (machine_id, status);
CREATE INDEX idx_production_job_status ON production_job (status);

-- production_log (Hot append path; chronological lookups by job and shift)
CREATE INDEX idx_production_log_job_logged ON production_log (job_id, logged_at DESC);
CREATE INDEX idx_production_log_shift_logged ON production_log (shift_id, logged_at DESC);
CREATE INDEX idx_production_log_operator_logged ON production_log (operator_id, logged_at DESC) WHERE operator_id IS NOT NULL;
CREATE INDEX idx_production_log_logged_at ON production_log (logged_at DESC);

-- machine_status_event
CREATE INDEX idx_machine_status_event_machine_started ON machine_status_event (machine_id, started_at DESC);
CREATE INDEX idx_machine_status_event_state ON machine_status_event (state);

-- ----------------------------------------------------------------------------
-- 4.5 Fabric Rolls & Quality Control Indexes
-- ----------------------------------------------------------------------------
-- fabric_roll
CREATE INDEX idx_fabric_roll_job_id ON fabric_roll (job_id);
CREATE INDEX idx_fabric_roll_status ON fabric_roll (status);
CREATE INDEX idx_fabric_roll_pending_qc ON fabric_roll (created_at ASC) WHERE status = 'pending_qc';
CREATE INDEX idx_fabric_roll_in_stock ON fabric_roll (shelf_location) WHERE status = 'in_stock';
CREATE INDEX idx_fabric_roll_operator_id ON fabric_roll (operator_id) WHERE operator_id IS NOT NULL;

-- qc_inspection & qc_defect
CREATE INDEX idx_qc_inspection_roll_attempt ON qc_inspection (roll_id, attempt_no DESC);
CREATE INDEX idx_qc_inspection_inspector ON qc_inspection (inspector_id, inspected_at DESC);
CREATE INDEX idx_qc_defect_inspection_id ON qc_defect (inspection_id);
CREATE INDEX idx_qc_defect_type_id ON qc_defect (defect_type_id);

-- ----------------------------------------------------------------------------
-- 4.6 Dispatch & Invoicing Indexes
-- ----------------------------------------------------------------------------
-- dispatch & items
CREATE INDEX idx_dispatch_buyer_id ON dispatch (buyer_id);
CREATE INDEX idx_dispatch_order_id ON dispatch (order_id);
CREATE INDEX idx_dispatch_invoice_id ON dispatch (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_dispatch_status ON dispatch (status);
CREATE INDEX idx_dispatch_dispatched_at ON dispatch (dispatched_at DESC) WHERE dispatched_at IS NOT NULL;
CREATE INDEX idx_dispatch_item_dispatch_id ON dispatch_item (dispatch_id);
CREATE INDEX idx_dispatch_item_roll_id ON dispatch_item (roll_id);

-- invoice & items
CREATE INDEX idx_invoice_buyer_date ON invoice (buyer_id, invoice_date DESC);
CREATE INDEX idx_invoice_status ON invoice (status);
CREATE INDEX idx_invoice_item_invoice_id ON invoice_item (invoice_id);
CREATE INDEX idx_invoice_item_order_item_id ON invoice_item (order_item_id);

-- ----------------------------------------------------------------------------
-- 4.7 Payments, Workforce, Cost & Audit Indexes
-- ----------------------------------------------------------------------------
-- buyer_payment & allocation
CREATE INDEX idx_buyer_payment_buyer_date ON buyer_payment (buyer_id, received_on DESC);
CREATE INDEX idx_buyer_payment_status ON buyer_payment (status);
CREATE INDEX idx_payment_allocation_payment_id ON payment_allocation (payment_id);
CREATE INDEX idx_payment_allocation_invoice_id ON payment_allocation (invoice_id);

-- attendance_record & wage_record
CREATE INDEX idx_attendance_record_employee_date ON attendance_record (employee_id, work_date DESC);
CREATE INDEX idx_attendance_record_date_shift ON attendance_record (work_date, shift_id);
CREATE INDEX idx_wage_record_employee_period ON wage_record (employee_id, period_id);
CREATE INDEX idx_wage_record_period_status ON wage_record (period_id, status);

-- cost_entry (Cost Ledger multi-dimension lookups)
CREATE INDEX idx_cost_entry_period_type ON cost_entry (period_id, cost_type);
CREATE INDEX idx_cost_entry_order_id ON cost_entry (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_cost_entry_machine_id ON cost_entry (machine_id) WHERE machine_id IS NOT NULL;
CREATE INDEX idx_cost_entry_roll_id ON cost_entry (roll_id) WHERE roll_id IS NOT NULL;
CREATE INDEX idx_cost_entry_movement_id ON cost_entry (movement_id) WHERE movement_id IS NOT NULL;
CREATE INDEX idx_cost_entry_wage_id ON cost_entry (wage_id) WHERE wage_id IS NOT NULL;

-- audit_log (High-volume immutable log; keyset access pattern)
CREATE INDEX idx_audit_log_actor_occurred ON audit_log (actor_id, occurred_at DESC);
CREATE INDEX idx_audit_log_entity_id ON audit_log (entity_name, entity_id);
CREATE INDEX idx_audit_log_occurred_at ON audit_log (occurred_at DESC);
```

---

## 5. Index Justification Matrix & Maintenance Overhead

| Index Name | Table | Columns | Query / Rule Supported | Write Overhead Rating | Justification |
|---|---|---|---|---|---|
| `idx_yarn_stock_movement_yarn_occurred` | `yarn_stock_movement` | `(yarn_item_id, occurred_at DESC)` | Q-W1.1, Stock audit ledger | Low | Fast chronological history retrieval per yarn item without table scan. |
| `idx_fabric_roll_pending_qc` | `fabric_roll` | `(created_at ASC) WHERE status = 'pending_qc'` | Q-W3.1, QC Queue | Very Low | Partial index containing only uninspected rolls (~100 rows). Instant queue reads. |
| `idx_fabric_roll_in_stock` | `fabric_roll` | `(shelf_location) WHERE status = 'in_stock'` | Q-W5.1, Warehouse loading | Very Low | Partial index for finished-goods shelf stock. Skips all dispatched rolls. |
| `idx_customer_order_buyer_date` | `customer_order` | `(buyer_id, order_date DESC)` | Q-W4.1, Buyer history | Low | Serves buyer phone lookup and customer order pagination. |
| `idx_production_log_job_logged` | `production_log` | `(job_id, logged_at DESC)` | Q-W2.2, Job progress | Medium | Enables fast aggregation of output per job while supporting keyset pagination. |
| `idx_cost_entry_period_type` | `cost_entry` | `(period_id, cost_type)` | Q-W6.1, `v_monthly_pl` | Low | Accelerates month-end P&L summary aggregations across millions of cost records. |
| `idx_payment_allocation_invoice_id` | `payment_allocation` | `(invoice_id)` | `v_invoice_balance` | Low | FK support index. Prevents full-table scans when calculating invoice balances. |
| `idx_audit_log_entity_id` | `audit_log` | `(entity_name, entity_id)` | Security Audit Screen | Low | Immediate audit trail retrieval for any individual entity row. |

---

## 6. Pagination Strategies

### 6.1 Keyset / Cursor-Based Pagination (Mandatory for High-Volume Ledgers)

For tables with high insert volume (`production_log`, `yarn_stock_movement`, `fabric_roll`, `audit_log`), standard `OFFSET / LIMIT` causes linear performance degradation as the offset increases (PostgreSQL must scan and discard all preceding rows).

**Keyset Pagination Implementation Pattern:**
```sql
-- Initial Page Request (Page 1, 50 rows)
SELECT log_id, logged_at, output_qty, operator_id
FROM production_log
WHERE job_id = $1
ORDER BY logged_at DESC, log_id DESC
LIMIT 50;

-- Subsequent Page Request (using last_seen_logged_at and last_seen_log_id from previous page)
SELECT log_id, logged_at, output_qty, operator_id
FROM production_log
WHERE job_id = $1
  AND (logged_at, log_id) < ($last_seen_logged_at, $last_seen_log_id)
ORDER BY logged_at DESC, log_id DESC
LIMIT 50;
```
*Index Used:* `idx_production_log_job_logged (job_id, logged_at DESC)`. Execution is an instant index range seek ($O(\log N)$) with execution time $< 1 \text{ ms}$.

### 6.2 Offset-Based Pagination (Permitted for Low-Volume Master & Document Lists)

Permitted strictly on filtered lists with $< 10,000$ total records (e.g. `customer_order`, `supplier`, `buyer`, `machine`).

```sql
SELECT order_id, order_no, buyer_name, order_date, operational_stage
FROM v_order_status
WHERE ($1::text IS NULL OR commercial_status = $1)
ORDER BY order_date DESC, order_id DESC
LIMIT $page_size OFFSET ($page_number - 1) * $page_size;
```

---

## 7. Caching and Materialized Views Strategy

### 7.1 Real-Time Standard Views vs In-Memory Caches
* **Decision:** No external caching layer (Redis / Memcached) is deployed.
* **Justification:** As established in `02-database-technology-selection.md`, the entire operational scale (tens of machines, hundreds of daily rolls) is easily handled by PostgreSQL shared buffers (RAM) and properly indexed views. Adding Redis introduces cache invalidation bugs and dirty reads on critical inventory and financial ledgers.

### 7.2 Period-Closed Materialized Snapshots (Future Optimization)
When an `accounting_period` status is changed to `closed`, all underlying financial, wage, and production data for that month is legally and logically frozen (INV-11).

```sql
-- Future optimization trigger when historical data spans 5+ years:
-- Stores pre-aggregated P&L summary upon period close.
CREATE TABLE monthly_pl_snapshot (
    period_id bigint PRIMARY KEY REFERENCES accounting_period (period_id),
    closed_at timestamptz NOT NULL,
    gross_sales_revenue money_t NOT NULL,
    material_expense money_t NOT NULL,
    wage_expense money_t NOT NULL,
    overhead_expense money_t NOT NULL,
    net_profit_loss money_t NOT NULL,
    snapshot_data jsonb NOT NULL
);
```

---

## 8. Scalability & Partitioning Roadmap

### 8.1 Growth Assessment & Thresholds
Based on Assumption A11:
* Annual fabric rolls: ~300,000 – 500,000 rows/year.
* Annual production logs: ~1,000,000 rows/year.
* Annual audit logs: ~1,500,000 rows/year.

A single PostgreSQL 15+ instance comfortably handles tens of millions of rows with standard B-tree indexes.

### 8.2 Partitioning Triggers & Declarative Schema
Declarative range partitioning by date (`occurred_at` / `logged_at`) will be introduced **only when a single table exceeds 10,000,000 rows** or query performance on historical analysis degrades.

```sql
-- Architectural Blueprint for Future Partitioning (Year 4+):
-- Declarative Range Partitioning on production_log by logged_at (Yearly/Quarterly)
/*
CREATE TABLE production_log_partitioned (
    log_id            bigint GENERATED ALWAYS AS IDENTITY,
    job_id            bigint NOT NULL,
    shift_id          bigint NOT NULL,
    operator_id       bigint,
    output_qty        qty_t  NOT NULL,
    logged_at         timestamptz NOT NULL,
    client_request_id uuid   NOT NULL,
    reverses_log_id   bigint,
    reason            text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    created_by        bigint NOT NULL,
    PRIMARY KEY (logged_at, log_id)
) PARTITION BY RANGE (logged_at);

CREATE TABLE production_log_y2026 PARTITION OF production_log_partitioned
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
*/
```

---

## 9. Performance Risk Mitigations & Query Anti-Patterns

| Risk / Anti-Pattern | Manifestation | Architecture Mitigation |
|---|---|---|
| **N+1 Query Problem** | Backend loops over rolls and fires a separate query per roll to fetch defects. | Resolved via `v_roll_trace` which uses a single LATERAL join to aggregate defects into a structured summary in one query. |
| **Cartesian Join Explosion** | Joining `production_log`, `fabric_roll`, and `cost_entry` in a single query multiplying row counts. | CTEs and sub-aggregations are strictly separated (e.g. `order_progress` in `v_order_status` and `period_revenue` in `v_monthly_pl`). |
| **Lock Contention on Sequences** | Blocking transactions waiting for gap-free sequence allocation. | Standard entity codes (`ORD-`, `LOT-`, `JOB-`, `R-`) use non-locking PostgreSQL `SEQUENCE`. Only tax `invoice_no` locks `doc_sequence` row at final issue. |
| **Unbounded Table Scans on Status Filtering** | Scanning the entire `fabric_roll` table to find 20 `pending_qc` rolls among 1,000,000 rolls. | Filtered partial indexes (`idx_fabric_roll_pending_qc`, `idx_fabric_roll_in_stock`) index only active subsets. |
| **Stale Statistics / Poor Query Plans** | PostgreSQL query planner choosing sequential scans due to inaccurate row estimates after batch imports. | Autovacuum settings tuned: `autovacuum_vacuum_scale_factor = 0.05`, `autovacuum_analyze_scale_factor = 0.02`. |
