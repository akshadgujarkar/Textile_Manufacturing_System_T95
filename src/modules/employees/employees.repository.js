'use strict';

const { getPool } = require('../../config/database');

const EmployeeRepository = {
  async findAll({ limit = 20, offset = 0, search, is_active } = {}) {
    const pool = getPool();
    let sql = `SELECT employee_id, employee_code, full_name, designation, pay_basis, pay_rate, phone, is_active, created_at FROM employee WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ` AND (full_name LIKE ? OR employee_code LIKE ? OR designation LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (is_active !== undefined) {
      sql += ` AND is_active = ?`;
      params.push(is_active ? 1 : 0);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY employee_id ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(employeeId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT employee_id, employee_code, full_name, designation, pay_basis, pay_rate, phone, is_active, created_at FROM employee WHERE employee_id = ?`,
      [employeeId]
    );
    return rows[0] || null;
  },

  async findByCode(employeeCode) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT employee_id, employee_code, full_name, designation, pay_basis, pay_rate, phone, is_active, created_at FROM employee WHERE employee_code = ?`,
      [employeeCode]
    );
    return rows[0] || null;
  },

  async create(data) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO employee (employee_code, full_name, designation, pay_basis, pay_rate, phone, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.employee_code,
        data.full_name,
        data.designation || null,
        data.pay_basis || 'monthly',
        data.pay_rate !== undefined ? data.pay_rate : null,
        data.phone || null,
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      ]
    );
    return this.findById(result.insertId);
  },

  async update(employeeId, data) {
    const pool = getPool();
    const fields = [];
    const params = [];

    if (data.full_name !== undefined) { fields.push('full_name = ?'); params.push(data.full_name); }
    if (data.designation !== undefined) { fields.push('designation = ?'); params.push(data.designation); }
    if (data.pay_basis !== undefined) { fields.push('pay_basis = ?'); params.push(data.pay_basis); }
    if (data.pay_rate !== undefined) { fields.push('pay_rate = ?'); params.push(data.pay_rate); }
    if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone); }
    if (data.is_active !== undefined) { fields.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }

    if (fields.length === 0) return this.findById(employeeId);

    params.push(employeeId);
    await pool.query(`UPDATE employee SET ${fields.join(', ')} WHERE employee_id = ?`, params);
    return this.findById(employeeId);
  },
};

module.exports = EmployeeRepository;
