'use strict';

const { getPool } = require('../../config/database');

const WagesRepository = {
  async findAll({ limit = 20, offset = 0, employee_id, payroll_month, status } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        wr.wage_id,
        wr.employee_id,
        emp.employee_code,
        emp.full_name,
        emp.designation,
        wr.payroll_month,
        wr.base_amount,
        wr.piece_rate_amount,
        wr.bonus_overtime,
        wr.gross_amount,
        wr.status,
        wr.created_at
      FROM wage_record wr
      JOIN employee emp ON wr.employee_id = emp.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (employee_id) {
      sql += ` AND wr.employee_id = ?`;
      params.push(employee_id);
    }
    if (payroll_month) {
      sql += ` AND wr.payroll_month = ?`;
      params.push(payroll_month);
    }
    if (status) {
      sql += ` AND wr.status = ?`;
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY wr.payroll_month DESC, wr.wage_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(wageId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        wr.wage_id,
        wr.employee_id,
        emp.employee_code,
        emp.full_name,
        emp.designation,
        wr.payroll_month,
        wr.base_amount,
        wr.piece_rate_amount,
        wr.bonus_overtime,
        wr.gross_amount,
        wr.status,
        wr.created_at
      FROM wage_record wr
      JOIN employee emp ON wr.employee_id = emp.employee_id
      WHERE wr.wage_id = ?`,
      [wageId]
    );
    return rows[0] || null;
  },

  async findByEmployeeAndMonth(employeeId, payrollMonth) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT wage_id FROM wage_record WHERE employee_id = ? AND payroll_month = ?`,
      [employeeId, payrollMonth]
    );
    return rows[0] || null;
  },

  async create(data) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO wage_record 
        (employee_id, payroll_month, base_amount, piece_rate_amount, bonus_overtime, gross_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
      [
        data.employee_id,
        data.payroll_month,
        data.base_amount || 0.00,
        data.piece_rate_amount || 0.00,
        data.bonus_overtime || 0.00,
        data.gross_amount || 0.00,
      ]
    );
    return this.findById(result.insertId);
  },

  async updateStatus(wageId, status) {
    const pool = getPool();
    await pool.query(`UPDATE wage_record SET status = ? WHERE wage_id = ?`, [status, wageId]);
    return this.findById(wageId);
  },
};

module.exports = WagesRepository;
