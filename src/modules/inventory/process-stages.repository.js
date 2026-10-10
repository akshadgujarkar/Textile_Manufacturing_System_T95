'use strict';

const { getPool } = require('../../config/database');

const ProcessStagesRepository = {
  async findAll() {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT stage_id, name, sequence_hint FROM process_stage ORDER BY sequence_hint ASC, stage_id ASC`
    );
    return rows;
  },

  async findById(stageId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT stage_id, name, sequence_hint FROM process_stage WHERE stage_id = ?`,
      [stageId]
    );
    return rows[0] || null;
  },

  async findByName(name) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT stage_id, name, sequence_hint FROM process_stage WHERE name = ?`,
      [name]
    );
    return rows[0] || null;
  },

  async create(data) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO process_stage (name, sequence_hint) VALUES (?, ?)`,
      [data.name, data.sequence_hint]
    );
    return this.findById(result.insertId);
  },

  async update(stageId, data) {
    const pool = getPool();
    const fields = [];
    const params = [];

    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.sequence_hint !== undefined) { fields.push('sequence_hint = ?'); params.push(data.sequence_hint); }

    if (fields.length === 0) return this.findById(stageId);

    params.push(stageId);
    await pool.query(`UPDATE process_stage SET ${fields.join(', ')} WHERE stage_id = ?`, params);
    return this.findById(stageId);
  },
};

module.exports = ProcessStagesRepository;
