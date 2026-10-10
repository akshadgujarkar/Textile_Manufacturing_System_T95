-- ============================================================================
-- Migration 0008: Database Integrity Triggers & Domain Invariant Enforcers
-- Project: Textile Manufacturing System — Everest Textile Mills
-- Target: PostgreSQL 15+
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Accounting Period Helpers & Invariants (INV-11)
-- ----------------------------------------------------------------------------

-- Returns OPEN accounting period for a date; creates calendar month if missing; raises BR004 if closed.
CREATE OR REPLACE FUNCTION period_for(p_date date) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_id bigint; v_status text;
BEGIN
  SELECT period_id, status INTO v_id, v_status
    FROM accounting_period WHERE p_date BETWEEN period_start AND period_end;
  IF NOT FOUND THEN
    INSERT INTO accounting_period (period_start, period_end)
    VALUES (date_trunc('month', p_date)::date, (date_trunc('month', p_date) + interval '1 month - 1 day')::date)
    ON CONFLICT DO NOTHING;
    SELECT period_id, status INTO v_id, v_status
      FROM accounting_period WHERE p_date BETWEEN period_start AND period_end;
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'Accounting period for % is closed', p_date USING ERRCODE = 'BR004';
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION trg_period_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'closed' THEN
      RAISE EXCEPTION 'A closed accounting period cannot be modified' USING ERRCODE = 'BR004';
    END IF;
    IF NEW.status = 'closed' THEN
      IF EXISTS (SELECT 1 FROM wage_record WHERE period_id = NEW.period_id AND status = 'draft') THEN
        RAISE EXCEPTION 'Approve or reverse all draft wage records before closing the period' USING ERRCODE = 'BR004';
      END IF;
      NEW.closed_at := now();
      NEW.closed_by := app_current_user_id();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_period_before ON accounting_period;
CREATE TRIGGER trg_period_before BEFORE INSERT OR UPDATE ON accounting_period
  FOR EACH ROW EXECUTE FUNCTION trg_period_before();

-- Ledger rows may only be posted into an open period
CREATE OR REPLACE FUNCTION trg_cost_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT status FROM accounting_period WHERE period_id = NEW.period_id) <> 'open' THEN
    RAISE EXCEPTION 'Cannot post cost into a closed accounting period' USING ERRCODE = 'BR004';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cost_before ON cost_entry;
CREATE TRIGGER trg_cost_before BEFORE INSERT ON cost_entry
  FOR EACH ROW EXECUTE FUNCTION trg_cost_before();

-- ----------------------------------------------------------------------------
-- 2. Customer Orders (BR-11, State Machine)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_order_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'draft' AND NEW.buyer_id <> OLD.buyer_id THEN
      RAISE EXCEPTION 'The buyer of a confirmed order cannot change' USING ERRCODE = 'BR003';
    END IF;
    IF NEW.status = 'confirmed' AND OLD.status = 'draft' THEN
      IF NOT EXISTS (SELECT 1 FROM order_item WHERE order_id = NEW.order_id) THEN
        RAISE EXCEPTION 'An order needs at least one line before it can be confirmed' USING ERRCODE = 'BR010';
      END IF;
      NEW.confirmed_at := now();
    ELSIF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
      IF EXISTS (SELECT 1 FROM production_job j JOIN order_item oi USING (order_item_id)
                  WHERE oi.order_id = NEW.order_id AND j.status IN ('running', 'interrupted'))
         OR EXISTS (SELECT 1 FROM dispatch d WHERE d.order_id = NEW.order_id AND d.status IN ('loading', 'dispatched'))
         OR EXISTS (SELECT 1 FROM invoice_item ii JOIN invoice i USING (invoice_id) JOIN order_item oi USING (order_item_id)
                     WHERE oi.order_id = NEW.order_id AND i.status = 'issued') THEN
        RAISE EXCEPTION 'Order has running jobs, active dispatches or issued invoices and cannot be cancelled' USING ERRCODE = 'BR010';
      END IF;
      NEW.cancelled_at := now();
      NEW.cancelled_by := app_current_user_id();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_before ON customer_order;
CREATE TRIGGER trg_order_before BEFORE INSERT OR UPDATE ON customer_order
  FOR EACH ROW EXECUTE FUNCTION trg_order_before();

CREATE OR REPLACE FUNCTION trg_order_history_ins() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO order_status_history (order_id, from_status, to_status) VALUES (NEW.order_id, NULL, NEW.status);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_order_history_ins ON customer_order;
CREATE TRIGGER trg_order_history_ins AFTER INSERT ON customer_order
  FOR EACH ROW EXECUTE FUNCTION trg_order_history_ins();

CREATE OR REPLACE FUNCTION trg_order_history_upd() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO order_status_history (order_id, from_status, to_status, reason)
  VALUES (NEW.order_id, OLD.status, NEW.status,
          COALESCE(NEW.cancel_reason, NULLIF(current_setting('app.reason', true), '')));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_order_history_upd ON customer_order;
CREATE TRIGGER trg_order_history_upd AFTER UPDATE OF status ON customer_order
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_order_history_upd();

-- ----------------------------------------------------------------------------
-- 3. Gate Entry, Yarn Lots & Stock Engine (INV-1, INV-9, FR-1.x)
-- ----------------------------------------------------------------------------

-- Newly created yarn item gets initial zero balance row (1:1)
CREATE OR REPLACE FUNCTION trg_yarn_item_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO yarn_stock_balance (yarn_item_id) VALUES (NEW.yarn_item_id)
  ON CONFLICT (yarn_item_id) DO NOTHING;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_yarn_item_balance ON yarn_item;
CREATE TRIGGER trg_yarn_item_balance AFTER INSERT ON yarn_item
  FOR EACH ROW EXECUTE FUNCTION trg_yarn_item_balance();

CREATE OR REPLACE FUNCTION trg_receipt_item_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM goods_receipt
                  WHERE receipt_id = NEW.receipt_id AND status = 'received' AND created_at = now()) THEN
    RAISE EXCEPTION 'Receipt lines can only be added while the receipt is being created' USING ERRCODE = 'BR003';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_receipt_item_before ON goods_receipt_item;
CREATE TRIGGER trg_receipt_item_before BEFORE INSERT ON goods_receipt_item
  FOR EACH ROW EXECUTE FUNCTION trg_receipt_item_before();

CREATE OR REPLACE FUNCTION trg_receipt_item_post() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO yarn_stock_movement (yarn_item_id, movement_type, quantity, unit_cost, receipt_item_id)
  VALUES (NEW.yarn_item_id, 'receipt', NEW.quantity_received, COALESCE(NEW.unit_rate, 0), NEW.receipt_item_id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_receipt_item_post ON goods_receipt_item;
CREATE TRIGGER trg_receipt_item_post AFTER INSERT ON goods_receipt_item
  FOR EACH ROW EXECUTE FUNCTION trg_receipt_item_post();

CREATE OR REPLACE FUNCTION trg_receipt_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'received' THEN
    NEW.cancelled_at := now();
    NEW.cancelled_by := app_current_user_id();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_receipt_before ON goods_receipt;
CREATE TRIGGER trg_receipt_before BEFORE UPDATE ON goods_receipt
  FOR EACH ROW EXECUTE FUNCTION trg_receipt_before();

CREATE OR REPLACE FUNCTION trg_bill_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'void' AND OLD.status = 'recorded' THEN
    NEW.voided_at := now();
    NEW.voided_by := app_current_user_id();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bill_before ON supplier_bill;
CREATE TRIGGER trg_bill_before BEFORE UPDATE ON supplier_bill
  FOR EACH ROW EXECUTE FUNCTION trg_bill_before();

-- Cancelling receipt reverses every receipt movement
CREATE OR REPLACE FUNCTION trg_receipt_cancel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO yarn_stock_movement (yarn_item_id, movement_type, quantity, reverses_movement_id, reason)
  SELECT m.yarn_item_id, 'reversal', -m.quantity, m.movement_id, 'Receipt ' || NEW.receipt_no || ' cancelled: ' || NEW.cancel_reason
    FROM yarn_stock_movement m
    JOIN goods_receipt_item gi ON gi.receipt_item_id = m.receipt_item_id
   WHERE gi.receipt_id = NEW.receipt_id AND m.movement_type = 'receipt'
   ORDER BY m.yarn_item_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_receipt_cancel ON goods_receipt;
CREATE TRIGGER trg_receipt_cancel AFTER UPDATE OF status ON goods_receipt
  FOR EACH ROW WHEN (OLD.status = 'received' AND NEW.status = 'cancelled')
  EXECUTE FUNCTION trg_receipt_cancel();

-- Core Stock Engine: Locks balance row, updates on-hand, maintains weighted average cost, updates alerts
CREATE OR REPLACE FUNCTION trg_movement_apply() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  b          yarn_stock_balance%ROWTYPE;
  v_orig     yarn_stock_movement%ROWTYPE;
  v_on_hand  qty_t;
  v_reorder  qty_t;
BEGIN
  SELECT * INTO b FROM yarn_stock_balance WHERE yarn_item_id = NEW.yarn_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No stock balance row for yarn item %', NEW.yarn_item_id;
  END IF;

  IF NEW.movement_type = 'reversal' THEN
    SELECT * INTO v_orig FROM yarn_stock_movement WHERE movement_id = NEW.reverses_movement_id;
    IF NOT FOUND OR v_orig.movement_type = 'reversal'
       OR v_orig.yarn_item_id <> NEW.yarn_item_id OR NEW.quantity <> -v_orig.quantity THEN
      RAISE EXCEPTION 'A reversal must fully offset one earlier non-reversal movement of the same yarn item'
        USING ERRCODE = 'BR011';
    END IF;
    NEW.unit_cost := v_orig.unit_cost;
  ELSIF NEW.quantity < 0 THEN
    NEW.unit_cost := b.avg_cost;
  ELSE
    NEW.unit_cost := COALESCE(NEW.unit_cost,
                              (SELECT unit_rate FROM goods_receipt_item WHERE receipt_item_id = NEW.receipt_item_id),
                              b.avg_cost);
  END IF;

  UPDATE yarn_stock_balance
     SET on_hand_qty  = on_hand_qty + NEW.quantity,
         avg_cost     = CASE WHEN NEW.quantity > 0
                             THEN round((on_hand_qty * avg_cost + NEW.quantity * NEW.unit_cost)
                                        / (on_hand_qty + NEW.quantity), 4)
                             ELSE avg_cost END,
         refreshed_at = now()
   WHERE yarn_item_id = NEW.yarn_item_id
   RETURNING on_hand_qty INTO v_on_hand;

  SELECT reorder_level INTO v_reorder FROM yarn_item WHERE yarn_item_id = NEW.yarn_item_id;
  IF v_on_hand <= v_reorder THEN
    INSERT INTO stock_alert (yarn_item_id, balance_at_trigger) VALUES (NEW.yarn_item_id, v_on_hand)
    ON CONFLICT (yarn_item_id) WHERE status IN ('open', 'acknowledged') DO NOTHING;
  ELSE
    UPDATE stock_alert SET status = 'resolved', resolved_at = now()
     WHERE yarn_item_id = NEW.yarn_item_id AND status IN ('open', 'acknowledged');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_movement_apply ON yarn_stock_movement;
CREATE TRIGGER trg_movement_apply BEFORE INSERT ON yarn_stock_movement
  FOR EACH ROW EXECUTE FUNCTION trg_movement_apply();

-- Material cost recognized when yarn is issued to a job
CREATE OR REPLACE FUNCTION trg_movement_cost() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_job_id   bigint;
  v_orig     yarn_stock_movement%ROWTYPE;
  v_rev_cost bigint;
  v_order    bigint;
  v_machine  bigint;
BEGIN
  IF NEW.movement_type IN ('issue', 'return') THEN
    v_job_id := NEW.production_job_id;
  ELSIF NEW.movement_type = 'reversal' THEN
    SELECT * INTO v_orig FROM yarn_stock_movement WHERE movement_id = NEW.reverses_movement_id;
    IF v_orig.movement_type NOT IN ('issue', 'return') THEN RETURN NULL; END IF;
    v_job_id := v_orig.production_job_id;
    SELECT cost_id INTO v_rev_cost FROM cost_entry
     WHERE movement_id = NEW.reverses_movement_id AND reverses_cost_id IS NULL;
  ELSE
    RETURN NULL;
  END IF;

  SELECT oi.order_id, j.machine_id INTO v_order, v_machine
    FROM production_job j JOIN order_item oi USING (order_item_id)
   WHERE j.job_id = v_job_id;

  INSERT INTO cost_entry (cost_type, amount, period_id, order_id, machine_id, movement_id, reverses_cost_id)
  VALUES ('material',
          round(-NEW.quantity * NEW.unit_cost, 2),
          period_for((NEW.occurred_at AT TIME ZONE 'Asia/Kolkata')::date),
          v_order, v_machine, NEW.movement_id, v_rev_cost);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_movement_cost ON yarn_stock_movement;
CREATE TRIGGER trg_movement_cost AFTER INSERT ON yarn_stock_movement
  FOR EACH ROW EXECUTE FUNCTION trg_movement_cost();

-- Reservation cache synchronization
CREATE OR REPLACE FUNCTION trg_reservation_apply() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_item bigint;
BEGIN
  SELECT yarn_item_id INTO v_item FROM order_material_requirement WHERE requirement_id = NEW.requirement_id;
  IF TG_OP = 'INSERT' THEN
    UPDATE yarn_stock_balance SET reserved_qty = reserved_qty + NEW.reserved_qty, refreshed_at = now()
     WHERE yarn_item_id = v_item;
  ELSIF OLD.status = 'active' AND NEW.status IN ('consumed', 'released') THEN
    UPDATE yarn_stock_balance SET reserved_qty = reserved_qty - OLD.reserved_qty, refreshed_at = now()
     WHERE yarn_item_id = v_item;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_reservation_apply_ins ON yarn_reservation;
CREATE TRIGGER trg_reservation_apply_ins AFTER INSERT ON yarn_reservation
  FOR EACH ROW EXECUTE FUNCTION trg_reservation_apply();

DROP TRIGGER IF EXISTS trg_reservation_apply_upd ON yarn_reservation;
CREATE TRIGGER trg_reservation_apply_upd AFTER UPDATE OF status ON yarn_reservation
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_reservation_apply();

CREATE OR REPLACE FUNCTION trg_bill_line_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_billed qty_t; v_received qty_t;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supplier_bill WHERE bill_id = NEW.bill_id AND status = 'recorded' AND created_at = now()) THEN
    RAISE EXCEPTION 'Bill lines can only be added while the bill is being created' USING ERRCODE = 'BR003';
  END IF;
  SELECT quantity_received INTO v_received FROM goods_receipt_item WHERE receipt_item_id = NEW.receipt_item_id FOR UPDATE;
  SELECT COALESCE(SUM(l.quantity), 0) INTO v_billed
    FROM supplier_bill_line l JOIN supplier_bill b USING (bill_id)
   WHERE l.receipt_item_id = NEW.receipt_item_id AND b.status = 'recorded';
  IF v_billed + NEW.quantity > v_received THEN
    RAISE EXCEPTION 'Billed quantity would exceed the quantity received for this lot' USING ERRCODE = 'BR011';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bill_line_before ON supplier_bill_line;
CREATE TRIGGER trg_bill_line_before BEFORE INSERT ON supplier_bill_line
  FOR EACH ROW EXECUTE FUNCTION trg_bill_line_before();

CREATE OR REPLACE FUNCTION trg_bill_total() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE supplier_bill SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM supplier_bill_line WHERE bill_id = NEW.bill_id)
   WHERE bill_id = NEW.bill_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_bill_total ON supplier_bill_line;
CREATE TRIGGER trg_bill_total AFTER INSERT ON supplier_bill_line
  FOR EACH ROW EXECUTE FUNCTION trg_bill_total();

-- ----------------------------------------------------------------------------
-- 4. Production Floor (INV-3, INV-4)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_job_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_order_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT o.status INTO v_order_status
      FROM order_item oi JOIN customer_order o USING (order_id) WHERE oi.order_item_id = NEW.order_item_id;
    IF v_order_status IS DISTINCT FROM 'confirmed' THEN
      RAISE EXCEPTION 'Jobs can only be created for confirmed orders' USING ERRCODE = 'BR010';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status <> 'planned'
     AND (NEW.order_item_id, NEW.stage_id, NEW.machine_id) IS DISTINCT FROM (OLD.order_item_id, OLD.stage_id, OLD.machine_id) THEN
    RAISE EXCEPTION 'Machine / order item of a started job cannot change; create a new job for the remaining quantity'
      USING ERRCODE = 'BR003';
  END IF;

  IF NEW.status = 'running' AND OLD.status <> 'running' THEN
    IF NOT (SELECT is_active FROM machine WHERE machine_id = NEW.machine_id) THEN
      RAISE EXCEPTION 'Machine is deactivated' USING ERRCODE = 'BR010';
    END IF;
    IF EXISTS (SELECT 1 FROM machine_status_event
                WHERE machine_id = NEW.machine_id AND ended_at IS NULL AND state IN ('breakdown', 'maintenance')) THEN
      RAISE EXCEPTION 'Machine is under breakdown/maintenance; close that event first' USING ERRCODE = 'BR010';
    END IF;
    IF (SELECT o.status FROM order_item oi JOIN customer_order o USING (order_id)
         WHERE oi.order_item_id = NEW.order_item_id) <> 'confirmed' THEN
      RAISE EXCEPTION 'The order is no longer confirmed' USING ERRCODE = 'BR010';
    END IF;
    NEW.started_at := COALESCE(NEW.started_at, now());
  END IF;
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    NEW.ended_at := COALESCE(NEW.ended_at, now());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_job_before ON production_job;
CREATE TRIGGER trg_job_before BEFORE INSERT OR UPDATE ON production_job
  FOR EACH ROW EXECUTE FUNCTION trg_job_before();

CREATE OR REPLACE FUNCTION trg_job_machine_events() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_open machine_status_event%ROWTYPE; v_found boolean;
BEGIN
  SELECT * INTO v_open FROM machine_status_event WHERE machine_id = NEW.machine_id AND ended_at IS NULL FOR UPDATE;
  v_found := FOUND;
  IF NEW.status = 'running' THEN
    IF v_found AND v_open.state = 'idle' THEN
      UPDATE machine_status_event SET ended_at = now() WHERE event_id = v_open.event_id;
      v_found := false;
    END IF;
    IF NOT v_found THEN
      INSERT INTO machine_status_event (machine_id, state) VALUES (NEW.machine_id, 'running');
    END IF;
  ELSIF OLD.status = 'running' THEN
    IF v_found AND v_open.state = 'running' THEN
      UPDATE machine_status_event SET ended_at = now() WHERE event_id = v_open.event_id;
      INSERT INTO machine_status_event (machine_id, state) VALUES (NEW.machine_id, 'idle');
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_job_machine_events ON production_job;
CREATE TRIGGER trg_job_machine_events AFTER UPDATE OF status ON production_job
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_job_machine_events();

CREATE OR REPLACE FUNCTION trg_mse_close_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ended_at IS NOT NULL
     OR (to_jsonb(NEW) - 'ended_at') IS DISTINCT FROM (to_jsonb(OLD) - 'ended_at') THEN
    RAISE EXCEPTION 'A machine status event can only be closed once (ended_at)' USING ERRCODE = 'BR001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mse_close_only ON machine_status_event;
CREATE TRIGGER trg_mse_close_only BEFORE UPDATE ON machine_status_event
  FOR EACH ROW EXECUTE FUNCTION trg_mse_close_only();

CREATE OR REPLACE FUNCTION trg_log_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text; v_orig production_log%ROWTYPE;
BEGIN
  SELECT status INTO v_status FROM production_job WHERE job_id = NEW.job_id FOR SHARE;
  IF NEW.output_qty > 0 THEN
    IF v_status <> 'running' THEN
      RAISE EXCEPTION 'Output can only be logged against a running job (job is %)', v_status USING ERRCODE = 'BR010';
    END IF;
  ELSE
    SELECT * INTO v_orig FROM production_log WHERE log_id = NEW.reverses_log_id;
    IF NOT FOUND OR v_orig.job_id <> NEW.job_id OR v_orig.output_qty <= 0 OR NEW.output_qty <> -v_orig.output_qty THEN
      RAISE EXCEPTION 'A correction must fully offset one earlier positive output entry of the same job' USING ERRCODE = 'BR010';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_before ON production_log;
CREATE TRIGGER trg_log_before BEFORE INSERT ON production_log
  FOR EACH ROW EXECUTE FUNCTION trg_log_before();

-- ----------------------------------------------------------------------------
-- 5. Fabric Rolls & Quality Control (INV-5, INV-8, BR-4, BR-5)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_roll_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_job_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_job_status FROM production_job WHERE job_id = NEW.job_id FOR SHARE;
    IF v_job_status IN ('planned', 'cancelled') THEN
      RAISE EXCEPTION 'Rolls cannot be created for a % job', v_job_status USING ERRCODE = 'BR010';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.roll_code <> OLD.roll_code OR NEW.job_id <> OLD.job_id
     OR NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
    RAISE EXCEPTION 'roll_code, job and operator of a roll are immutable' USING ERRCODE = 'BR003';
  END IF;
  IF OLD.status NOT IN ('pending_qc', 'rework')
     AND (NEW.length_m <> OLD.length_m OR NEW.weight_kg IS DISTINCT FROM OLD.weight_kg) THEN
    RAISE EXCEPTION 'Length / weight can no longer be changed (roll is %)', OLD.status USING ERRCODE = 'BR003';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_roll_guard ON fabric_roll;
CREATE TRIGGER trg_roll_guard BEFORE INSERT OR UPDATE ON fabric_roll
  FOR EACH ROW EXECUTE FUNCTION trg_roll_guard();

-- INV-8: Inspection and roll status update are one atomic fact
CREATE OR REPLACE FUNCTION trg_qc_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text; v_attempt int;
BEGIN
  SELECT status INTO v_status FROM fabric_roll WHERE roll_id = NEW.roll_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'pending_qc' THEN
    RAISE EXCEPTION 'Roll is not awaiting inspection (status %)', v_status USING ERRCODE = 'BR009';
  END IF;
  SELECT COALESCE(MAX(attempt_no), 0) + 1 INTO v_attempt FROM qc_inspection WHERE roll_id = NEW.roll_id;
  NEW.attempt_no := v_attempt;
  UPDATE fabric_roll
     SET status = CASE NEW.result WHEN 'passed' THEN 'in_stock' WHEN 'rework' THEN 'rework' ELSE 'rejected' END
   WHERE roll_id = NEW.roll_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qc_before ON qc_inspection;
CREATE TRIGGER trg_qc_before BEFORE INSERT ON qc_inspection
  FOR EACH ROW EXECUTE FUNCTION trg_qc_before();

CREATE OR REPLACE FUNCTION trg_qc_requires_defect() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.result IN ('rework', 'rejected')
     AND NOT EXISTS (SELECT 1 FROM qc_defect WHERE inspection_id = NEW.inspection_id) THEN
    RAISE EXCEPTION 'A % result must record at least one defect', NEW.result USING ERRCODE = 'BR009';
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_qc_requires_defect ON qc_inspection;
CREATE CONSTRAINT TRIGGER trg_qc_requires_defect AFTER INSERT ON qc_inspection
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION trg_qc_requires_defect();

CREATE OR REPLACE FUNCTION trg_qc_defect_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM qc_inspection WHERE inspection_id = NEW.inspection_id AND created_at = now()) THEN
    RAISE EXCEPTION 'Defects can only be added while the inspection is being recorded' USING ERRCODE = 'BR009';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qc_defect_before ON qc_defect;
CREATE TRIGGER trg_qc_defect_before BEFORE INSERT ON qc_defect
  FOR EACH ROW EXECUTE FUNCTION trg_qc_defect_before();

-- ----------------------------------------------------------------------------
-- 6. Dispatch & Loading (INV-2, INV-5, BR-6, BR-7, BR-8)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_dispatch_item_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d dispatch%ROWTYPE; r fabric_roll%ROWTYPE; v_roll_order bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO d FROM dispatch WHERE dispatch_id = NEW.dispatch_id FOR UPDATE;
    IF d.status NOT IN ('draft', 'loading') THEN
      RAISE EXCEPTION 'Dispatch % is %, rolls can no longer be added', d.dispatch_no, d.status USING ERRCODE = 'BR007';
    END IF;
    SELECT * INTO r FROM fabric_roll WHERE roll_id = NEW.roll_id FOR UPDATE;
    IF r.status <> 'in_stock' THEN
      RAISE EXCEPTION 'Roll % cannot be dispatched (status %)', r.roll_code, r.status USING ERRCODE = 'BR005';
    END IF;
    SELECT oi.order_id INTO v_roll_order
      FROM production_job j JOIN order_item oi USING (order_item_id) WHERE j.job_id = r.job_id;
    IF v_roll_order <> d.order_id THEN
      RAISE EXCEPTION 'Roll % belongs to a different order than dispatch %', r.roll_code, d.dispatch_no USING ERRCODE = 'BR007';
    END IF;
    NEW.state := 'active';
    NEW.scanned_at := now();
    NEW.scanned_by := app_current_user_id();
    UPDATE fabric_roll SET status = 'loaded' WHERE roll_id = NEW.roll_id;
    IF d.status = 'draft' THEN
      UPDATE dispatch SET status = 'loading' WHERE dispatch_id = d.dispatch_id;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.state <> 'active' OR NEW.state <> 'removed'
     OR (to_jsonb(NEW) - ARRAY['state', 'removed_at', 'removed_by', 'remove_reason'])
        IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['state', 'removed_at', 'removed_by', 'remove_reason']) THEN
    RAISE EXCEPTION 'A dispatch line can only be changed from active to removed' USING ERRCODE = 'BR007';
  END IF;
  IF (SELECT status FROM dispatch WHERE dispatch_id = NEW.dispatch_id) NOT IN ('draft', 'loading', 'cancelled') THEN
    RAISE EXCEPTION 'Rolls cannot be removed from a dispatched load' USING ERRCODE = 'BR007';
  END IF;
  NEW.removed_at := COALESCE(NEW.removed_at, now());
  NEW.removed_by := COALESCE(NEW.removed_by, app_current_user_id());
  UPDATE fabric_roll SET status = 'in_stock' WHERE roll_id = NEW.roll_id AND status = 'loaded';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dispatch_item_ins ON dispatch_item;
CREATE TRIGGER trg_dispatch_item_ins BEFORE INSERT ON dispatch_item
  FOR EACH ROW EXECUTE FUNCTION trg_dispatch_item_before();

DROP TRIGGER IF EXISTS trg_dispatch_item_upd ON dispatch_item;
CREATE TRIGGER trg_dispatch_item_upd BEFORE UPDATE ON dispatch_item
  FOR EACH ROW EXECUTE FUNCTION trg_dispatch_item_before();

CREATE OR REPLACE FUNCTION trg_dispatch_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.buyer_id, NEW.order_id) IS DISTINCT FROM (OLD.buyer_id, OLD.order_id) THEN
      RAISE EXCEPTION 'Buyer and order of a dispatch cannot change' USING ERRCODE = 'BR003';
    END IF;
    IF NEW.invoice_id IS NOT NULL AND (SELECT status FROM invoice WHERE invoice_id = NEW.invoice_id) = 'void' THEN
      RAISE EXCEPTION 'A dispatch cannot be linked to a void invoice' USING ERRCODE = 'BR007';
    END IF;
    IF NEW.status = 'dispatched' AND OLD.status = 'loading' THEN
      IF NOT EXISTS (SELECT 1 FROM dispatch_item WHERE dispatch_id = NEW.dispatch_id AND state = 'active') THEN
        RAISE EXCEPTION 'An empty dispatch cannot be sent' USING ERRCODE = 'BR007';
      END IF;
      NEW.dispatched_at := COALESCE(NEW.dispatched_at, now());
    ELSIF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
      NEW.cancelled_at := now();
      NEW.cancelled_by := app_current_user_id();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dispatch_before ON dispatch;
CREATE TRIGGER trg_dispatch_before BEFORE INSERT OR UPDATE ON dispatch
  FOR EACH ROW EXECUTE FUNCTION trg_dispatch_before();

CREATE OR REPLACE FUNCTION trg_dispatch_after() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'dispatched' THEN
    UPDATE fabric_roll SET status = 'dispatched'
     WHERE roll_id IN (SELECT roll_id FROM dispatch_item WHERE dispatch_id = NEW.dispatch_id AND state = 'active');
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE dispatch_item SET state = 'removed', remove_reason = 'Dispatch cancelled: ' || NEW.cancel_reason
     WHERE dispatch_id = NEW.dispatch_id AND state = 'active';
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_dispatch_after ON dispatch;
CREATE TRIGGER trg_dispatch_after AFTER UPDATE OF status ON dispatch
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('dispatched', 'cancelled'))
  EXECUTE FUNCTION trg_dispatch_after();

-- ----------------------------------------------------------------------------
-- 7. Invoices, Payments & Allocations (INV-6)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_invoice_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'draft'
       AND (NEW.buyer_id, NEW.invoice_date, NEW.invoice_no) IS DISTINCT FROM (OLD.buyer_id, OLD.invoice_date, OLD.invoice_no) THEN
      RAISE EXCEPTION 'An issued invoice cannot be edited; void it instead' USING ERRCODE = 'BR003';
    END IF;
    IF NEW.status = 'issued' AND OLD.status = 'draft' THEN
      IF NOT EXISTS (SELECT 1 FROM invoice_item WHERE invoice_id = NEW.invoice_id) THEN
        RAISE EXCEPTION 'An invoice needs at least one line' USING ERRCODE = 'BR008';
      END IF;
      PERFORM period_for(NEW.invoice_date);
      NEW.invoice_no := next_doc_no('INV', NEW.invoice_date);
      NEW.issued_at  := now();
    ELSIF NEW.status = 'void' AND OLD.status <> 'void' THEN
      IF EXISTS (SELECT 1 FROM dispatch WHERE invoice_id = NEW.invoice_id AND status <> 'cancelled') THEN
        RAISE EXCEPTION 'Un-link or re-invoice the dispatches before voiding this invoice' USING ERRCODE = 'BR008';
      END IF;
      IF EXISTS (SELECT 1 FROM payment_allocation a JOIN buyer_payment p USING (payment_id)
                  WHERE a.invoice_id = NEW.invoice_id AND p.status = 'recorded') THEN
        RAISE EXCEPTION 'Reverse the payments allocated to this invoice before voiding it' USING ERRCODE = 'BR008';
      END IF;
      IF OLD.status = 'issued' THEN PERFORM period_for(OLD.invoice_date); END IF;
      NEW.voided_at := now();
      NEW.voided_by := app_current_user_id();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_before ON invoice;
CREATE TRIGGER trg_invoice_before BEFORE INSERT OR UPDATE ON invoice
  FOR EACH ROW EXECUTE FUNCTION trg_invoice_before();

CREATE OR REPLACE FUNCTION trg_invoice_item_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT oo.buyer_id FROM order_item oi JOIN customer_order oo USING (order_id) WHERE oi.order_item_id = NEW.order_item_id)
     <> (SELECT buyer_id FROM invoice WHERE invoice_id = NEW.invoice_id) THEN
    RAISE EXCEPTION 'Invoice line belongs to an order of a different buyer' USING ERRCODE = 'BR008';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_item_before ON invoice_item;
CREATE TRIGGER trg_invoice_item_before BEFORE INSERT OR UPDATE OF order_item_id, invoice_id ON invoice_item
  FOR EACH ROW EXECUTE FUNCTION trg_invoice_item_before();

CREATE OR REPLACE FUNCTION trg_invoice_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
  UPDATE invoice SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM invoice_item WHERE invoice_id = v_id)
   WHERE invoice_id = v_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_total ON invoice_item;
CREATE TRIGGER trg_invoice_total AFTER INSERT OR UPDATE OR DELETE ON invoice_item
  FOR EACH ROW EXECUTE FUNCTION trg_invoice_total();

-- INV-6: Allocations cannot exceed payment or invoice. Strict lock order: Payment then Invoice.
CREATE OR REPLACE FUNCTION trg_alloc_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p buyer_payment%ROWTYPE; i invoice%ROWTYPE; v_pay_sum money_t; v_inv_sum money_t;
BEGIN
  SELECT * INTO p FROM buyer_payment WHERE payment_id = NEW.payment_id FOR UPDATE;
  SELECT * INTO i FROM invoice       WHERE invoice_id = NEW.invoice_id FOR UPDATE;
  IF p.status <> 'recorded' THEN RAISE EXCEPTION 'Payment is reversed' USING ERRCODE = 'BR006'; END IF;
  IF i.status <> 'issued'   THEN RAISE EXCEPTION 'Only issued invoices can be paid (invoice is %)', i.status USING ERRCODE = 'BR006'; END IF;
  IF p.buyer_id <> i.buyer_id THEN RAISE EXCEPTION 'Payment and invoice belong to different buyers' USING ERRCODE = 'BR006'; END IF;

  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_pay_sum FROM payment_allocation WHERE payment_id = NEW.payment_id;
  IF v_pay_sum + NEW.allocated_amount > p.amount THEN
    RAISE EXCEPTION 'Allocations would exceed the payment amount' USING ERRCODE = 'BR006';
  END IF;
  SELECT COALESCE(SUM(a.allocated_amount), 0) INTO v_inv_sum
    FROM payment_allocation a JOIN buyer_payment bp USING (payment_id)
   WHERE a.invoice_id = NEW.invoice_id AND bp.status = 'recorded';
  IF v_inv_sum + NEW.allocated_amount > i.total_amount THEN
    RAISE EXCEPTION 'Allocations would exceed the invoice total' USING ERRCODE = 'BR006';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_alloc_before ON payment_allocation;
CREATE TRIGGER trg_alloc_before BEFORE INSERT ON payment_allocation
  FOR EACH ROW EXECUTE FUNCTION trg_alloc_before();

CREATE OR REPLACE FUNCTION trg_payment_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'reversed' AND OLD.status = 'recorded' THEN
    NEW.reversed_at := now();
    NEW.reversed_by := app_current_user_id();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payment_before ON buyer_payment;
CREATE TRIGGER trg_payment_before BEFORE UPDATE ON buyer_payment
  FOR EACH ROW EXECUTE FUNCTION trg_payment_before();

-- ----------------------------------------------------------------------------
-- 8. Wages & Workforce (FR-6.2, INV-7, INV-11)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_attendance_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM wage_record w JOIN accounting_period p USING (period_id)
              WHERE w.employee_id = NEW.employee_id AND w.status = 'approved'
                AND NEW.work_date BETWEEN p.period_start AND p.period_end) THEN
    RAISE EXCEPTION 'Wages for this employee and month are already approved; reverse them before changing attendance'
      USING ERRCODE = 'BR004';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_attendance_guard ON attendance_record;
CREATE TRIGGER trg_attendance_guard BEFORE INSERT OR UPDATE ON attendance_record
  FOR EACH ROW EXECUTE FUNCTION trg_attendance_guard();

CREATE OR REPLACE FUNCTION trg_wage_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT status FROM accounting_period WHERE period_id = NEW.period_id) <> 'open' THEN
      RAISE EXCEPTION 'Cannot create wages in a closed period' USING ERRCODE = 'BR004';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'draft'
     AND (NEW.employee_id, NEW.period_id, NEW.gross_amount, NEW.basis_note)
         IS DISTINCT FROM (OLD.employee_id, OLD.period_id, OLD.gross_amount, OLD.basis_note) THEN
    RAISE EXCEPTION 'Approved wages cannot be edited; reverse and re-create' USING ERRCODE = 'BR003';
  END IF;
  IF NEW.status = 'approved' AND OLD.status = 'draft' THEN
    IF (SELECT status FROM accounting_period WHERE period_id = NEW.period_id) <> 'open' THEN
      RAISE EXCEPTION 'Cannot approve wages in a closed period' USING ERRCODE = 'BR004';
    END IF;
    NEW.approved_at := now();
    NEW.approved_by := app_current_user_id();
  ELSIF NEW.status = 'reversed' AND OLD.status = 'approved' THEN
    NEW.reversed_at := now();
    NEW.reversed_by := app_current_user_id();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wage_before ON wage_record;
CREATE TRIGGER trg_wage_before BEFORE INSERT OR UPDATE ON wage_record
  FOR EACH ROW EXECUTE FUNCTION trg_wage_before();

CREATE OR REPLACE FUNCTION trg_wage_cost() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_orig bigint;
BEGIN
  IF NEW.status = 'approved' THEN
    INSERT INTO cost_entry (cost_type, amount, period_id, wage_id)
    VALUES ('wage', NEW.gross_amount, NEW.period_id, NEW.wage_id);
  ELSIF NEW.status = 'reversed' THEN
    SELECT cost_id INTO v_orig FROM cost_entry WHERE wage_id = NEW.wage_id AND reverses_cost_id IS NULL;
    INSERT INTO cost_entry (cost_type, amount, period_id, wage_id, reverses_cost_id)
    VALUES ('wage', -NEW.gross_amount, period_for((now() AT TIME ZONE 'Asia/Kolkata')::date), NEW.wage_id, v_orig);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_wage_cost ON wage_record;
CREATE TRIGGER trg_wage_cost AFTER UPDATE OF status ON wage_record
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_wage_cost();

-- ----------------------------------------------------------------------------
-- 9. Generic Trigger Loop Attachments
-- ----------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  -- updated_at / updated_by touch triggers
  FOREACH t IN ARRAY ARRAY['app_user','employee','supplier','buyer','yarn_type','colour','yarn_item','fabric_product',
                           'process_stage','machine','shift','defect_type','order_item','purchase_order_item',
                           'goods_receipt','supplier_bill','yarn_reservation','stock_alert','invoice_item',
                           'accounting_period','attendance_record','wage_record'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trg_touch()', t);
  END LOOP;

  -- Optimistic-concurrency version counter triggers
  FOREACH t IN ARRAY ARRAY['customer_order','purchase_order','production_job','fabric_roll','dispatch','invoice'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trg_touch_versioned()', t);
  END LOOP;

  -- Table-driven state machine transition triggers
  FOREACH t IN ARRAY ARRAY['customer_order','production_job','fabric_roll','dispatch','goods_receipt','purchase_order',
                           'yarn_reservation','stock_alert','invoice','buyer_payment','wage_record','accounting_period',
                           'supplier_bill'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_transition ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_transition BEFORE INSERT OR UPDATE OF status ON %1$I
                    FOR EACH ROW EXECUTE FUNCTION trg_enforce_transition(%1$L)', t);
  END LOOP;

  -- Append-only ledgers: block UPDATE, DELETE, TRUNCATE
  FOREACH t IN ARRAY ARRAY['yarn_stock_movement','production_log','qc_inspection','qc_defect','payment_allocation',
                           'cost_entry','order_status_history','audit_log','goods_receipt_item','supplier_bill_line'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_append_only ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION trg_block_mutation()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_no_truncate ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_no_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION trg_block_mutation()', t);
  END LOOP;

  -- Block physical DELETE on all transactional and master tables
  FOREACH t IN ARRAY ARRAY['app_user','employee','supplier','buyer','unit_of_measure','yarn_type','colour','yarn_item',
                           'fabric_product','process_stage','machine','shift','defect_type','customer_order',
                           'purchase_order','goods_receipt','supplier_bill','yarn_stock_balance','stock_alert',
                           'yarn_reservation','production_job','machine_status_event','fabric_roll','invoice',
                           'dispatch','dispatch_item','buyer_payment','accounting_period','attendance_record',
                           'wage_record'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_no_delete ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION trg_block_delete()', t);
  END LOOP;
END $$;

-- Immutable-after-posting column updates
DROP TRIGGER IF EXISTS trg_immutable ON goods_receipt;
CREATE TRIGGER trg_immutable BEFORE UPDATE ON goods_receipt FOR EACH ROW EXECUTE FUNCTION trg_only_columns_may_change(
  'status','cancelled_at','cancelled_by','cancel_reason','updated_at','updated_by');

DROP TRIGGER IF EXISTS trg_immutable ON supplier_bill;
CREATE TRIGGER trg_immutable BEFORE UPDATE ON supplier_bill FOR EACH ROW EXECUTE FUNCTION trg_only_columns_may_change(
  'status','voided_at','voided_by','void_reason','total_amount','updated_at','updated_by');

DROP TRIGGER IF EXISTS trg_immutable ON buyer_payment;
CREATE TRIGGER trg_immutable BEFORE UPDATE ON buyer_payment FOR EACH ROW EXECUTE FUNCTION trg_only_columns_may_change(
  'status','reversed_at','reversed_by','reverse_reason');

-- Draft-only child rows
DROP TRIGGER IF EXISTS trg_draft_only ON order_item;
CREATE TRIGGER trg_draft_only BEFORE INSERT OR DELETE ON order_item
  FOR EACH ROW EXECUTE FUNCTION trg_parent_must_be_draft('customer_order', 'order_id', 'order_id');

DROP TRIGGER IF EXISTS trg_draft_only ON purchase_order_item;
CREATE TRIGGER trg_draft_only BEFORE INSERT OR UPDATE OR DELETE ON purchase_order_item
  FOR EACH ROW EXECUTE FUNCTION trg_parent_must_be_draft('purchase_order', 'po_id', 'po_id');

DROP TRIGGER IF EXISTS trg_draft_only ON invoice_item;
CREATE TRIGGER trg_draft_only BEFORE INSERT OR UPDATE OR DELETE ON invoice_item
  FOR EACH ROW EXECUTE FUNCTION trg_parent_must_be_draft('invoice', 'invoice_id', 'invoice_id');

CREATE OR REPLACE FUNCTION trg_order_item_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.product_id, NEW.colour_id, NEW.unit_id, NEW.order_id, NEW.line_no)
       IS DISTINCT FROM (OLD.product_id, OLD.colour_id, OLD.unit_id, OLD.order_id, OLD.line_no)
     AND (SELECT status FROM customer_order WHERE order_id = OLD.order_id) <> 'draft' THEN
    RAISE EXCEPTION 'Product, colour and unit of a confirmed order line cannot change' USING ERRCODE = 'BR003';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_item_update ON order_item;
CREATE TRIGGER trg_order_item_update BEFORE UPDATE ON order_item
  FOR EACH ROW EXECUTE FUNCTION trg_order_item_update();
