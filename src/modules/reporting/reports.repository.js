'use strict';

const { getPool } = require('../../config/database');

const ReportsRepository = {
  async getInventorySummary() {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        yi.yarn_item_id,
        yt.name AS yarn_type_name,
        yi.colour_code,
        yi.colour_name,
        uom.unit_code,
        yi.reorder_level,
        COALESCE(SUM(CASE WHEN ysm.quantity > 0 THEN ysm.quantity ELSE 0 END), 0) AS total_inward_qty,
        COALESCE(SUM(CASE WHEN ysm.quantity < 0 THEN ABS(ysm.quantity) ELSE 0 END), 0) AS total_outward_qty,
        COALESCE(SUM(ysm.quantity), 0) AS current_stock_qty,
        (COALESCE(SUM(ysm.quantity), 0) < yi.reorder_level) AS is_low_stock
      FROM yarn_item yi
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      JOIN unit_of_measure uom ON yi.unit_id = uom.unit_id
      LEFT JOIN yarn_stock_movement ysm ON yi.yarn_item_id = ysm.yarn_item_id
      WHERE yi.is_active = 1
      GROUP BY yi.yarn_item_id
      ORDER BY yt.name ASC, yi.colour_code ASC`
    );
    return rows;
  },

  async getOrderProgress({ buyer_id, status } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        co.order_id,
        co.order_no,
        b.name AS buyer_name,
        co.order_date,
        co.promised_delivery_date,
        co.status AS order_status,
        COALESCE(SUM(oi.ordered_qty), 0) AS total_ordered_meters,
        COALESCE((
          SELECT SUM(pl.output_qty)
          FROM production_log pl
          JOIN production_job pj ON pl.job_id = pj.job_id
          JOIN order_item oi2 ON pj.order_item_id = oi2.order_item_id
          WHERE oi2.order_id = co.order_id
        ), 0) AS total_produced_meters,
        COALESCE((
          SELECT SUM(fr.length_m)
          FROM fabric_roll fr
          JOIN production_job pj ON fr.job_id = pj.job_id
          JOIN order_item oi2 ON pj.order_item_id = oi2.order_item_id
          WHERE oi2.order_id = co.order_id AND fr.status IN ('in_stock', 'loaded', 'dispatched')
        ), 0) AS total_passed_qc_meters,
        COALESCE((
          SELECT SUM(fr.length_m)
          FROM fabric_roll fr
          JOIN production_job pj ON fr.job_id = pj.job_id
          JOIN order_item oi2 ON pj.order_item_id = oi2.order_item_id
          WHERE oi2.order_id = co.order_id AND fr.status = 'dispatched'
        ), 0) AS total_dispatched_meters
      FROM customer_order co
      JOIN buyer b ON co.buyer_id = b.buyer_id
      LEFT JOIN order_item oi ON co.order_id = oi.order_id
      WHERE 1=1
    `;
    const params = [];

    if (buyer_id) {
      sql += ` AND co.buyer_id = ?`;
      params.push(buyer_id);
    }
    if (status) {
      sql += ` AND co.status = ?`;
      params.push(status);
    }

    sql += ` GROUP BY co.order_id ORDER BY co.order_id DESC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async getProductionOutputSummary({ from_date, to_date, machine_id } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        DATE(pl.logged_at) AS log_date,
        pl.shift_code,
        pj.machine_id,
        m.machine_code,
        COUNT(pl.log_id) AS total_logs,
        COALESCE(SUM(pl.output_qty), 0) AS total_output_meters,
        COALESCE(SUM(pl.scrap_qty), 0) AS total_scrap_kg,
        COALESCE(SUM(pl.power_kwh), 0) AS total_power_kwh
      FROM production_log pl
      JOIN production_job pj ON pl.job_id = pj.job_id
      JOIN machine m ON pj.machine_id = m.machine_id
      WHERE 1=1
    `;
    const params = [];

    if (from_date) {
      sql += ` AND pl.logged_at >= ?`;
      params.push(from_date);
    }
    if (to_date) {
      sql += ` AND pl.logged_at <= ?`;
      params.push(to_date);
    }
    if (machine_id) {
      sql += ` AND pj.machine_id = ?`;
      params.push(machine_id);
    }

    sql += ` GROUP BY DATE(pl.logged_at), pl.shift_code, pj.machine_id ORDER BY log_date DESC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async getRollQualitySummary() {
    const pool = getPool();
    const [gradeStats] = await pool.query(
      `SELECT 
        assigned_grade,
        COUNT(*) AS roll_count,
        COALESCE(AVG(total_penalty_points), 0) AS avg_penalty_points,
        COALESCE(AVG(points_per_100_sq_yd), 0) AS avg_points_per_100_sq_yd
      FROM qc_inspection
      GROUP BY assigned_grade
      ORDER BY roll_count DESC`
    );

    const [defectStats] = await pool.query(
      `SELECT 
        defect_code,
        defect_name,
        severity,
        COUNT(*) AS defect_count,
        SUM(penalty_points) AS total_penalty_points
      FROM qc_defect
      GROUP BY defect_code, defect_name, severity
      ORDER BY defect_count DESC
      LIMIT 10`
    );

    return {
      grades: gradeStats,
      top_defects: defectStats,
    };
  },

  async getInvoiceOutstandingSummary({ buyer_id } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        b.buyer_id,
        b.buyer_code,
        b.name AS buyer_name,
        b.credit_limit,
        b.payment_terms_days,
        COUNT(inv.invoice_id) AS total_invoices_count,
        COALESCE(SUM(inv.total_amount), 0) AS total_invoiced_amount,
        COALESCE((
          SELECT SUM(bp.amount)
          FROM buyer_payment bp
          JOIN invoice inv2 ON bp.invoice_id = inv2.invoice_id
          WHERE inv2.buyer_id = b.buyer_id AND bp.status = 'recorded'
        ), 0) AS total_paid_amount,
        (
          COALESCE(SUM(inv.total_amount), 0) - COALESCE((
            SELECT SUM(bp.amount)
            FROM buyer_payment bp
            JOIN invoice inv2 ON bp.invoice_id = inv2.invoice_id
            WHERE inv2.buyer_id = b.buyer_id AND bp.status = 'recorded'
          ), 0)
        ) AS net_outstanding_balance
      FROM buyer b
      LEFT JOIN invoice inv ON b.buyer_id = inv.buyer_id AND inv.status = 'issued'
      WHERE 1=1
    `;
    const params = [];

    if (buyer_id) {
      sql += ` AND b.buyer_id = ?`;
      params.push(buyer_id);
    }

    sql += ` GROUP BY b.buyer_id ORDER BY net_outstanding_balance DESC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async getCostByOrderSummary({ order_id } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        co.order_id,
        co.order_no,
        b.name AS buyer_name,
        ce.cost_type,
        COUNT(ce.cost_id) AS entry_count,
        SUM(ce.amount) AS total_cost_amount
      FROM cost_entry ce
      JOIN customer_order co ON ce.order_id = co.order_id
      JOIN buyer b ON co.buyer_id = b.buyer_id
      WHERE 1=1
    `;
    const params = [];

    if (order_id) {
      sql += ` AND ce.order_id = ?`;
      params.push(order_id);
    }

    sql += ` GROUP BY co.order_id, ce.cost_type ORDER BY co.order_id DESC, total_cost_amount DESC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async getCostByMachineSummary({ machine_id } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        m.machine_id,
        m.machine_code,
        ps.name AS stage_name,
        ce.cost_type,
        COUNT(ce.cost_id) AS entry_count,
        SUM(ce.amount) AS total_cost_amount
      FROM cost_entry ce
      JOIN machine m ON ce.machine_id = m.machine_id
      JOIN process_stage ps ON m.stage_id = ps.stage_id
      WHERE 1=1
    `;
    const params = [];

    if (machine_id) {
      sql += ` AND ce.machine_id = ?`;
      params.push(machine_id);
    }

    sql += ` GROUP BY m.machine_id, ce.cost_type ORDER BY m.machine_id ASC, total_cost_amount DESC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async getWageSummary({ payroll_month } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        wr.payroll_month,
        wr.status,
        COUNT(wr.wage_id) AS employee_count,
        SUM(wr.base_amount) AS total_base_amount,
        SUM(wr.piece_rate_amount) AS total_piece_rate_amount,
        SUM(wr.bonus_overtime) AS total_bonus_overtime,
        SUM(wr.gross_amount) AS total_gross_disbursed
      FROM wage_record wr
      WHERE 1=1
    `;
    const params = [];

    if (payroll_month) {
      sql += ` AND wr.payroll_month = ?`;
      params.push(payroll_month);
    }

    sql += ` GROUP BY wr.payroll_month, wr.status ORDER BY wr.payroll_month DESC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  },
};

module.exports = ReportsRepository;
