'use strict';

const { getPool } = require('../../config/database');

const ProductionJobsRepository = {
  async findAll({ limit = 20, offset = 0, search, stage_id, machine_id, status } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        pj.job_id,
        pj.job_no,
        pj.order_item_id,
        oi.order_id,
        co.order_no,
        b.name AS buyer_name,
        fp.name AS product_name,
        oi.colour_code,
        pj.stage_id,
        ps.name AS stage_name,
        pj.machine_id,
        m.machine_code,
        pj.planned_qty,
        pj.status,
        pj.priority,
        pj.started_at,
        pj.ended_at,
        pj.version,
        pj.created_at,
        COALESCE((
          SELECT SUM(output_qty) FROM production_log WHERE job_id = pj.job_id
        ), 0) AS total_output_produced
      FROM production_job pj
      JOIN order_item oi ON pj.order_item_id = oi.order_item_id
      JOIN customer_order co ON oi.order_id = co.order_id
      JOIN buyer b ON co.buyer_id = b.buyer_id
      JOIN fabric_product fp ON oi.product_id = fp.product_id
      JOIN process_stage ps ON pj.stage_id = ps.stage_id
      JOIN machine m ON pj.machine_id = m.machine_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (pj.job_no LIKE ? OR co.order_no LIKE ? OR m.machine_code LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (stage_id) {
      sql += ` AND pj.stage_id = ?`;
      params.push(stage_id);
    }
    if (machine_id) {
      sql += ` AND pj.machine_id = ?`;
      params.push(machine_id);
    }
    if (status) {
      sql += ` AND pj.status = ?`;
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY pj.job_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(jobId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        pj.job_id,
        pj.job_no,
        pj.order_item_id,
        oi.order_id,
        co.order_no,
        b.name AS buyer_name,
        b.buyer_code,
        fp.product_code,
        fp.name AS product_name,
        oi.colour_code,
        oi.ordered_qty,
        pj.stage_id,
        ps.name AS stage_name,
        pj.machine_id,
        m.machine_code,
        m.make_model AS machine_make_model,
        pj.planned_qty,
        pj.status,
        pj.priority,
        pj.started_at,
        pj.ended_at,
        pj.version,
        pj.created_at
      FROM production_job pj
      JOIN order_item oi ON pj.order_item_id = oi.order_item_id
      JOIN customer_order co ON oi.order_id = co.order_id
      JOIN buyer b ON co.buyer_id = b.buyer_id
      JOIN fabric_product fp ON oi.product_id = fp.product_id
      JOIN process_stage ps ON pj.stage_id = ps.stage_id
      JOIN machine m ON pj.machine_id = m.machine_id
      WHERE pj.job_id = ?`,
      [jobId]
    );
    if (!rows[0]) return null;

    const [logs] = await pool.query(
      `SELECT 
        pl.log_id,
        pl.shift_code,
        pl.operator_id,
        emp.full_name AS operator_name,
        pl.output_qty,
        pl.scrap_qty,
        pl.power_kwh,
        pl.logged_at,
        pl.client_request_id
      FROM production_log pl
      JOIN employee emp ON pl.operator_id = emp.employee_id
      WHERE pl.job_id = ?
      ORDER BY pl.logged_at ASC`,
      [jobId]
    );

    const [rolls] = await pool.query(
      `SELECT 
        fr.roll_id,
        fr.roll_code,
        fr.length_m,
        fr.weight_kg,
        fr.gsm,
        fr.width_inches,
        fr.status,
        fr.shelf_location,
        fr.created_at
      FROM fabric_roll fr
      WHERE fr.job_id = ?
      ORDER BY fr.roll_id ASC`,
      [jobId]
    );

    return {
      ...rows[0],
      logs,
      rolls,
    };
  },

  async findByJobNo(jobNo) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT job_id FROM production_job WHERE job_no = ?`,
      [jobNo]
    );
    return rows[0] || null;
  },

  async create(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO production_job 
        (job_no, order_item_id, stage_id, machine_id, planned_qty, status, priority, version)
       VALUES (?, ?, ?, ?, ?, 'planned', ?, 1)`,
      [
        data.job_no,
        data.order_item_id,
        data.stage_id,
        data.machine_id,
        data.planned_qty,
        data.priority || 'Medium',
      ]
    );
    return result.insertId;
  },

  async updateStatusWithVersion(jobId, { status, started_at, ended_at, expectedVersion }, conn) {
    const db = conn || getPool();
    let sql = `UPDATE production_job SET status = ?, version = version + 1`;
    const params = [status];

    if (started_at !== undefined) {
      sql += `, started_at = ?`;
      params.push(started_at);
    }
    if (ended_at !== undefined) {
      sql += `, ended_at = ?`;
      params.push(ended_at);
    }

    sql += ` WHERE job_id = ? AND version = ?`;
    params.push(jobId, expectedVersion);

    const [result] = await db.query(sql, params);
    return result.affectedRows > 0;
  },
};

module.exports = ProductionJobsRepository;
