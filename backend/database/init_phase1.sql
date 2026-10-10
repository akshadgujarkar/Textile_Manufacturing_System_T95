-- ============================================================================
-- Consolidated Phase 1 Execution Script: Database Foundations & Schema
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- Executes: Migrations 0001 through 0006
-- ============================================================================

\echo '=================================================='
\echo 'Starting Everest Textile TMS: Phase 1 DDL Setup...'
\echo '=================================================='

BEGIN;

\echo '-> Applying Migration 0001: Foundation, Domains, Sequences & Helper Functions...'
\ir migrations/0001_foundation.sql

\echo '-> Applying Migration 0002: Access, People and Master Data...'
\ir migrations/0002_masters.sql

\echo '-> Applying Migration 0003: Orders, Purchasing, Gate Entry & Supplier Bills...'
\ir migrations/0003_orders_and_purchasing.sql

\echo '-> Applying Migration 0004: Production Floor, Stock Ledger & Balance...'
\ir migrations/0004_production_and_stock.sql

\echo '-> Applying Migration 0005: Rolls, Quality Inspections, Invoices & Dispatch...'
\ir migrations/0005_rolls_quality_dispatch.sql

\echo '-> Applying Migration 0006: Finance, Workforce, Cost Ledger & Audit...'
\ir migrations/0006_finance_workforce_audit.sql

COMMIT;

\echo '=================================================='
\echo 'Phase 1 DDL Migration Complete Successfully!'
\echo '=================================================='
