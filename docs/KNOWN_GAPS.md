# Known Gaps & Unresolved Business Decisions

This document tracks ambiguities, missing formulas, or intentional design omissions discovered during the schema audit and implementation of the Everest Textile Manufacturing 30-Table ERP.

## 1. Authentication & Role-Based Authorization
- **Observation**: The 30 canonical tables intentionally exclude `app_user`, `role`, `user_role`, and session tables.
- **Resolution**: The system identifies actors using the `employee` master table (`employee_id`). User authentication (JWT/OAuth) is designated as a transport/gateway middleware integration point. Internal database audit columns use `created_by` / `employee_id` referencing `employee`.

## 2. Fabric-to-Yarn Consumption Formula (BOM Calculation)
- **Observation**: The source document defines `order_material_requirement` with `required_qty`, `waste_factor_pct`, and `reserved_qty`, but does not provide an automated mathematical formula to convert Fabric Metres + GSM + Width into Yarn Kilograms.
- **Resolution**: Requirements accept explicitly calculated/provided `required_qty` and `waste_factor_pct`. The system does not invent speculative consumption formulas.

## 3. Stock Balance Storage
- **Observation**: There is no separate `yarn_stock_balance` table.
- **Resolution**: Stock balance is strictly derived on-demand or through reporting queries by summing the signed `quantity` in `yarn_stock_movement`. Reorder warnings are evaluated in real-time against `yarn_item.reorder_level`.

## 4. Double Dispatch Prevention on `dispatch_item`
- **Observation**: A fabric roll can be added to a dispatch in `active` state or marked `removed` if offloaded prior to lorry departure. The requirement is that no roll can be in more than one `active` dispatch manifest at the same time.
- **Resolution**: Implemented via a MySQL 8 generated virtual column:
  `active_roll_id INT AS (IF(state = 'active', roll_id, NULL)) VIRTUAL`
  with a `UNIQUE KEY uq_dispatch_item_active_roll (active_roll_id)`.
  Since MySQL ignores NULLs in unique indexes, multiple `removed` entries (where `active_roll_id` is NULL) are allowed, while duplicate `active` states are strictly rejected at the database level.

## 5. Attendance Adjustment & Piece-Rate Incentive Formulas
- **Observation**: The source provides attributes in `wage_record` (`base_amount`, `piece_rate_amount`, `bonus_overtime`, `gross_amount`), but lacks a parameterized piece-rate per meter or attendance penalty formula.
- **Resolution**: Wage calculation endpoints accept explicitly provided component amounts or calculate gross wages strictly as `base_amount + piece_rate_amount + bonus_overtime` with status workflows (`draft` -> `approved` -> `disbursed` -> `reversed`).

## 6. Payment Allocation Across Multiple Invoices
- **Observation**: No intermediate `payment_allocation` cross-table exists.
- **Resolution**: As specified in the canonical schema, `buyer_payment` carries a direct foreign key `invoice_id`. Each payment is linked to a single invoice. Partial payments are supported by multiple payment rows referencing the same `invoice_id`.

## 7. Diagram Discrepancies Resolved
- `fabric_roll` references `production_job(job_id)`, not `production_log`.
- `production_log` references `production_job(job_id)` and `employee(employee_id)`, not `machine` directly (machine is inherited via `production_job`).
- `dispatch_item` references `dispatch(dispatch_id)` and `fabric_roll(roll_id)`.
- `cost_entry` declares optional foreign keys to `customer_order`, `machine`, `fabric_roll`, `yarn_stock_movement`, and `wage_record`.
