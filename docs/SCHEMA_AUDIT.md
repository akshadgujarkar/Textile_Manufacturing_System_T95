# SCHEMA AUDIT — Everest Textile Manufacturing System
> Phase 0 Deliverable | Source: `Optimized_Textile_Manufacturing_Database_30_Tables (1).md`

---

## 1. Canonical Table Inventory (30 Tables)

| # | Table | PK | PK Type | Purpose |
|---|-------|----|---------|---------|
| 1 | `employee` | `employee_id` | INT AUTO_INCREMENT | Mill workers, operators, admin |
| 2 | `supplier` | `supplier_id` | INT AUTO_INCREMENT | Yarn vendors / spinning mills |
| 3 | `buyer` | `buyer_id` | INT AUTO_INCREMENT | Apparel manufacturers / export houses |
| 4 | `unit_of_measure` | `unit_id` | INT AUTO_INCREMENT | Standardized measurement units |
| 5 | `yarn_type` | `yarn_type_id` | INT AUTO_INCREMENT | Fiber construction specs |
| 6 | `yarn_item` | `yarn_item_id` | INT AUTO_INCREMENT | Stockable yarn SKU (type x colour) |
| 7 | `fabric_product` | `product_id` | INT AUTO_INCREMENT | Finished fabric catalogue |
| 8 | `process_stage` | `stage_id` | INT AUTO_INCREMENT | Manufacturing pipeline stages |
| 9 | `machine` | `machine_id` | INT AUTO_INCREMENT | Physical shop-floor machines |
| 10 | `purchase_order` | `po_id` | INT AUTO_INCREMENT | POs issued to yarn suppliers |
| 11 | `purchase_order_item` | `po_item_id` | INT AUTO_INCREMENT | PO line items |
| 12 | `goods_receipt` | `receipt_id` | INT AUTO_INCREMENT | Gate inward receipt header |
| 13 | `goods_receipt_item` | `receipt_item_id` | INT AUTO_INCREMENT | Received yarn lot lines |
| 14 | `yarn_stock_movement` | `movement_id` | INT AUTO_INCREMENT | Append-only inventory ledger |
| 15 | `customer_order` | `order_id` | INT AUTO_INCREMENT | Sales order headers |
| 16 | `order_item` | `order_item_id` | INT AUTO_INCREMENT | Sales order line items |
| 17 | `order_material_requirement` | `requirement_id` | INT AUTO_INCREMENT | BOM explosion per order line |
| 18 | `production_job` | `job_id` | INT AUTO_INCREMENT | Floor work order ticket |
| 19 | `production_log` | `log_id` | INT AUTO_INCREMENT | Shift output records (append-only) |
| 20 | `fabric_roll` | `roll_id` | INT AUTO_INCREMENT | Individual roll traceability hub |
| 21 | `qc_inspection` | `inspection_id` | INT AUTO_INCREMENT | Formal QC audit event |
| 22 | `qc_defect` | `defect_id` | INT AUTO_INCREMENT | Defect itemization per inspection |
| 23 | `dispatch` | `dispatch_id` | INT AUTO_INCREMENT | Transport manifest header |
| 24 | `dispatch_item` | `dispatch_item_id` | INT AUTO_INCREMENT | Scanned roll manifest lines |
| 25 | `invoice` | `invoice_id` | INT AUTO_INCREMENT | GST tax invoice header |
| 26 | `invoice_item` | `invoice_item_id` | INT AUTO_INCREMENT | Invoice line items |
| 27 | `buyer_payment` | `payment_id` | INT AUTO_INCREMENT | Accounts receivable receipts |
| 28 | `attendance_record` | `attendance_id` | INT AUTO_INCREMENT | Daily workforce muster |
| 29 | `wage_record` | `wage_id` | INT AUTO_INCREMENT | Monthly payroll calculation |
| 30 | `cost_entry` | `cost_id` | INT AUTO_INCREMENT | Manufacturing cost ledger |

---

## 2. Unique Keys and Constraints Summary

| Table | Single Unique Keys | Composite Unique Keys |
|-------|-------------------|-----------------------|
| `employee` | `employee_code` | — |
| `supplier` | `supplier_code` | — |
| `buyer` | `buyer_code` | — |
| `unit_of_measure` | `unit_code` | — |
| `yarn_type` | `name` | — |
| `yarn_item` | — | `(yarn_type_id, colour_code)` |
| `fabric_product` | `product_code` | — |
| `process_stage` | `name`, `sequence_hint` | — |
| `machine` | `machine_code` | — |
| `purchase_order` | `po_no` | — |
| `goods_receipt` | `receipt_no`, `client_request_id` | — |
| `goods_receipt_item` | `lot_code` | — |
| `customer_order` | `order_no` | — |
| `production_job` | `job_no` | — |
| `production_log` | `client_request_id` | — |
| `fabric_roll` | `roll_code` | — |
| `dispatch` | `dispatch_no` | — |
| `dispatch_item` | Partial: `roll_id` WHERE `state='active'` (via generated column in MySQL) | — |
| `invoice` | `invoice_no` | — |
| `buyer_payment` | `payment_ref`, `client_request_id` | — |
| `attendance_record` | — | `(employee_id, work_date, shift_code)` |
| `wage_record` | — | `(employee_id, payroll_month)` |

---

## 3. Foreign Key Inventory (55 FKs)

| # | Child Table | FK Column | Parent Table | Nullable |
|---|-------------|-----------|-------------|----------|
| 1 | `yarn_item` | `yarn_type_id` | `yarn_type` | NO |
| 2 | `yarn_item` | `unit_id` | `unit_of_measure` | NO |
| 3 | `fabric_product` | `unit_id` | `unit_of_measure` | NO |
| 4 | `machine` | `stage_id` | `process_stage` | NO |
| 5 | `purchase_order` | `supplier_id` | `supplier` | NO |
| 6 | `purchase_order` | `created_by` | `employee` | NO |
| 7 | `purchase_order_item` | `po_id` | `purchase_order` | NO |
| 8 | `purchase_order_item` | `yarn_item_id` | `yarn_item` | NO |
| 9 | `goods_receipt` | `supplier_id` | `supplier` | NO |
| 10 | `goods_receipt` | `po_id` | `purchase_order` | YES |
| 11 | `goods_receipt` | `received_by_employee_id` | `employee` | NO |
| 12 | `goods_receipt_item` | `receipt_id` | `goods_receipt` | NO |
| 13 | `goods_receipt_item` | `yarn_item_id` | `yarn_item` | NO |
| 14 | `goods_receipt_item` | `earmarked_order_id` | `customer_order` | YES |
| 15 | `yarn_stock_movement` | `yarn_item_id` | `yarn_item` | NO |
| 16 | `yarn_stock_movement` | `receipt_item_id` | `goods_receipt_item` | YES |
| 17 | `yarn_stock_movement` | `production_job_id` | `production_job` | YES |
| 18 | `yarn_stock_movement` | `reverses_movement_id` | `yarn_stock_movement` | YES |
| 19 | `yarn_stock_movement` | `created_by_employee_id` | `employee` | NO |
| 20 | `customer_order` | `buyer_id` | `buyer` | NO |
| 21 | `customer_order` | `created_by_employee_id` | `employee` | NO |
| 22 | `order_item` | `order_id` | `customer_order` | NO |
| 23 | `order_item` | `product_id` | `fabric_product` | NO |
| 24 | `order_item` | `unit_id` | `unit_of_measure` | NO |
| 25 | `order_material_requirement` | `order_item_id` | `order_item` | NO |
| 26 | `order_material_requirement` | `yarn_item_id` | `yarn_item` | NO |
| 27 | `production_job` | `order_item_id` | `order_item` | NO |
| 28 | `production_job` | `stage_id` | `process_stage` | NO |
| 29 | `production_job` | `machine_id` | `machine` | NO |
| 30 | `production_log` | `job_id` | `production_job` | NO |
| 31 | `production_log` | `operator_id` | `employee` | NO |
| 32 | `fabric_roll` | `job_id` | `production_job` | NO |
| 33 | `fabric_roll` | `operator_id` | `employee` | NO |
| 34 | `qc_inspection` | `roll_id` | `fabric_roll` | NO |
| 35 | `qc_inspection` | `inspector_id` | `employee` | NO |
| 36 | `qc_defect` | `inspection_id` | `qc_inspection` | NO |
| 37 | `dispatch` | `buyer_id` | `buyer` | NO |
| 38 | `dispatch` | `order_id` | `customer_order` | NO |
| 39 | `dispatch` | `invoice_id` | `invoice` | YES |
| 40 | `dispatch_item` | `dispatch_id` | `dispatch` | NO |
| 41 | `dispatch_item` | `roll_id` | `fabric_roll` | NO |
| 42 | `dispatch_item` | `scanned_by_employee_id` | `employee` | NO |
| 43 | `invoice` | `buyer_id` | `buyer` | NO |
| 44 | `invoice_item` | `invoice_id` | `invoice` | NO |
| 45 | `invoice_item` | `order_item_id` | `order_item` | NO |
| 46 | `buyer_payment` | `buyer_id` | `buyer` | NO |
| 47 | `buyer_payment` | `invoice_id` | `invoice` | NO |
| 48 | `buyer_payment` | `created_by_employee_id` | `employee` | NO |
| 49 | `attendance_record` | `employee_id` | `employee` | NO |
| 50 | `wage_record` | `employee_id` | `employee` | NO |
| 51 | `cost_entry` | `order_id` | `customer_order` | YES |
| 52 | `cost_entry` | `machine_id` | `machine` | YES |
| 53 | `cost_entry` | `roll_id` | `fabric_roll` | YES |
| 54 | `cost_entry` | `movement_id` | `yarn_stock_movement` | YES |
| 55 | `cost_entry` | `wage_id` | `wage_record` | YES |

All FK constraints use RESTRICT (no CASCADE DELETE) to preserve business history.

---

## 4. Discrepancies and Implementation Decisions

### D1 - fabric_roll references production_job, NOT production_log
- Diagram shows: production_log -> fabric_roll
- Table definition: fabric_roll.job_id -> production_job(job_id)
- DECISION: Implement job_id FK only. No log_id FK on fabric_roll.

### D2 - production_log does NOT have machine_id or yarn_item_id columns
- Diagram shows: machine -> production_log, yarn_item -> production_log
- Table definition: only job_id and operator_id FKs
- DECISION: Machine and yarn item reachable via production_job join. No extra FKs added.

### D3 - dispatch_item does NOT reference qc_inspection
- Diagram shows: qc_inspection -> dispatch_item
- Table definition: dispatch_item has dispatch_id, roll_id, scanned_by_employee_id only
- DECISION: QC eligibility checked via fabric_roll.status at scan time.

### D4 - production_job references order_item, not customer_order directly
- Diagram shows: customer_order -> production_job
- Table definition: production_job.order_item_id -> order_item
- DECISION: Implement order_item_id FK only. Customer order reachable via join.

### D5 - cost_entry does NOT reference production_log or purchase_order_item
- Diagram shows: production_log -> cost_entry, purchase_order_item -> cost_entry
- Table definition: cost_entry FKs are order_id, machine_id, roll_id, movement_id, wage_id
- DECISION: Implement exactly the 5 declared optional FKs. No phantom FKs added.

### D6 - purchase_order.created_by is employee FK (not shown in ERD)
- Table definition explicitly lists it; ERD omits it
- DECISION: Implement as NOT NULL FK to employee.

### D7 - dispatch.invoice_id is NULLABLE (circular dependency handled)
- dispatch -> invoice (optional FK, nullable)
- DECISION: Dispatch created without invoice; invoice_id updated when invoice is issued.

### D8 - dispatch_item partial unique index (MySQL incompatibility)
- Source specifies: UNIQUE (roll_id) WHERE state = 'active'
- MySQL does not support partial/filtered unique indexes
- DECISION: Add generated column active_roll_id = IF(state='active', roll_id, NULL)
  with UNIQUE constraint. Achieves equivalent guarantee.

### D9 - buyer_payment.invoice_id is NOT NULL
- Source states: "one receipt is linked to one invoice in this reduced design"
- DECISION: Implement as NOT NULL FK. Multiple payments may reference same invoice.

---

## 5. Type Conversion: Markdown to MySQL

| Markdown | MySQL | Notes |
|----------|-------|-------|
| INT | INT | PKs use AUTO_INCREMENT |
| VARCHAR(n) | VARCHAR(n) | unchanged |
| NUMERIC(p,s) | DECIMAL(p,s) | exact arithmetic |
| BOOLEAN | TINYINT(1) | 0/1 |
| TIMESTAMPTZ | DATETIME(3) | UTC convention |
| DATE | DATE | unchanged |
| UUID | CHAR(36) | idempotency tokens |
| TEXT | TEXT | long-form fields |

---

## 6. Migration Order (dependency-safe)

001_unit_of_measure, 002_employee, 003_supplier, 004_buyer, 005_yarn_type,
006_yarn_item, 007_fabric_product, 008_process_stage, 009_machine,
010_purchase_order, 011_purchase_order_item, 012_customer_order,
013_goods_receipt, 014_order_item, 015_goods_receipt_item,
016_production_job, 017_order_material_requirement, 018_yarn_stock_movement,
019_production_log, 020_fabric_roll, 021_qc_inspection, 022_qc_defect,
023_invoice, 024_dispatch, 025_dispatch_item, 026_invoice_item,
027_buyer_payment, 028_attendance_record, 029_wage_record, 030_cost_entry

