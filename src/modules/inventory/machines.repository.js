'use strict';

const { getPool } = require('../../config/database');

const MachinesRepository = {
  async findAll({ limit = 20, offset = 0, search, stage_id, current_status, is_active } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        m.machine_id,
        m.machine_code,
        m.stage_id,
        ps.name AS stage_name,
        m.make_model,
        m.rated_rpm,
        m.is_active,
        m.current_status,
        m.last_status_changed_at
      FROM machine m
      JOIN process_stage ps ON m.stage_id = ps.stage_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (m.machine_code LIKE ? OR m.make_model LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s);
    }
    if (stage_id) {
      sql += ` AND m.stage_id = ?`;
      params.push(stage_id);
    }
    if (current_status) {
      sql += ` AND m.current_status = ?`;
      params.push(current_status);
    }
    if (is_active !== undefined) {
      sql += ` AND m.is_active = ?`;
      params.push(is_active ? 1 : 0);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY m.machine_id ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(machineId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        m.machine_id,
        m.machine_code,
        m.stage_id,
        ps.name AS stage_name,
        m.make_model,
        m.rated_rpm,
        m.is_active,
        m.current_status,
        m.last_status_changed_at
      FROM machine m
      JOIN process_stage ps ON m.stage_id = ps.stage_id
      WHERE m.machine_id = ?`,
      [machineId]
    );
    return rows[0] || null;
  },

  async findByCode(machineCode) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT machine_id FROM machine WHERE machine_code = ?`,
      [machineCode]
    );
    return rows[0] || null;
  },

  async create(data) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO machine (machine_code, stage_id, make_model, rated_rpm, is_active, current_status, last_status_changed_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
      [
        data.machine_code,
        data.stage_id,
        data.make_model || null,
        data.rated_rpm !== undefined ? data.rated_rpm : null,
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
        data.current_status || 'idle',
      ]
    );
    return this.findById(result.insertId);
  },

  async update(machineId, data) {
    const pool = getPool();
    const fields = [];
    const params = [];

    if (data.stage_id !== undefined) { fields.push('stage_id = ?'); params.push(data.stage_id); }
    if (data.make_model !== undefined) { fields.push('make_model = ?'); params.push(data.make_model); }
    if (data.rated_rpm !== undefined) { fields.push('rated_rpm = ?'); params.push(data.rated_rpm); }
    if (data.is_active !== undefined) { fields.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }
    if (data.current_status !== undefined) {
      fields.push('current_status = ?');
      params.push(data.current_status);
      fields.push('last_status_changed_at = NOW(3)');
    }

    if (fields.length === 0) return this.findById(machineId);

    params.push(machineId);
    await pool.query(`UPDATE machine SET ${fields.join(', ')} WHERE machine_id = ?`, params);
    return this.findById(machineId);
  },
};

module.exports = MachinesRepository;
