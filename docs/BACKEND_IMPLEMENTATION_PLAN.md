# Backend Implementation Plan: Everest Textile Manufacturing System (30 Canonical Tables)

## 1. System Overview
The Everest Textile Manufacturing System is an enterprise-grade ERP backend for textile manufacturing covering procurement, inventory tracking via an append-only stock ledger, sales orders, bill of materials (BOM), shop-floor production tracking, fabric roll doffing and traceability, ASTM 4-point QC inspections, transport dispatches with double-dispatch prevention, GST invoicing, accounts receivable payments, worker muster attendance, piece-rate wages, and direct manufacturing costing.

## 2. Technology Stack
- **Runtime**: Node.js (CommonJS / ES compatible, modern Node.js runtime)
- **Framework**: Express.js with Helmet, CORS, Morgan, Request ID tracing
- **Database**: MySQL 8.0+ with InnoDB and enforced CHECK constraints
- **Client**: `mysql2/promise` with connection pooling
- **Validation**: Zod schema validation
- **Architecture**: Modular Layered Architecture (Routes -> Controllers -> Services -> Repositories -> SQL)

## 3. Implementation Phases & Completion Status

### Phase 0: Audit & Architecture Specification (Completed)
- `docs/SCHEMA_AUDIT.md`: 30-table comprehensive schema mapping, keys, data types, and diagram discrepancy analysis.
- `docs/RELATIONSHIP_MATRIX.md`: Complete parent-child relationship table with cascade behaviors and foreign key constraints.
- `docs/BACKEND_IMPLEMENTATION_PLAN.md`: Roadmap and verification strategy.
- `docs/KNOWN_GAPS.md`: Documented unresolved business rules and schema design decisions.

### Phase 1: Project Foundation & Database Connection (Completed)
- Environment configuration with validation (`src/config/env.js`).
- MySQL connection pool setup with health check and graceful shutdown (`src/config/database.js`).
- Middleware stack: `request-id.js`, `validate-request.js`, `error-handler.js`, `not-found.js`.
- Standard API response helper: `src/utils/response.js`.
- Health endpoints: `/api/v1/health` and `/api/v1/health/database`.

### Phase 2: Canonical 30-Table MySQL Migrations (Completed)
- 30 versioned SQL migration files (`database/migrations/001_...` to `030_...`).
- Exact MySQL data types (`DECIMAL(p,s)` for currency/weights, `DATETIME(3)` for timestamps, `TINYINT(1)` for boolean).
- Enforced CHECK constraints on positive quantities, non-negative rates, and valid status enums.
- Migration runner script (`database/migrate.js`) and database seeding script (`database/seed.js`).

### Phase 3: Master Data APIs (Completed)
- Employees (`/api/v1/employees`)
- Suppliers (`/api/v1/suppliers`)
- Buyers (`/api/v1/buyers`)
- Units of Measure (`/api/v1/units-of-measure`)
- Yarn Types (`/api/v1/yarn-types`)
- Yarn Items / SKUs (`/api/v1/yarn-items`)
- Fabric Products (`/api/v1/fabric-products`)
- Process Stages (`/api/v1/process-stages`)
- Machines (`/api/v1/machines`)

### Phase 4: Procurement & Raw-Material Inventory (Completed)
- Purchase Orders (`/api/v1/purchase-orders`)
- Goods Receipts & Inward Lots (`/api/v1/goods-receipts`)
- Yarn Stock Movement Ledger (`/api/v1/yarn-stock-movements`, `/api/v1/yarn-items/:id/stock`, `/api/v1/yarn-items/:id/stock-ledger`)
- Reorder level alerts derived from movements and `yarn_item.reorder_level`.

### Phase 5: Customer Orders & Material Planning (Completed)
- Sales Orders (`/api/v1/customer-orders`)
- Order Items (`/api/v1/customer-orders/:id/items`)
- Order Material Requirements / BOM (`/api/v1/order-material-requirements`)
- Transaction-safe inventory reservation.

### Phase 6: Production Execution (Completed)
- Production Jobs (`/api/v1/production-jobs`)
- State machine: `planned` -> `running` -> `interrupted` -> `completed` -> `cancelled`.
- Shift Output Logging (`/api/v1/production-logs`) with kiosk `client_request_id` idempotency.

### Phase 7: Fabric Rolls & Quality Control (Completed)
- Fabric Roll Traceability (`/api/v1/fabric-rolls`)
- ASTM 4-Point QC Inspections (`/api/v1/qc-inspections`)
- QC Defects (`/api/v1/qc-defects`)
- Multi-attempt inspection history and grading (`A`, `B`, `C`, `Rejection`).

### Phase 8: Dispatch & Delivery (Completed)
- Transport Dispatches (`/api/v1/dispatches`)
- Scanned Roll Manifest Lines (`/api/v1/dispatches/:id/items`)
- Manifest roll removal (`/api/v1/dispatches/items/:itemId/remove`)
- Enforced single active roll dispatch constraint via MySQL virtual column unique index.

### Phase 9: Invoicing & Buyer Payments (Completed)
- GST Tax Invoices (`/api/v1/invoices`)
- Invoice Items (`/api/v1/invoices/:id/items`)
- Bank Payments & Receipts (`/api/v1/buyer-payments`) with payment reference uniqueness and reversal tracking.

### Phase 10: Attendance, Wages & Costing (Completed)
- Workforce Daily Muster (`/api/v1/attendance-records`)
- Monthly Wage Calculations (`/api/v1/wage-records`)
- Manufacturing Cost Absorption Ledger (`/api/v1/cost-entries`)

### Phase 11: Operational Reporting & Derived Data (Completed)
- Inventory summary and stock valuation.
- Order progress and manufacturing stage status.
- Machine utilization and shift outputs.
- Scrap analysis across jobs and stages.
- Quality defect Pareto analysis.
- Accounts receivable aging and outstanding invoices.
- Production summary by date range.
- Direct job costing breakdown.
- End-to-end fabric roll genealogy traceability.

### Phase 12: Cross-Cutting Standards (Completed)
- RESTful standards, query pagination, sorting whitelists, field filters.
- Global centralized error formatting without SQL leakage.
- Standardized RFC-7807 problem responses with request tracing.

### Phase 13: Automated Testing & Verification (Completed)
- Node.js test runner suite (`npm test`).
- Integration tests for atomic transactions, endpoint validation, and health checks.
- Unit tests for ASTM formula calculation, financial precision arithmetic, and state transitions.

### Phase 14: Documentation & Delivery (Completed)
- `README.md`
- `docs/API_DOCUMENTATION.md`
- `docs/DATABASE_SETUP.md`
- `docs/WORKFLOW_EXPLANATION.md`
- `docs/BACKEND_IMPLEMENTATION_PLAN.md`
- `docs/RELATIONSHIP_MATRIX.md`
- `docs/SCHEMA_AUDIT.md`
- `docs/KNOWN_GAPS.md`
