-- ============================================================================
-- Migration 0011: Automated Non-Repudiable Audit Logging System
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_actor_id bigint;
    v_entity_id text;
    v_before jsonb := NULL;
    v_after jsonb := NULL;
    v_reason text;
    v_source text;
BEGIN
    v_actor_id := app_current_user_id();
    IF v_actor_id IS NULL THEN
        SELECT user_id INTO v_actor_id FROM app_user WHERE username = 'system';
    END IF;

    v_reason := NULLIF(current_setting('app.reason', true), '');
    v_source := NULLIF(current_setting('app.source', true), '');

    IF TG_OP = 'INSERT' THEN
        v_after := to_jsonb(NEW);
        IF TG_TABLE_NAME = 'app_user' THEN
            v_after := v_after - 'password_hash';
        END IF;
        EXECUTE format('SELECT ($1).%I::text', TG_ARGV[0]) INTO v_entity_id USING NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        v_before := to_jsonb(OLD);
        v_after := to_jsonb(NEW);
        IF TG_TABLE_NAME = 'app_user' THEN
            v_before := v_before - 'password_hash';
            v_after := v_after - 'password_hash';
        END IF;
        EXECUTE format('SELECT ($1).%I::text', TG_ARGV[0]) INTO v_entity_id USING NEW;

    ELSIF TG_OP = 'DELETE' THEN
        v_before := to_jsonb(OLD);
        IF TG_TABLE_NAME = 'app_user' THEN
            v_before := v_before - 'password_hash';
        END IF;
        EXECUTE format('SELECT ($1).%I::text', TG_ARGV[0]) INTO v_entity_id USING OLD;
    END IF;

    INSERT INTO audit_log (actor_id, action, entity_name, entity_id, before_data, after_data, reason, source)
    VALUES (COALESCE(v_actor_id, 1), TG_OP, TG_TABLE_NAME, v_entity_id, v_before, v_after, v_reason, v_source);

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

-- ----------------------------------------------------------------------------
-- Attach Audit Triggers to Sensitive Tables
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_audit_app_user ON app_user;
CREATE TRIGGER trg_audit_app_user AFTER INSERT OR UPDATE OR DELETE ON app_user
    FOR EACH ROW EXECUTE FUNCTION trg_audit('user_id');

DROP TRIGGER IF EXISTS trg_audit_user_role ON user_role;
CREATE TRIGGER trg_audit_user_role AFTER INSERT OR UPDATE OR DELETE ON user_role
    FOR EACH ROW EXECUTE FUNCTION trg_audit('user_id');

DROP TRIGGER IF EXISTS trg_audit_employee ON employee;
CREATE TRIGGER trg_audit_employee AFTER INSERT OR UPDATE OR DELETE ON employee
    FOR EACH ROW EXECUTE FUNCTION trg_audit('employee_id');

DROP TRIGGER IF EXISTS trg_audit_customer_order ON customer_order;
CREATE TRIGGER trg_audit_customer_order AFTER UPDATE OR DELETE ON customer_order
    FOR EACH ROW EXECUTE FUNCTION trg_audit('order_id');

DROP TRIGGER IF EXISTS trg_audit_supplier_bill ON supplier_bill;
CREATE TRIGGER trg_audit_supplier_bill AFTER UPDATE OR DELETE ON supplier_bill
    FOR EACH ROW EXECUTE FUNCTION trg_audit('bill_id');

DROP TRIGGER IF EXISTS trg_audit_buyer_payment ON buyer_payment;
CREATE TRIGGER trg_audit_buyer_payment AFTER UPDATE OR DELETE ON buyer_payment
    FOR EACH ROW EXECUTE FUNCTION trg_audit('payment_id');

DROP TRIGGER IF EXISTS trg_audit_wage_record ON wage_record;
CREATE TRIGGER trg_audit_wage_record AFTER INSERT OR UPDATE OR DELETE ON wage_record
    FOR EACH ROW EXECUTE FUNCTION trg_audit('wage_id');

DROP TRIGGER IF EXISTS trg_audit_accounting_period ON accounting_period;
CREATE TRIGGER trg_audit_accounting_period AFTER UPDATE OR DELETE ON accounting_period
    FOR EACH ROW EXECUTE FUNCTION trg_audit('period_id');
