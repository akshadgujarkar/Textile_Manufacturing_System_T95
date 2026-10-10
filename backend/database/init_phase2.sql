-- ============================================================================
-- Consolidated Phase 2 Execution Script: Triggers, Views, Indexes & Security
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- Executes: Migrations 0007 through 0011
-- ============================================================================

\echo '=================================================='
\echo 'Starting Everest Textile TMS: Phase 2 DDL Setup...'
\echo '=================================================='

BEGIN;

\echo '-> Applying Migration 0007: Seed Data (Bootstrap User, Roles, Units, Stages & State Machines)...'
\ir migrations/0007_seed_data.sql

\echo '-> Applying Migration 0008: Database Integrity Triggers & Domain Invariants...'
\ir migrations/0008_integrity_triggers.sql

\echo '-> Applying Migration 0009: Production SQL Views & Performance Indexes...'
\ir migrations/0009_views_and_indexes.sql

\echo '-> Applying Migration 0010: Database Connection Roles & Column-Level Security...'
\ir migrations/0010_security_roles.sql

\echo '-> Applying Migration 0011: Automated Non-Repudiable Audit Logging System...'
\ir migrations/0011_audit_triggers.sql

COMMIT;

\echo '=================================================='
\echo 'Phase 2 DDL Migration Complete Successfully!'
\echo '=================================================='
