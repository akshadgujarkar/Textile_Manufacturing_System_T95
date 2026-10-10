-- ============================================================================
-- Migration 0007: Seed Data (Bootstrap User, Roles, Units, Stages & State Machines)
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- ============================================================================

-- 1. Bootstrap System User (Password hash is disabled; login impossible)
INSERT INTO app_user (username, password_hash)
VALUES ('system', '!disabled!')
ON CONFLICT (lower(username)) DO NOTHING;

-- Temporarily set session context for remaining seed operations
SELECT set_config('app.user_id', (SELECT user_id::text FROM app_user WHERE username = 'system'), false);

-- 2. Standard Business Roles
INSERT INTO role (role_name, description) VALUES
 ('admin',              'System administrator: Users, roles and master catalog configuration'),
 ('owner',              'Mill Owner / Executive: Access to all financial P&L and costing views'),
 ('accounts',           'Accounts & Finance: Supplier bills, buyer payments, wages, invoices, period close'),
 ('production_manager', 'Production Manager: Jobs, floor matrix, machine monitoring, downtime logging'),
 ('operator',           'Machine Operator: Touchscreen shift output recording'),
 ('quality_checker',    'Quality Checker: Roll inspections and defect tagging'),
 ('gate_store',         'Gate & Store: Yarn arrival gate entry and finished-goods shelving'),
 ('dispatch',           'Dispatch & Warehouse: Truck loading scanner and gate passes'),
 ('sales',              'Sales & Support: Customer orders and instant phone inquiry desk'),
 ('staff_readonly',     'Read-only Staff: Customer order status lookup')
ON CONFLICT (role_name) DO NOTHING;

-- 3. Units of Measure
INSERT INTO unit_of_measure (unit_code, description) VALUES
 ('kg',  'Kilogram (Weight)'),
 ('m',   'Metre (Length)'),
 ('pcs', 'Pieces (Count)')
ON CONFLICT (unit_code) DO NOTHING;

-- 4. Process Stages
INSERT INTO process_stage (name, sequence_hint) VALUES 
 ('spinning', 1),
 ('weaving',  2),
 ('dyeing',   3)
ON CONFLICT (name) DO NOTHING;

-- 5. Standard Defect Types Catalogue
INSERT INTO defect_type (name) VALUES
 ('Hole'),
 ('Colour Mismatch'),
 ('Bad Weaving'),
 ('Stain / Oil Mark'),
 ('Selvedge Defect'),
 ('Tear / Slub')
ON CONFLICT (name) DO NOTHING;

-- 6. Table-Driven State Machines Catalog (from_status NULL = permitted initial state)
INSERT INTO status_transition (entity_name, from_status, to_status) VALUES
 -- customer_order
 ('customer_order', NULL, 'draft'),
 ('customer_order', 'draft', 'confirmed'), 
 ('customer_order', 'draft', 'cancelled'),
 ('customer_order', 'confirmed', 'cancelled'), 
 ('customer_order', 'confirmed', 'closed'),

 -- production_job
 ('production_job', NULL, 'planned'),
 ('production_job', 'planned', 'running'), 
 ('production_job', 'planned', 'cancelled'),
 ('production_job', 'running', 'interrupted'), 
 ('production_job', 'running', 'completed'),
 ('production_job', 'interrupted', 'running'), 
 ('production_job', 'interrupted', 'cancelled'),
 ('production_job', 'interrupted', 'completed'),

 -- fabric_roll
 ('fabric_roll', NULL, 'pending_qc'),
 ('fabric_roll', 'pending_qc', 'in_stock'), 
 ('fabric_roll', 'pending_qc', 'rework'), 
 ('fabric_roll', 'pending_qc', 'rejected'),
 ('fabric_roll', 'rework', 'pending_qc'), 
 ('fabric_roll', 'rejected', 'scrapped'),
 ('fabric_roll', 'in_stock', 'loaded'), 
 ('fabric_roll', 'loaded', 'in_stock'), 
 ('fabric_roll', 'loaded', 'dispatched'),

 -- dispatch
 ('dispatch', NULL, 'draft'),
 ('dispatch', 'draft', 'loading'), 
 ('dispatch', 'draft', 'cancelled'),
 ('dispatch', 'loading', 'dispatched'), 
 ('dispatch', 'loading', 'cancelled'),

 -- goods_receipt
 ('goods_receipt', NULL, 'received'), 
 ('goods_receipt', 'received', 'cancelled'),

 -- purchase_order
 ('purchase_order', NULL, 'draft'),
 ('purchase_order', 'draft', 'sent'), 
 ('purchase_order', 'draft', 'cancelled'),
 ('purchase_order', 'sent', 'closed'), 
 ('purchase_order', 'sent', 'cancelled'),

 -- yarn_reservation
 ('yarn_reservation', NULL, 'active'),
 ('yarn_reservation', 'active', 'consumed'), 
 ('yarn_reservation', 'active', 'released'),

 -- stock_alert
 ('stock_alert', NULL, 'open'),
 ('stock_alert', 'open', 'acknowledged'), 
 ('stock_alert', 'open', 'resolved'), 
 ('stock_alert', 'acknowledged', 'resolved'),

 -- invoice
 ('invoice', NULL, 'draft'),
 ('invoice', 'draft', 'issued'), 
 ('invoice', 'draft', 'void'), 
 ('invoice', 'issued', 'void'),

 -- buyer_payment
 ('buyer_payment', NULL, 'recorded'), 
 ('buyer_payment', 'recorded', 'reversed'),

 -- wage_record
 ('wage_record', NULL, 'draft'), 
 ('wage_record', 'draft', 'approved'), 
 ('wage_record', 'approved', 'reversed'),

 -- accounting_period
 ('accounting_period', NULL, 'open'), 
 ('accounting_period', 'open', 'closed'),

 -- supplier_bill
 ('supplier_bill', NULL, 'recorded'), 
 ('supplier_bill', 'recorded', 'void')
ON CONFLICT (entity_name, COALESCE(from_status, ''), to_status) DO NOTHING;
