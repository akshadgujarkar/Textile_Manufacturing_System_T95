'use strict';

const { getPool } = require('../../config/database');

const AttendanceRepository = {
  async findAll({ limit = 20, offset = 0, employee_id, work_date, shift_code, status } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        ar.attendance_id,
        ar.employee_id,
        emp.employee_code,
        emp.full_name,
        emp.designation,
        ar.work_date,
        ar.shift_code,
        ar.status,
        ar.hours_worked,
        ar.created_at
      FROM attendance_record ar
      JOIN employee emp ON ar.employee_id = emp.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (employee_id) {
      sql += ` AND ar.employee_id = ?`;
      params.push(employee_id);
    }
    if (work_date) {
      sql += ` AND ar.work_date = ?`;
      params.push(work_date);
    }
    if (shift_code) {
      sql += ` AND ar.shift_code = ?`;
      params.push(shift_code);
    }
    if (status) {
      sql += ` AND ar.status = ?`;
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY ar.work_date DESC, ar.attendance_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(attendanceId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        ar.attendance_id,
        ar.employee_id,
        emp.employee_code,
        emp.full_name,
        emp.designation,
        ar.work_date,
        ar.shift_code,
        ar.status,
        ar.hours_worked,
        ar.created_at
      FROM attendance_record ar
      JOIN employee emp ON ar.employee_id = emp.employee_id
      WHERE ar.attendance_id = ?`,
      [attendanceId]
    );
    return rows[0] || null;
  },

  async findByEmployeeDateShift(employeeId, workDate, shiftCode) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT attendance_id FROM attendance_record WHERE employee_id = ? AND work_date = ? AND shift_code = ?`,
      [employeeId, workDate, shiftCode]
    );
    return rows[0] || null;
  },

  async create(data) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO attendance_record (employee_id, work_date, shift_code, status, hours_worked)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.employee_id,
        data.work_date,
        data.shift_code,
        data.status,
        data.hours_worked !== undefined ? data.hours_worked : 0.00,
      ]
    );
    return this.findById(result.insertId);
  },

  async update(attendanceId, data) {
    const pool = getPool();
    const fields = [];
    const params = [];

    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
    if (data.hours_worked !== undefined) { fields.push('hours_worked = ?'); params.push(data.hours_worked); }

    if (fields.length === 0) return this.findById(attendanceId);

    params.push(attendanceId);
    await pool.query(`UPDATE attendance_record SET ${fields.join(', ')} WHERE attendance_id = ?`, params);
    return this.findById(attendanceId);
  },
};

module.exports = AttendanceRepository;
