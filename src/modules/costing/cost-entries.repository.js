'use strict';

const { getPool } = require('../../config/database');

const CostEntriesRepository = {
  async findAll({ limit = 20, offset = 0, cost_type, order_id, machine_id, roll_id, from_date, to_date } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        ce.cost_id,
        ce.cost_type,
        ce.amount,
        ce.cost_date,
        ce.order_id,
        co.order_no,
        ce.machine_id,
        m.machine_code,
        ce.roll_id,
        fr.roll_code,
        ce.movement_id,
        ce.wage_id,
        ce.created_at
      FROM cost_entry ce
      LEFT JOIN customer_order co ON ce.order_id = co.order_id
      LEFT JOIN machine m ON ce.machine_id = m.machine_id
      LEFT JOIN fabric_roll fr ON ce.roll_id = fr.roll_id
      WHERE 1=1
    `;
    const params = [];

    if (cost_type) {
      sql += ` AND ce.cost_type = ?`;
      params.push(cost_type);
    }
    if (order_id) {
      sql += ` AND ce.order_id = ?`;
      params.push(order_id);
    }
    if (machine_id) {
      sql += ` AND ce.machine_id = ?`;
      params.push(machine_id);
    }
    if (roll_id) {
      sql += ` AND ce.roll_id = ?`;
      params.push(roll_id);
    }
    if (from_date) {
      sql += ` AND ce.cost_date >= ?`;
      params.push(from_date);
    }
    if (to_date) {
      sql += ` AND ce.cost_date <= ?`;
      params.push(to_date);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY ce.cost_date DESC, ce.cost_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(costId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        ce.cost_id,
        ce.cost_type,
        ce.amount,
        ce.cost_date,
        ce.order_id,
        co.order_no,
        ce.machine_id,
        m.machine_code,
        ce.roll_id,
        fr.roll_code,
        ce.movement_id,
        ce.wage_id,
        ce.created_at
      FROM cost_entry ce
      LEFT JOIN customer_order co ON ce.order_id = co.order_id
      LEFT JOIN machine m ON ce.machine_id = m.machine_id
      LEFT JOIN fabric_roll fr ON ce.roll_id = fr.roll_id
      WHERE ce.cost_id = ?`,
      [costId]
    );
    return rows[0] || null;
  },

  async create(data) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO cost_entry (cost_type, amount, cost_date, order_id, machine_id, roll_id, movement_id, wage_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.cost_type,
        data.amount,
        data.cost_date,
        data.order_id || null,
        data.machine_id || null,
        data.roll_id || null,
        data.movement_id || null,
        data.wage_id || null,
      ]
    );
    return this.findById(result.insertId);
  },
};

module.exports = CostEntriesRepository;
