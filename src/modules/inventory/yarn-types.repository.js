'use strict';

const { getPool } = require('../../config/database');

const YarnTypesRepository = {
  async findAll({ search } = {}) {
    const pool = getPool();
    let sql = `SELECT yarn_type_id, name, fiber_content, nominal_count, description FROM yarn_type WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ` AND (name LIKE ? OR fiber_content LIKE ? OR nominal_count LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ` ORDER BY yarn_type_id ASC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async findById(yarnTypeId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT yarn_type_id, name, fiber_content, nominal_count, description FROM yarn_type WHERE yarn_type_id = ?`,
      [yarnTypeId]
    );
    return rows[0] || null;
  },

  async findByName(name) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT yarn_type_id, name, fiber_content, nominal_count, description FROM yarn_type WHERE name = ?`,
      [name]
    );
    return rows[0] || null;
  },

  async create(data) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO yarn_type (name, fiber_content, nominal_count, description) VALUES (?, ?, ?, ?)`,
      [data.name, data.fiber_content || null, data.nominal_count || null, data.description || null]
    );
    return this.findById(result.insertId);
  },

  async update(yarnTypeId, data) {
    const pool = getPool();
    const fields = [];
    const params = [];

    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.fiber_content !== undefined) { fields.push('fiber_content = ?'); params.push(data.fiber_content); }
    if (data.nominal_count !== undefined) { fields.push('nominal_count = ?'); params.push(data.nominal_count); }
    if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }

    if (fields.length === 0) return this.findById(yarnTypeId);

    params.push(yarnTypeId);
    await pool.query(`UPDATE yarn_type SET ${fields.join(', ')} WHERE yarn_type_id = ?`, params);
    return this.findById(yarnTypeId);
  },
};

module.exports = YarnTypesRepository;
