'use strict';

const { getPool } = require('../../config/database');

const ProductionLogsRepository = {
  async findAll({ limit = 20, offset = 0, job_id, operator_id, shift_code } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        pl.log_id,
        pl.job_id,
        pj.job_no,
        pl.shift_code,
        pl.operator_id,
        emp.full_name AS operator_name,
        pl.output_qty,
        pl.scrap_qty,
        pl.power_kwh,
        pl.logged_at,
        pl.client_request_id
      FROM production_log pl
      JOIN production_job pj ON pl.job_id = pj.job_id
      JOIN employee emp ON pl.operator_id = emp.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (job_id) {
      sql += ` AND pl.job_id = ?`;
      params.push(job_id);
    }
    if (operator_id) {
      sql += ` AND pl.operator_id = ?`;
      params.push(operator_id);
    }
    if (shift_code) {
      sql += ` AND pl.shift_code = ?`;
      params.push(shift_code);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY pl.logged_at DESC, pl.log_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(logId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        pl.log_id,
        pl.job_id,
        pj.job_no,
        pl.shift_code,
        pl.operator_id,
        emp.full_name AS operator_name,
        pl.output_qty,
        pl.scrap_qty,
        pl.power_kwh,
        pl.logged_at,
        pl.client_request_id
      FROM production_log pl
      JOIN production_job pj ON pl.job_id = pj.job_id
      JOIN employee emp ON pl.operator_id = emp.employee_id
      WHERE pl.log_id = ?`,
      [logId]
    );
    return rows[0] || null;
  },

  async findByClientRequestId(clientRequestId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT log_id FROM production_log WHERE client_request_id = ?`,
      [clientRequestId]
    );
    return rows[0] || null;
  },

  async create(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO production_log 
        (job_id, shift_code, operator_id, output_qty, scrap_qty, power_kwh, logged_at, client_request_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.job_id,
        data.shift_code,
        data.operator_id,
        data.output_qty || 0.00,
        data.scrap_qty || 0.00,
        data.power_kwh || 0.00,
        data.logged_at || new Date(),
        data.client_request_id,
      ]
    );
    return result.insertId;
  },
};

module.exports = ProductionLogsRepository;
