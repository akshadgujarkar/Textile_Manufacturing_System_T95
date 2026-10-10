'use strict';

const { getPool } = require('../../config/database');

const QcDefectsRepository = {
  async findAll({ limit = 20, offset = 0, inspection_id, defect_code, severity } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        qd.defect_id,
        qd.inspection_id,
        qi.roll_id,
        fr.roll_code,
        qd.defect_code,
        qd.defect_name,
        qd.penalty_points,
        qd.position_meters,
        qd.severity,
        qi.inspected_at
      FROM qc_defect qd
      JOIN qc_inspection qi ON qd.inspection_id = qi.inspection_id
      JOIN fabric_roll fr ON qi.roll_id = fr.roll_id
      WHERE 1=1
    `;
    const params = [];

    if (inspection_id) {
      sql += ` AND qd.inspection_id = ?`;
      params.push(inspection_id);
    }
    if (defect_code) {
      sql += ` AND qd.defect_code = ?`;
      params.push(defect_code);
    }
    if (severity) {
      sql += ` AND qd.severity = ?`;
      params.push(severity);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY qd.defect_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(defectId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        qd.defect_id,
        qd.inspection_id,
        qi.roll_id,
        fr.roll_code,
        qd.defect_code,
        qd.defect_name,
        qd.penalty_points,
        qd.position_meters,
        qd.severity
      FROM qc_defect qd
      JOIN qc_inspection qi ON qd.inspection_id = qi.inspection_id
      JOIN fabric_roll fr ON qi.roll_id = fr.roll_id
      WHERE qd.defect_id = ?`,
      [defectId]
    );
    return rows[0] || null;
  },
};

module.exports = QcDefectsRepository;
