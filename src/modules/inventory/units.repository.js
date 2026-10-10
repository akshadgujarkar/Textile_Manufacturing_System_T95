'use strict';

const { getPool } = require('../../config/database');

const UnitsRepository = {
  async findAll() {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT unit_id, unit_code, description FROM unit_of_measure ORDER BY unit_id ASC`
    );
    return rows;
  },

  async findById(unitId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT unit_id, unit_code, description FROM unit_of_measure WHERE unit_id = ?`,
      [unitId]
    );
    return rows[0] || null;
  },

  async findByCode(unitCode) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT unit_id, unit_code, description FROM unit_of_measure WHERE unit_code = ?`,
      [unitCode]
    );
    return rows[0] || null;
  },

  async create(data) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO unit_of_measure (unit_code, description) VALUES (?, ?)`,
      [data.unit_code, data.description || null]
    );
    return this.findById(result.insertId);
  },

  async update(unitId, data) {
    const pool = getPool();
    const fields = [];
    const params = [];

    if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }
    if (fields.length === 0) return this.findById(unitId);

    params.push(unitId);
    await pool.query(`UPDATE unit_of_measure SET ${fields.join(', ')} WHERE unit_id = ?`, params);
    return this.findById(unitId);
  },
};

module.exports = UnitsRepository;
