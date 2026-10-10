# Everest Textile Manufacturing ERP Backend

An enterprise-grade, high-throughput backend for modern textile manufacturing enterprises, built with **Node.js**, **Express.js**, **MySQL 8.0+** (`mysql2/promise`), and **Zod** schema validation.

This backend enforces strict double-entry-style append-only material accounting, ASTM D5430 4-point quality inspection scoring, state machine orchestration, concurrency protection, idempotency guards, and direct manufacturing cost absorption across the full textile production lifecycle.

---

## Table of Contents
1. [Core Features & Architecture](#core-features--architecture)
2. [Database Design & 30 Canonical Tables](#database-design--30-canonical-tables)
3. [Key Business Rules & Invariants](#key-business-rules--invariants)
4. [Project Structure](#project-structure)
5. [Prerequisites & Environment Setup](#prerequisites--environment-setup)
6. [Database Migration & Seeding](#database-migration--seeding)
7. [Running the Application](#running-the-application)
8. [API Endpoint Reference](#api-endpoint-reference)
9. [Automated Testing](#automated-testing)
10. [Documentation Index](#documentation-index)

---

## Core Features & Architecture

- **Clean Layered Architecture**: Clear separation of concerns with `Routes` $\rightarrow$ `Validation (Zod)` $\rightarrow$ `Controllers` $\rightarrow$ `Services (Business Logic & Transactions)` $\rightarrow$ `Repositories (Parameterized SQL)`.
- **Append-Only Material Ledger**: No mutable `stock_balance` table. Raw material balances and warehouse stock levels are derived exclusively by summing signed transaction deltas (`movement_type`) in `yarn_stock_movement`.
- **Zero Raw-SQL Error Exposure**: Centralized error middleware with standardized RFC 7807 error envelopes, sanitizing database exceptions, duplicate key errors, and foreign key constraint violations.
- **Double-Dispatch Prevention**: MySQL 8.0 generated virtual column + unique index on `dispatch_item` preventing any fabric roll from being actively dispatched on multiple manifests simultaneously.
- **ASTM D5430 4-Point QC Scoring**: Dynamic roll inspection calculations:
  $$\text{Points per } 100 \text{ sq. yd.} = \frac{\text{Total Defect Points} \times 3600}{\text{Inspected Length (yds)} \times \text{Fabric Width (inches)}}$$
- **Decimal-Safe Financial Arithmetic**: Decimal-safe math across all Purchase Orders, GST Tax Invoices, and Wage calculations to prevent IEEE-754 floating-point drift.
- **Shop-Floor Kiosk Idempotency**: `client_request_id` (UUIDv4) idempotency keys prevent duplicate shift output logs and duplicate buyer payments.
- **Comprehensive Operational Reporting**: 9 operational intelligence endpoints providing real-time stock summaries, order stage progression, machine productivity, scrap rates, defect Pareto analysis, AR aging, and direct roll costing.

---

## Database Design & 30 Canonical Tables

The schema strictly adheres to the 30 canonical tables defined in the ERP design specifications:

| Domain | Canonical Tables |
|---|---|
| **Master Data** | `unit_of_measure`, `employee`, `supplier`, `buyer`, `yarn_type`, `yarn_item`, `fabric_product`, `process_stage`, `machine` |
| **Procurement & Inventory** | `purchase_order`, `purchase_order_item`, `goods_receipt`, `goods_receipt_item`, `inward_lot`, `yarn_stock_movement` |
| **Sales & BOM Planning** | `customer_order`, `customer_order_item`, `order_material_requirement` |
| **Production Execution** | `production_job`, `production_log` |
| **Quality Control & Rolls** | `fabric_roll`, `qc_inspection`, `qc_defect` |
| **Dispatch & Delivery** | `dispatch`, `dispatch_item` |
| **Finance & Payments** | `invoice`, `invoice_item`, `buyer_payment` |
| **Workforce & Costing** | `attendance_record`, `wage_record`, `cost_entry` |

All migrations are located in [`database/migrations/`](file:///c:/Users/Akshad/Desktop/Textile_Manufacturing_System_T95/database/migrations/) and numbered sequentially `001_...sql` to `030_...sql`.

---

## Key Business Rules & Invariants

1. **Inventory Conservation**:
   - Stock balances can never be decremented below zero. Attempting to issue or allocate yarn beyond available free stock triggers a transactional `400 Insufficient Stock` rollback.
2. **Double-Dispatch Invariant**:
   - Fabric rolls can only be in one active dispatch at a time. Rolls marked as `removed` from a draft manifest free up the roll for reassignment.
3. **ASTM 4-Point QC Thresholds**:
   - **Grade A**: Score $\le 20$ points / 100 sq. yd.
   - **Grade B**: Score $> 20$ and $\le 40$ points / 100 sq. yd.
   - **Grade C**: Score $> 40$ and $\le 50$ points / 100 sq. yd.
   - **Rejection**: Score $> 50$ points / 100 sq. yd.
4. **GST Tax Invoice Integrity**:
   - Line total = $\text{Quantity} \times \text{Unit Price}$.
   - Subtotal = $\sum \text{Line Totals}$.
   - Tax amount = $\text{Subtotal} \times \frac{\text{Tax Rate}}{100}$.
   - Grand total = $\text{Subtotal} + \text{Tax Amount}$.
5. **Buyer Payment Reconciliation**:
   - Payments update the invoice status:
     - `unpaid` $\rightarrow$ `partial` (if $0 < \text{Paid} < \text{Total}$)
     - `partial` / `unpaid` $\rightarrow$ `paid` (if $\text{Paid} \ge \text{Total}$)
   - Payments cannot exceed the remaining balance due on the invoice.

---

## Project Structure

```text
├── database/
│   ├── migrations/          # 30 canonical table migration SQL scripts (001 - 030)
│   ├── migrate.js           # Automated migration runner with checksum tracking
│   └── seed.js              # Comprehensive master data & demo workflow seeder
├── docs/
│   ├── API_DOCUMENTATION.md # Exhaustive REST API specification with payloads
│   ├── DATABASE_SETUP.md    # MySQL installation, user configuration & schema setup
│   ├── WORKFLOW_EXPLANATION.md # End-to-end manufacturing and financial workflows
│   ├── BACKEND_IMPLEMENTATION_PLAN.md # 14-phase implementation milestone tracker
│   ├── RELATIONSHIP_MATRIX.md # Parent-child FK cascading & cardinality matrix
│   ├── SCHEMA_AUDIT.md      # Detailed 30-table schema audit & validation notes
│   └── KNOWN_GAPS.md        # Documented design decisions & business resolutions
├── src/
│   ├── config/              # Env variable validation & MySQL connection pool
│   ├── middleware/          # Request ID, Zod validator, error handler, not-found
│   ├── modules/             # Modular business domains (Routes, Controllers, Services, Repositories, Schemas)
│   │   ├── attendance/
│   │   ├── buyers/
│   │   ├── costing/
│   │   ├── customer-orders/
│   │   ├── dispatches/
│   │   ├── employees/
│   │   ├── fabric-products/
│   │   ├── fabric-rolls/
│   │   ├── goods-receipts/
│   │   ├── invoices/
│   │   ├── machines/
│   │   ├── payments/
│   │   ├── process-stages/
│   │   ├── production-jobs/
│   │   ├── production-logs/
│   │   ├── purchase-orders/
│   │   ├── qc-inspections/
│   │   ├── reporting/
│   │   ├── suppliers/
│   │   ├── units/
│   │   ├── wages/
│   │   ├── yarn-items/
│   │   ├── yarn-stock/
│   │   └── yarn-types/
│   ├── utils/               # HTTP response helpers, custom AppError classes
│   ├── app.js               # Express application initialization & route mounting
│   └── server.js            # Server listener with graceful shutdown handling
├── tests/
│   ├── unit/                # Pure logic, ASTM formulas, state machines, decimal math
│   └── integration/         # API endpoint validation and health check tests
├── package.json
└── README.md
```

---

## Prerequisites & Environment Setup

### Prerequisites
- **Node.js**: v18.0.0 or later (Node.js 20+ LTS recommended)
- **npm**: v9.0.0 or later
- **MySQL Server**: 8.0 or later

### Environment Configuration
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Update the environment variables to match your local MySQL configuration:
   ```env
   NODE_ENV=development
   PORT=3000
   API_PREFIX=/api/v1
   CORS_ORIGIN=*

   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=textile_app
   DB_PASSWORD=SecurePassword123!
   DB_NAME=textile_manufacturing_db
   DB_CONNECTION_LIMIT=20
   DB_CONNECT_TIMEOUT_MS=10000
   ```

---

## Database Migration & Seeding

Ensure the database schema exists or allow the migration script to apply all 30 migrations:

```bash
# 1. Run all 30 database migrations
npm run migrate

# 2. Seed master data, sample inventory, production runs, and invoices
npm run seed
```

---

## Running the Application

### 1. Backend Server
```bash
# Development mode with hot-reloading (nodemon)
npm run dev

# Production mode
npm start
```
- **Base Health**: `GET http://localhost:3000/api/v1/health`
- **Database Health**: `GET http://localhost:3000/api/v1/health/database`

### 2. Frontend Material You Web App (React + Vite)
```bash
# Start frontend client in development mode
npm run client:dev

# Build production bundle
npm run client:build
```
- **Frontend URL**: `http://localhost:5173` (Proxies all `/api/*` calls automatically to the backend on `localhost:3000`)

---

## API Endpoint Reference

All endpoints are prefixed with `/api/v1`.

### Master Data
- `/employees` - Worker & staff records
- `/suppliers` - Yarn & raw material vendors
- `/buyers` - Fabric customers & wholesale clients
- `/units-of-measure` - Measurement units (`KG`, `METER`, `YARD`, `CONE`, `ROLL`, etc.)
- `/yarn-types` - Yarn classifications & fiber compositions
- `/yarn-items` - Yarn SKUs, counts, lot numbers, and reorder levels
- `/fabric-products` - Fabric specifications (GSM, weave, width, construction)
- `/process-stages` - Production stages (`Warping`, `Weaving`, `Dyeing`, `Finishing`, etc.)
- `/machines` - Loom & processing machinery fleet

### Procurement & Inventory
- `/purchase-orders` - Raw material purchase orders
- `/goods-receipts` - Material inward gate passes & lot creation
- `/yarn-stock-movements` - Double-entry inventory movements (`inward`, `issue`, `return`, `adjustment`, `scrap`)
- `/yarn-items/:id/stock` - Current on-hand stock and reorder alert status
- `/yarn-items/:id/stock-ledger` - Full chronological audit trail of stock movements

### Sales & Production
- `/customer-orders` - Fabric sales orders and line items
- `/order-material-requirements` - Bill of Materials (BOM) & yarn allocation
- `/production-jobs` - Machine job scheduling & stage execution
- `/production-logs` - Shift-wise output & scrap logging with kiosk idempotency
- `/fabric-rolls` - Fabric roll doffing, gross/net weight, and length tracking

### Quality Control & Dispatch
- `/qc-inspections` - ASTM D5430 4-point inspection grading
- `/qc-defects` - Defect catalog with penalty points
- `/dispatches` - Delivery manifests and gate passes
- `/dispatches/:id/items` - Roll barcode scanning and manifest addition
- `/dispatches/items/:itemId/remove` - Roll removal from draft manifest
- `/dispatches/:id/dispatch` - Final gate departure & roll status update to `dispatched`

### Finance & Workforce
- `/invoices` - GST Tax invoices with automated line calculation
- `/buyer-payments` - Cash/bank receipt recording with invoice reconciliation
- `/attendance-records` - Daily muster attendance and overtime hours
- `/wage-records` - Monthly wage calculations (fixed + piece rate + overtime - deductions)
- `/cost-entries` - Direct manufacturing cost absorption entries

### Operational Intelligence & Reports
- `GET /api/v1/reports/inventory-summary` - Real-time stock valuation & low-stock alerts
- `GET /api/v1/reports/order-progress` - Order fulfillment & stage bottleneck tracking
- `GET /api/v1/reports/machine-utilization` - Machine output, run hours & efficiency
- `GET /api/v1/reports/scrap-analysis` - Scrap percentage by stage and job
- `GET /api/v1/reports/qc-defect-pareto` - Top quality defect contributors
- `GET /api/v1/reports/accounts-receivable` - Outstanding invoices & aging buckets
- `GET /api/v1/reports/production-summary` - Daily/weekly total meterage and weight
- `GET /api/v1/reports/job-costing` - Production job cost absorption breakdown
- `GET /api/v1/reports/fabric-roll-traceability` - End-to-end genealogy of a fabric roll

*(For full payload schemas and response examples, refer to [`docs/API_DOCUMENTATION.md`](file:///c:/Users/Akshad/Desktop/Textile_Manufacturing_System_T95/docs/API_DOCUMENTATION.md))*

---

## Automated Testing

The project includes unit and integration tests covering:
- ASTM 4-Point formula calculations
- Financial decimal precision
- Inventory signed delta sums
- State machines & transition guards
- Zod schema input validation
- Health check endpoints

Run the automated test suite:
```bash
npm test
```

---

## Documentation Index

- [`docs/SCHEMA_AUDIT.md`](file:///c:/Users/Akshad/Desktop/Textile_Manufacturing_System_T95/docs/SCHEMA_AUDIT.md): 30-table structure, keys, datatypes, and diagram comparison.
- [`docs/RELATIONSHIP_MATRIX.md`](file:///c:/Users/Akshad/Desktop/Textile_Manufacturing_System_T95/docs/RELATIONSHIP_MATRIX.md): Foreign key dependency and cascade behavior matrix.
- [`docs/DATABASE_SETUP.md`](file:///c:/Users/Akshad/Desktop/Textile_Manufacturing_System_T95/docs/DATABASE_SETUP.md): Step-by-step MySQL configuration and schema deployment guide.
- [`docs/WORKFLOW_EXPLANATION.md`](file:///c:/Users/Akshad/Desktop/Textile_Manufacturing_System_T95/docs/WORKFLOW_EXPLANATION.md): Manufacturing, inventory, and financial lifecycles.
- [`docs/API_DOCUMENTATION.md`](file:///c:/Users/Akshad/Desktop/Textile_Manufacturing_System_T95/docs/API_DOCUMENTATION.md): Comprehensive REST API contract and examples.
- [`docs/BACKEND_IMPLEMENTATION_PLAN.md`](file:///c:/Users/Akshad/Desktop/Textile_Manufacturing_System_T95/docs/BACKEND_IMPLEMENTATION_PLAN.md): Implementation milestone and phase completion tracker.
- [`docs/KNOWN_GAPS.md`](file:///c:/Users/Akshad/Desktop/Textile_Manufacturing_System_T95/docs/KNOWN_GAPS.md): Documented architectural trade-offs and business rules.

---

## License
Proprietary. Everest Textile Manufacturing ERP. All Rights Reserved.
