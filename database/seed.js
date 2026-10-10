'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function runSeed() {
  console.log('🌱 Seeding comprehensive demo data across all 30 canonical tables...');
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Units of Measure
    console.log('  -> Seeding unit_of_measure...');
    const units = [
      ['kg', 'Kilogram'],
      ['m', 'Metre'],
      ['pcs', 'Pieces'],
      ['lbs', 'Pounds'],
      ['cone', 'Yarn Cone'],
    ];
    for (const [code, desc] of units) {
      await conn.query(
        `INSERT IGNORE INTO unit_of_measure (unit_code, description) VALUES (?, ?)`,
        [code, desc]
      );
    }

    // 2. Process Stages
    console.log('  -> Seeding process_stage...');
    const stages = [
      ['Spinning', 1],
      ['Winding', 2],
      ['Warping', 3],
      ['Sizing', 4],
      ['Weaving', 5],
      ['Dyeing', 6],
      ['Finishing', 7],
      ['Inspection', 8],
    ];
    for (const [name, seq] of stages) {
      await conn.query(
        `INSERT IGNORE INTO process_stage (name, sequence_hint) VALUES (?, ?)`,
        [name, seq]
      );
    }

    // 3. Employees
    console.log('  -> Seeding employee...');
    const employees = [
      ['EMP001', 'Rajesh Sharma', 'Plant Head', 'monthly', 75000.00, '+91-9811122233'],
      ['EMP002', 'Suresh Patel', 'Loom Master', 'monthly', 35000.00, '+91-9822233344'],
      ['EMP003', 'Anita Desai', 'Senior QC Inspector', 'monthly', 30000.00, '+91-9833344455'],
      ['EMP004', 'Vikas Kumar', 'Warping Operator', 'daily', 800.00, '+91-9844455566'],
      ['EMP005', 'Manoj Singh', 'Dispatch Supervisor', 'monthly', 28000.00, '+91-9855566677'],
    ];
    for (const [code, name, desig, basis, rate, phone] of employees) {
      await conn.query(
        `INSERT IGNORE INTO employee (employee_code, full_name, designation, pay_basis, pay_rate, phone) VALUES (?, ?, ?, ?, ?, ?)`,
        [code, name, desig, basis, rate, phone]
      );
    }

    // 4. Suppliers
    console.log('  -> Seeding supplier...');
    const suppliers = [
      ['SUP001', 'Vardhman Yarns Ltd', '27AABCV1234F1Z5', 'R. K. Mittal', '+91-161-2228800', 'Ludhiana, Punjab'],
      ['SUP002', 'Trident Textiles', '03AABCT9988G1Z1', 'Amitabh Jain', '+91-161-5039999', 'Barnala, Punjab'],
      ['SUP003', 'Naharmills Corp', '03AABCN5566K1Z9', 'S. K. Gupta', '+91-161-2600701', 'Ludhiana, Punjab'],
    ];
    for (const [code, name, gstin, person, phone, addr] of suppliers) {
      await conn.query(
        `INSERT IGNORE INTO supplier (supplier_code, name, gstin, contact_person, phone, address) VALUES (?, ?, ?, ?, ?, ?)`,
        [code, name, gstin, person, phone, addr]
      );
    }

    // 5. Buyers
    console.log('  -> Seeding buyer...');
    const buyers = [
      ['BYR001', 'Zara Global Sourcing', '27AAACZ1122M1Z0', 'Carlos Gomez', '+34-981-185400', 5000000.00, 30],
      ['BYR002', 'H&M Production Hub', '27AAACH3344N1Z2', 'Elin Lindqvist', '+46-8-7965500', 3000000.00, 45],
      ['BYR003', 'Raymond Apparel Ltd', '27AAACR5566P1Z4', 'Devendra Joshi', '+91-22-61527000', 10000000.00, 60],
    ];
    for (const [code, name, gstin, person, phone, credit, terms] of buyers) {
      await conn.query(
        `INSERT IGNORE INTO buyer (buyer_code, name, gstin, contact_person, phone, credit_limit, payment_terms_days) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [code, name, gstin, person, phone, credit, terms]
      );
    }

    // 6. Yarn Types
    console.log('  -> Seeding yarn_type...');
    const yarnTypes = [
      ['100% Combed Cotton', '100% Cotton', '30s Ne', 'Natural single combed cotton ring spun yarn'],
      ['Poly-Cotton 65/35', '65% Poly / 35% Cotton', '40s Ne', 'Blended polyester combed cotton ring spun'],
      ['100% Viscose Rayon', '100% Rayon', '30s Ne', 'Regenerated cellulose fiber yarn'],
    ];
    for (const [name, fiber, count, desc] of yarnTypes) {
      await conn.query(
        `INSERT IGNORE INTO yarn_type (name, fiber_content, nominal_count, description) VALUES (?, ?, ?, ?)`,
        [name, fiber, count, desc]
      );
    }

    // 7. Yarn Items
    console.log('  -> Seeding yarn_item...');
    const yarnItems = [
      [1, 'RAW-WHT', 'Raw White Cotton 30s', 1, 500.00],
      [1, 'OPT-WHT', 'Optical White Cotton 40s', 1, 300.00],
      [2, 'BLU-NVY', 'Navy Blue Poly-Cotton 30s', 1, 400.00],
    ];
    for (const [typeId, cCode, cName, uId, reorder] of yarnItems) {
      await conn.query(
        `INSERT IGNORE INTO yarn_item (yarn_type_id, colour_code, colour_name, unit_id, reorder_level) VALUES (?, ?, ?, ?, ?)`,
        [typeId, cCode, cName, uId, reorder]
      );
    }

    // 8. Fabric Products
    console.log('  -> Seeding fabric_product...');
    const fabricProducts = [
      ['FAB-TWILL-180', '100% Cotton 2/1 Twill', 'twill', 180.00, 58.00, 2],
      ['FAB-POPLIN-120', 'Cotton Poplin Plain Weave', 'plain', 120.00, 56.00, 2],
      ['FAB-SATIN-220', 'Cotton Heavy Satin Weave', 'satin', 220.00, 60.00, 2],
    ];
    for (const [code, name, weave, gsm, width, uId] of fabricProducts) {
      await conn.query(
        `INSERT IGNORE INTO fabric_product (product_code, name, weave_type, nominal_gsm, nominal_width_inches, unit_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [code, name, weave, gsm, width, uId]
      );
    }

    // 9. Machines
    console.log('  -> Seeding machine...');
    const machines = [
      ['LOOM-01', 5, 'Tsudakoma ZAX9100 Air-Jet Loom #1', 850, 'running'],
      ['LOOM-02', 5, 'Picanol OmniPlus Summum Air-Jet #2', 900, 'idle'],
      ['WARP-01', 3, 'Karl Mayer High-Speed Warper', 1200, 'running'],
      ['WIND-01', 2, 'Murata Automatic Cone Winder', 1500, 'running'],
    ];
    for (const [code, sId, model, rpm, status] of machines) {
      await conn.query(
        `INSERT IGNORE INTO machine (machine_code, stage_id, make_model, rated_rpm, is_active, current_status) VALUES (?, ?, ?, ?, 1, ?)`,
        [code, sId, model, rpm, status]
      );
    }

    // 10. Purchase Orders & Items
    console.log('  -> Seeding purchase_order & items...');
    await conn.query(`
      INSERT IGNORE INTO purchase_order (po_id, po_no, supplier_id, order_date, expected_delivery_date, status, total_amount, created_by)
      VALUES (1, 'PO-2026-001', 1, '2026-09-01', '2026-09-10', 'sent', 450000.00, 1)
    `);
    await conn.query(`
      INSERT IGNORE INTO purchase_order_item (po_item_id, po_id, yarn_item_id, quantity, agreed_rate, line_total)
      VALUES 
        (1, 1, 1, 1000.00, 250.00, 250000.00),
        (2, 1, 2, 500.00, 400.00, 200000.00)
    `);

    // 11. Goods Receipts & Items
    console.log('  -> Seeding goods_receipt & items...');
    await conn.query(`
      INSERT IGNORE INTO goods_receipt (receipt_id, receipt_no, supplier_id, po_id, supplier_challan_no, vehicle_number, received_at, received_by_employee_id, client_request_id, status)
      VALUES (1, 'GRN-2026-001', 1, 1, 'DC-9921', 'MH-12-TX-1122', '2026-09-08 10:00:00', 5, 'c0000000-0000-0000-0000-000000000001', 'received')
    `);
    await conn.query(`
      INSERT IGNORE INTO goods_receipt_item (receipt_item_id, receipt_id, yarn_item_id, lot_code, quantity_received, storage_location)
      VALUES 
        (1, 1, 1, 'LOT-COT-30S-001', 1000.00, 'Warehouse Bay A-01'),
        (2, 1, 2, 'LOT-COT-40S-001', 500.00, 'Warehouse Bay A-02')
    `);

    // 12. Yarn Stock Movements (Append-only Ledger)
    console.log('  -> Seeding yarn_stock_movement...');
    await conn.query(`
      INSERT IGNORE INTO yarn_stock_movement (movement_id, yarn_item_id, movement_type, quantity, unit_cost, receipt_item_id, occurred_at, created_by_employee_id, reason)
      VALUES 
        (1, 1, 'receipt', 1000.00, 250.00, 1, '2026-09-08 10:15:00', 5, 'GRN-2026-001 receipt'),
        (2, 2, 'receipt', 500.00, 400.00, 2, '2026-09-08 10:15:00', 5, 'GRN-2026-001 receipt')
    `);

    // 13. Customer Orders & Items
    console.log('  -> Seeding customer_order & items...');
    await conn.query(`
      INSERT IGNORE INTO customer_order (order_id, order_no, buyer_id, order_date, promised_delivery_date, status, created_by_employee_id)
      VALUES (1, 'SO-2026-101', 1, '2026-09-12', '2026-10-20', 'in_production', 1)
    `);
    await conn.query(`
      INSERT IGNORE INTO order_item (order_item_id, order_id, line_no, product_id, colour_code, ordered_qty, unit_id, agreed_rate, line_total)
      VALUES (1, 1, 1, 1, 'RAW-WHT', 2000.00, 2, 325.00, 650000.00)
    `);

    // 14. Order Material Requirements (BOM) & Stock Issue
    console.log('  -> Seeding order_material_requirement...');
    await conn.query(`
      INSERT IGNORE INTO order_material_requirement (requirement_id, order_item_id, yarn_item_id, required_qty, waste_factor_pct, reserved_qty, allocation_status)
      VALUES (1, 1, 1, 400.00, 2.50, 400.00, 'reserved')
    `);

    // 15. Production Jobs & Logs
    console.log('  -> Seeding production_job & logs...');
    await conn.query(`
      INSERT IGNORE INTO production_job (job_id, job_no, order_item_id, stage_id, machine_id, planned_qty, status, priority, started_at)
      VALUES (1, 'JOB-2026-001', 1, 5, 1, 2000.00, 'running', 'high', '2026-09-15 09:00:00')
    `);

    await conn.query(`
      INSERT IGNORE INTO yarn_stock_movement (movement_id, yarn_item_id, movement_type, quantity, unit_cost, production_job_id, occurred_at, created_by_employee_id, reason)
      VALUES (3, 1, 'issue', 400.00, 250.00, 1, '2026-09-15 08:30:00', 2, 'Yarn issued to job JOB-2026-001')
    `);

    await conn.query(`
      INSERT IGNORE INTO production_log (log_id, job_id, shift_code, operator_id, output_qty, scrap_qty, power_kwh, logged_at, client_request_id)
      VALUES 
        (1, 1, 'shift_1', 2, 600.00, 5.00, 45.50, '2026-09-15 14:00:00', 'a0000000-0000-0000-0000-000000000001'),
        (2, 1, 'shift_2', 2, 600.00, 5.00, 48.00, '2026-09-15 22:00:00', 'a0000000-0000-0000-0000-000000000002')
    `);

    // 16. Fabric Rolls
    console.log('  -> Seeding fabric_roll...');
    await conn.query(`
      INSERT IGNORE INTO fabric_roll (roll_id, roll_code, job_id, operator_id, length_m, weight_kg, gsm, width_inches, status, shelf_location)
      VALUES 
        (1, 'ROL-2026-0001', 1, 2, 200.00, 41.30, 180.00, 58.00, 'in_stock', 'Rack-F01'),
        (2, 'ROL-2026-0002', 1, 2, 202.00, 41.90, 181.00, 58.00, 'in_stock', 'Rack-F02'),
        (3, 'ROL-2026-0003', 1, 2, 198.00, 40.60, 179.00, 58.00, 'pending_qc', 'Rack-Q01')
    `);

    // 17. QC Inspections & Defects
    console.log('  -> Seeding qc_inspection & defects...');
    await conn.query(`
      INSERT IGNORE INTO qc_inspection (inspection_id, roll_id, inspector_id, attempt_no, result, assigned_grade, total_penalty_points, points_per_100_sq_yd, inspected_at, remarks)
      VALUES 
        (1, 1, 3, 1, 'passed', 'A', 6, 14.50, '2026-09-16 10:00:00', 'ASTM 4-Point Grade A compliant'),
        (2, 2, 3, 1, 'passed', 'B', 10, 24.00, '2026-09-16 11:30:00', 'Commercial grade acceptable')
    `);
    await conn.query(`
      INSERT IGNORE INTO qc_defect (defect_id, inspection_id, defect_code, defect_name, penalty_points, position_meters, severity)
      VALUES 
        (1, 1, 'DEF-SLUB', 'Slub Yarn', 2, 45.20, 'minor'),
        (2, 2, 'DEF-FLY', 'Fly Defect', 4, 110.50, 'major')
    `);

    // 18. Invoices & Invoice Items
    console.log('  -> Seeding invoice & invoice_item...');
    await conn.query(`
      INSERT IGNORE INTO invoice (invoice_id, invoice_no, buyer_id, invoice_date, due_date, subtotal, tax_rate, tax_amount, total_amount, status)
      VALUES (1, 'INV-2026-001', 1, '2026-09-22', '2026-10-22', 130650.00, 5.00, 6532.50, 137182.50, 'issued')
    `);
    await conn.query(`
      INSERT IGNORE INTO invoice_item (invoice_item_id, invoice_id, order_item_id, hsn_code, quantity, rate, amount)
      VALUES 
        (1, 1, 1, '5208', 200.00, 325.00, 65000.00),
        (2, 1, 1, '5208', 202.00, 325.00, 65650.00)
    `);

    // 19. Dispatches & Items
    console.log('  -> Seeding dispatch & dispatch_item...');
    await conn.query(`
      INSERT IGNORE INTO dispatch (dispatch_id, dispatch_no, buyer_id, order_id, invoice_id, vehicle_no, driver_name, driver_phone, destination, status, dispatched_at)
      VALUES (1, 'DSP-2026-001', 1, 1, 1, 'MH-12-TX-9988', 'Ramesh Yadav', '+91-9822011223', 'Nhava Sheva CFS Port', 'dispatched', '2026-09-24 16:00:00')
    `);
    await conn.query(`
      INSERT IGNORE INTO dispatch_item (dispatch_item_id, dispatch_id, roll_id, scanned_at, scanned_by_employee_id, state)
      VALUES 
        (1, 1, 1, '2026-09-24 15:30:00', 5, 'active'),
        (2, 1, 2, '2026-09-24 15:35:00', 5, 'active')
    `);
    await conn.query(`UPDATE fabric_roll SET status = 'dispatched' WHERE roll_id IN (1, 2)`);

    // 20. Buyer Payments
    console.log('  -> Seeding buyer_payment...');
    await conn.query(`
      INSERT IGNORE INTO buyer_payment (payment_id, payment_ref, buyer_id, invoice_id, received_on, amount, mode, status, client_request_id, created_by_employee_id)
      VALUES (1, 'PAY-2026-001', 1, 1, '2026-09-28', 100000.00, 'NEFT/RTGS', 'recorded', 'b0000000-0000-0000-0000-000000000001', 1)
    `);

    // 21. Attendance Records
    console.log('  -> Seeding attendance_record...');
    await conn.query(`
      INSERT IGNORE INTO attendance_record (attendance_id, employee_id, work_date, shift_code, status, hours_worked)
      VALUES 
        (1, 2, '2026-09-15', 'shift_1', 'present', 8.50),
        (2, 3, '2026-09-15', 'shift_1', 'present', 8.00),
        (3, 4, '2026-09-15', 'shift_2', 'present', 8.00),
        (4, 5, '2026-09-15', 'shift_1', 'present', 9.00)
    `);

    // 22. Wage Records
    console.log('  -> Seeding wage_record...');
    await conn.query(`
      INSERT IGNORE INTO wage_record (wage_id, employee_id, payroll_month, base_amount, piece_rate_amount, bonus_overtime, gross_amount, status)
      VALUES 
        (1, 2, '2026-09-01', 35000.00, 5000.00, 3500.00, 43500.00, 'approved'),
        (2, 3, '2026-09-01', 30000.00, 0.00, 1500.00, 31500.00, 'approved')
    `);

    // 23. Cost Entries
    console.log('  -> Seeding cost_entry...');
    await conn.query(`
      INSERT IGNORE INTO cost_entry (cost_id, cost_type, amount, cost_date, order_id, machine_id, roll_id)
      VALUES 
        (1, 'wage', 4500.00, '2026-09-15', 1, 1, 1),
        (2, 'power', 2200.00, '2026-09-15', 1, 1, 1),
        (3, 'overhead', 10000.00, '2026-09-15', 1, 1, 1)
    `);

    await conn.commit();
    console.log('\n🎉 Comprehensive database seeding completed successfully across all 30 tables!');
  } catch (err) {
    await conn.rollback();
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };
