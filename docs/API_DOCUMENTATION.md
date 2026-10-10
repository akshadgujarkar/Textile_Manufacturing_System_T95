# API Documentation: Everest Textile Manufacturing System

Base URL: `/api/v1`

## Standard Request & Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data",
    "details": [
      {
        "field": "employee_code",
        "message": "Required"
      }
    ]
  }
}
```

---

## 1. System Health

- `GET /health` : Application liveness and uptime check.
- `GET /health/database` : Validates live MySQL connection pool connectivity and latency.

---

## 2. Master Data APIs

### Employees (`/employees`)
- `GET /employees` : List employees with pagination, `search`, `is_active` filter.
- `GET /employees/:id` : Retrieve single employee profile.
- `POST /employees` : Create employee (`employee_code`, `full_name`, `designation`, `pay_basis`, `pay_rate`, `phone`, `is_active`).
- `PATCH /employees/:id` : Update employee profile or active status.

### Suppliers (`/suppliers`)
- `GET /suppliers` : List yarn suppliers with search and active status filter.
- `GET /suppliers/:id` : Retrieve single supplier by ID.
- `POST /suppliers` : Register yarn spinning mill / supplier.
- `PATCH /suppliers/:id` : Update supplier details.

### Buyers (`/buyers`)
- `GET /buyers` : List apparel buyers with credit limit and terms.
- `GET /buyers/:id` : Retrieve buyer profile.
- `POST /buyers` : Create buyer (`buyer_code`, `name`, `gstin`, `credit_limit`, `payment_terms_days`).
- `PATCH /buyers/:id` : Update buyer profile.

### Units of Measure (`/units-of-measure`)
- `GET /units-of-measure` : List units (`kg`, `m`, `pcs`, `cone`).
- `GET /units-of-measure/:id` : Retrieve unit.
- `POST /units-of-measure` : Create unit.
- `PATCH /units-of-measure/:id` : Update unit description.

### Yarn Types (`/yarn-types`)
- `GET /yarn-types` : List yarn specifications (count, fiber content).
- `GET /yarn-types/:id` : Retrieve yarn type.
- `POST /yarn-types` : Create yarn type (`name`, `fiber_content`, `nominal_count`).
- `PATCH /yarn-types/:id` : Update yarn type.

### Yarn Items / Stockable SKUs (`/yarn-items`)
- `GET /yarn-items` : List yarn items with real-time derived stock balance.
- `GET /yarn-items/:id` : Retrieve yarn item by ID.
- `POST /yarn-items` : Create yarn SKU (`yarn_type_id`, `colour_code`, `unit_id`, `reorder_level`).
- `PATCH /yarn-items/:id` : Update yarn SKU details.
- `GET /yarn-items/:id/stock` : Calculate current inventory balance & low-stock warning from `yarn_stock_movement`.
- `GET /yarn-items/:id/stock-ledger` : Paginated audit trail of all stock movements for this SKU.

### Fabric Products (`/fabric-products`)
- `GET /fabric-products` : List finished fabric product specifications (weave type, GSM, width).
- `GET /fabric-products/:id` : Retrieve fabric product.
- `POST /fabric-products` : Create fabric product.
- `PATCH /fabric-products/:id` : Update fabric product.

### Process Stages (`/process-stages`)
- `GET /process-stages` : List sequential manufacturing stages.
- `GET /process-stages/:id` : Retrieve stage.
- `POST /process-stages` : Create process stage (`name`, `sequence_hint`).
- `PATCH /process-stages/:id` : Update sequence hint or name.

### Machines (`/machines`)
- `GET /machines` : List shop-floor machines with stage capability and status (`running`, `idle`, `maintenance`, `stopped`).
- `GET /machines/:id` : Retrieve machine details.
- `POST /machines` : Create machine (`machine_code`, `stage_id`, `make_model`, `rated_rpm`).
- `PATCH /machines/:id` : Update machine or current status.

---

## 3. Procurement & Inventory APIs

### Purchase Orders (`/purchase-orders`)
- `GET /purchase-orders` : List purchase orders with status & supplier filter.
- `GET /purchase-orders/:id` : Retrieve PO with line items.
- `POST /purchase-orders` : Create PO header with line items in an atomic transaction.
- `POST /purchase-orders/:id/items` : Add item to draft PO.
- `PATCH /purchase-orders/:id/status` : Transition status (`draft` -> `sent` -> `partially_received` -> `closed` -> `cancelled`).

### Goods Receipts / Gate Inward (`/goods-receipts`)
- `GET /goods-receipts` : List gate inwards with supplier and PO references.
- `GET /goods-receipts/:id` : Retrieve GRN with received yarn lot items.
- `POST /goods-receipts` : Idempotent gate inward creation. Transactionally creates GRN, lot items, and corresponding `receipt` (+) entries in `yarn_stock_movement`.

### Yarn Stock Movements (`/yarn-stock-movements`)
- `GET /yarn-stock-movements` : List raw yarn stock ledger entries.
- `GET /yarn-stock-movements/:id` : Retrieve single stock movement.
- `POST /yarn-stock-movements` : Post manual stock adjustment or issue with balance validation.
- `POST /yarn-stock-movements/:id/reverse` : Post an audit-traceable reversal movement entry.
- `GET /yarn-stock-movements/reorder-alerts` : Real-time list of yarn SKUs below reorder thresholds.

---

## 4. Customer Orders & Material Planning

### Customer Orders (`/customer-orders`)
- `GET /customer-orders` : List customer orders.
- `GET /customer-orders/:id` : Retrieve order with lines and BOM requirements.
- `POST /customer-orders` : Create customer order with line items.
- `PATCH /customer-orders/:id/status` : Update order status with optimistic concurrency `version`.
- `POST /customer-orders/:id/confirm` : Confirm order (`draft` -> `confirmed`).
- `POST /customer-orders/:id/cancel` : Cancel order.

### Order Material Requirements / BOM (`/order-material-requirements`)
- `GET /order-material-requirements` : List BOM requirements.
- `GET /order-material-requirements/:id` : Retrieve single BOM line.
- `POST /order-material-requirements` : Create material requirement.
- `POST /order-material-requirements/:id/reserve` : Transaction-safely reserve stock for this requirement.
- `POST /order-material-requirements/:id/release` : Release reserved stock.

---

## 5. Production Execution

### Production Jobs (`/production-jobs`)
- `GET /production-jobs` : List shop-floor jobs with machine, stage, and order links.
- `GET /production-jobs/:id` : Retrieve job with shift logs and doffed rolls.
- `POST /production-jobs` : Create production job ticket.
- `POST /production-jobs/:id/start` : Start job on machine (sets machine to `running`).
- `POST /production-jobs/:id/complete` : Complete job (sets machine to `idle`).
- `POST /production-jobs/:id/cancel` : Cancel job ticket.

### Shift Production Logs (`/production-logs`)
- `GET /production-logs` : List operator shift logs.
- `GET /production-logs/:id` : Retrieve shift log.
- `POST /production-logs` : Idempotent touchscreen kiosk submission (`output_qty`, `scrap_qty`, `power_kwh`, `shift_code`, `client_request_id`).

---

## 6. Fabric Rolls & Quality Control

### Fabric Rolls (`/fabric-rolls`)
- `GET /fabric-rolls` : List rolls with length, weight, GSM, and status.
- `GET /fabric-rolls/:id` : Retrieve roll with all QC inspection attempts.
- `POST /fabric-rolls` : Doff new fabric roll from production job.
- `PATCH /fabric-rolls/:id/status` : Update roll status with optimistic locking.

### QC Inspections (`/qc-inspections`)
- `GET /qc-inspections` : List ASTM 4-point inspections.
- `GET /qc-inspections/:id` : Retrieve inspection with defect details.
- `POST /qc-inspections` : Perform ASTM inspection with defects in an atomic transaction; computes normalized penalty benchmark and automatically updates roll status (`in_stock`, `rework`, `rejected`).

### QC Defects (`/qc-defects`)
- `GET /qc-defects` : List detected defects with points and severity.
- `GET /qc-defects/:id` : Retrieve defect item.

---

## 7. Transport Dispatch & Manifest Tracking

### Dispatches (`/dispatches`)
- `GET /dispatches` : List dispatches with vehicle, driver, and active roll count.
- `GET /dispatches/:id` : Retrieve dispatch manifest with loaded rolls.
- `POST /dispatches` : Create dispatch manifest header.
- `POST /dispatches/:id/items` : Barcode scan roll onto lorry with strict double-dispatch collision check.
- `POST /dispatches/:id/items/:itemId/remove` : Offload roll; marks manifest item `removed` and reverts roll to `in_stock`.
- `POST /dispatches/:id/dispatch` : Final gate departure; transitions all loaded rolls to `dispatched`.
- `POST /dispatches/:id/cancel` : Cancel dispatch and release rolls back to `in_stock`.

---

## 8. Invoicing & Buyer Payments

### Invoices (`/invoices`)
- `GET /invoices` : List tax invoices with subtotal, GST tax, and paid/outstanding balances.
- `GET /invoices/:id` : Retrieve invoice with lines and payment receipts.
- `POST /invoices` : Create tax invoice with decimal-safe GST calculation.
- `POST /invoices/:id/issue` : Issue invoice (`draft` -> `issued`).
- `POST /invoices/:id/void` : Void invoice.

### Buyer Payments (`/buyer-payments`)
- `GET /buyer-payments` : List payment receipts.
- `GET /buyer-payments/:id` : Retrieve payment receipt.
- `POST /buyer-payments` : Record payment receipt against an invoice with buyer verification and idempotency guard.
- `POST /buyer-payments/:id/reverse` : Reverse a recorded payment receipt.

---

## 9. Attendance, Wages & Costing

### Attendance Records (`/attendance-records`)
- `GET /attendance-records` : List workforce daily attendance muster.
- `GET /attendance-records/:id` : Retrieve attendance record.
- `POST /attendance-records` : Record daily attendance (enforces unique employee-date-shift).
- `PATCH /attendance-records/:id` : Update attendance status / hours worked.

### Wage Records (`/wage-records`)
- `GET /wage-records` : List monthly payroll calculations.
- `GET /wage-records/:id` : Retrieve wage record.
- `POST /wage-records` : Create monthly wage calculation (base + piece rate + bonus).
- `POST /wage-records/:id/approve` : Approve wage record.
- `POST /wage-records/:id/disburse` : Disburse wage payment.
- `POST /wage-records/:id/reverse` : Reverse wage record.

### Cost Entries (`/cost-entries`)
- `GET /cost-entries` : List direct manufacturing cost entries.
- `GET /cost-entries/:id` : Retrieve cost entry.
- `POST /cost-entries` : Allocate cost (material, wage, power, maintenance, overhead).

---

## 10. Operational Reports (`/reports`)

- `GET /reports/inventory-summary` : Inward, outward, and net stock for all SKUs.
- `GET /reports/reorder-alerts` : Real-time alerts for SKUs below threshold.
- `GET /reports/order-progress` : Ordered vs produced vs inspected vs dispatched meters.
- `GET /reports/production-output` : Aggregated meterage, scrap, and kWh by shift and machine.
- `GET /reports/roll-quality` : ASTM grade breakdown and top defects.
- `GET /reports/invoice-outstanding` : Accounts receivable aging and outstanding balances.
- `GET /reports/cost-by-order` : Cost absorption by customer order.
- `GET /reports/cost-by-machine` : Maintenance and power costs by machine.
- `GET /reports/wage-summary` : Monthly payroll totals and employee counts.
