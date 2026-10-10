# RELATIONSHIP MATRIX — Everest Textile Manufacturing System

| # | Parent Table | Child Table | FK Column | Referenced | Cardinality | On Delete | On Update | Operational Reason |
|---|-------------|-------------|-----------|-----------|-------------|-----------|-----------|-------------------|
| 1 | `yarn_type` | `yarn_item` | `yarn_type_id` | `yarn_type_id` | 1:N | RESTRICT | RESTRICT | Each SKU has one fiber spec |
| 2 | `unit_of_measure` | `yarn_item` | `unit_id` | `unit_id` | 1:N | RESTRICT | RESTRICT | Inventory unit for yarn kg |
| 3 | `unit_of_measure` | `fabric_product` | `unit_id` | `unit_id` | 1:N | RESTRICT | RESTRICT | Trading unit for fabric m |
| 4 | `unit_of_measure` | `order_item` | `unit_id` | `unit_id` | 1:N | RESTRICT | RESTRICT | Order line unit reference |
| 5 | `process_stage` | `machine` | `stage_id` | `stage_id` | 1:N | RESTRICT | RESTRICT | Machine belongs to a stage |
| 6 | `supplier` | `purchase_order` | `supplier_id` | `supplier_id` | 1:N | RESTRICT | RESTRICT | PO issued to a supplier |
| 7 | `employee` | `purchase_order` | `created_by` | `employee_id` | 1:N | RESTRICT | RESTRICT | Employee authorizes PO |
| 8 | `purchase_order` | `purchase_order_item` | `po_id` | `po_id` | 1:N | RESTRICT | RESTRICT | Lines belong to one PO |
| 9 | `yarn_item` | `purchase_order_item` | `yarn_item_id` | `yarn_item_id` | 1:N | RESTRICT | RESTRICT | Which yarn SKU is ordered |
| 10 | `supplier` | `goods_receipt` | `supplier_id` | `supplier_id` | 1:N | RESTRICT | RESTRICT | Which supplier delivered |
| 11 | `purchase_order` | `goods_receipt` | `po_id` | `po_id` | 1:N (optional) | RESTRICT | RESTRICT | Receipt may reference a PO |
| 12 | `employee` | `goods_receipt` | `received_by_employee_id` | `employee_id` | 1:N | RESTRICT | RESTRICT | Gate storekeeper who received |
| 13 | `goods_receipt` | `goods_receipt_item` | `receipt_id` | `receipt_id` | 1:N | RESTRICT | RESTRICT | Lot lines belong to one GRN |
| 14 | `yarn_item` | `goods_receipt_item` | `yarn_item_id` | `yarn_item_id` | 1:N | RESTRICT | RESTRICT | Which SKU was received |
| 15 | `customer_order` | `goods_receipt_item` | `earmarked_order_id` | `order_id` | 1:N (optional) | RESTRICT | RESTRICT | Pre-assigned lot to an order |
| 16 | `yarn_item` | `yarn_stock_movement` | `yarn_item_id` | `yarn_item_id` | 1:N | RESTRICT | RESTRICT | Movement against a SKU |
| 17 | `goods_receipt_item` | `yarn_stock_movement` | `receipt_item_id` | `receipt_item_id` | 1:1 (optional) | RESTRICT | RESTRICT | Lot that caused receipt posting |
| 18 | `production_job` | `yarn_stock_movement` | `production_job_id` | `job_id` | 1:N (optional) | RESTRICT | RESTRICT | Job that consumed yarn |
| 19 | `yarn_stock_movement` | `yarn_stock_movement` | `reverses_movement_id` | `movement_id` | 1:1 (optional) | RESTRICT | RESTRICT | Self-referential reversal entry |
| 20 | `employee` | `yarn_stock_movement` | `created_by_employee_id` | `employee_id` | 1:N | RESTRICT | RESTRICT | Who entered the movement |
| 21 | `buyer` | `customer_order` | `buyer_id` | `buyer_id` | 1:N | RESTRICT | RESTRICT | Order placed by buyer |
| 22 | `employee` | `customer_order` | `created_by_employee_id` | `employee_id` | 1:N | RESTRICT | RESTRICT | Sales rep who booked order |
| 23 | `customer_order` | `order_item` | `order_id` | `order_id` | 1:N | RESTRICT | RESTRICT | Lines belong to one order |
| 24 | `fabric_product` | `order_item` | `product_id` | `product_id` | 1:N | RESTRICT | RESTRICT | Fabric spec ordered |
| 25 | `order_item` | `order_material_requirement` | `order_item_id` | `order_item_id` | 1:N | RESTRICT | RESTRICT | BOM for an order line |
| 26 | `yarn_item` | `order_material_requirement` | `yarn_item_id` | `yarn_item_id` | 1:N | RESTRICT | RESTRICT | Yarn needed for BOM |
| 27 | `order_item` | `production_job` | `order_item_id` | `order_item_id` | 1:N | RESTRICT | RESTRICT | Job manufactures an order line |
| 28 | `process_stage` | `production_job` | `stage_id` | `stage_id` | 1:N | RESTRICT | RESTRICT | Which stage the job runs at |
| 29 | `machine` | `production_job` | `machine_id` | `machine_id` | 1:N | RESTRICT | RESTRICT | Machine assigned to job |
| 30 | `production_job` | `production_log` | `job_id` | `job_id` | 1:N | RESTRICT | RESTRICT | Shift logs for a job |
| 31 | `employee` | `production_log` | `operator_id` | `employee_id` | 1:N | RESTRICT | RESTRICT | Operator who logged shift |
| 32 | `production_job` | `fabric_roll` | `job_id` | `job_id` | 1:N | RESTRICT | RESTRICT | Job that produced the roll |
| 33 | `employee` | `fabric_roll` | `operator_id` | `employee_id` | 1:N | RESTRICT | RESTRICT | Weaving master who doffed roll |
| 34 | `fabric_roll` | `qc_inspection` | `roll_id` | `roll_id` | 1:N | RESTRICT | RESTRICT | Inspections on one roll |
| 35 | `employee` | `qc_inspection` | `inspector_id` | `employee_id` | 1:N | RESTRICT | RESTRICT | QA auditor who inspected |
| 36 | `qc_inspection` | `qc_defect` | `inspection_id` | `inspection_id` | 1:N | RESTRICT | RESTRICT | Defects found in one inspection |
| 37 | `buyer` | `dispatch` | `buyer_id` | `buyer_id` | 1:N | RESTRICT | RESTRICT | Dispatch goes to buyer |
| 38 | `customer_order` | `dispatch` | `order_id` | `order_id` | 1:N | RESTRICT | RESTRICT | Dispatch fulfills an order |
| 39 | `invoice` | `dispatch` | `invoice_id` | `invoice_id` | 1:N (optional) | RESTRICT | RESTRICT | Invoice linked after dispatch |
| 40 | `dispatch` | `dispatch_item` | `dispatch_id` | `dispatch_id` | 1:N | RESTRICT | RESTRICT | Rolls in a dispatch |
| 41 | `fabric_roll` | `dispatch_item` | `roll_id` | `roll_id` | 1:N | RESTRICT | RESTRICT | Roll loaded on dispatch |
| 42 | `employee` | `dispatch_item` | `scanned_by_employee_id` | `employee_id` | 1:N | RESTRICT | RESTRICT | Who scanned the roll |
| 43 | `buyer` | `invoice` | `buyer_id` | `buyer_id` | 1:N | RESTRICT | RESTRICT | Invoice billed to buyer |
| 44 | `invoice` | `invoice_item` | `invoice_id` | `invoice_id` | 1:N | RESTRICT | RESTRICT | Invoice line items |
| 45 | `order_item` | `invoice_item` | `order_item_id` | `order_item_id` | 1:N | RESTRICT | RESTRICT | Order line billed on invoice |
| 46 | `buyer` | `buyer_payment` | `buyer_id` | `buyer_id` | 1:N | RESTRICT | RESTRICT | Payment from buyer |
| 47 | `invoice` | `buyer_payment` | `invoice_id` | `invoice_id` | 1:N | RESTRICT | RESTRICT | Payment applied to invoice |
| 48 | `employee` | `buyer_payment` | `created_by_employee_id` | `employee_id` | 1:N | RESTRICT | RESTRICT | Accounts employee who logged |
| 49 | `employee` | `attendance_record` | `employee_id` | `employee_id` | 1:N | RESTRICT | RESTRICT | Daily muster for employee |
| 50 | `employee` | `wage_record` | `employee_id` | `employee_id` | 1:N | RESTRICT | RESTRICT | Monthly payroll for employee |
| 51 | `customer_order` | `cost_entry` | `order_id` | `order_id` | 1:N (optional) | RESTRICT | RESTRICT | Cost attributed to an order |
| 52 | `machine` | `cost_entry` | `machine_id` | `machine_id` | 1:N (optional) | RESTRICT | RESTRICT | Cost absorbed by a machine |
| 53 | `fabric_roll` | `cost_entry` | `roll_id` | `roll_id` | 1:N (optional) | RESTRICT | RESTRICT | Cost attributed to a roll |
| 54 | `yarn_stock_movement` | `cost_entry` | `movement_id` | `movement_id` | 1:1 (optional) | RESTRICT | RESTRICT | Material cost from movement |
| 55 | `wage_record` | `cost_entry` | `wage_id` | `wage_id` | 1:N (optional) | RESTRICT | RESTRICT | Wage cost source |

