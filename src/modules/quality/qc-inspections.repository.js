'use strict';

const { getPool } = require('../../config/database');

const QcInspectionsRepository = {
  async findAll({ limit = 20, offset = 0, roll_id, inspector_id, result } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        qi.inspection_id,
        qi.roll_id,
        fr.roll_code,
        qi.inspector_id,
        emp.full_name AS inspector_name,
        qi.attempt_no,
        qi.result,
        qi.assigned_grade,
        qi.total_penalty_points,
        qi.points_per_100_sq_yd,
        qi.inspected_at,
        qi.remarks
      FROM qc_inspection qi
      JOIN fabric_roll fr ON qi.roll_id = fr.roll_id
      JOIN employee emp ON qi.inspector_id = emp.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (roll_id) {
      sql += ` AND qi.roll_id = ?`;
      params.push(roll_id);
    }
    if (inspector_id) {
      sql += ` AND qi.inspector_id = ?`;
      params.push(inspector_id);
    }
    if (result) {
      sql += ` AND qi.result = ?`;
      params.push(result);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY qi.inspected_at DESC, qi.inspection_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(inspectionId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        qi.inspection_id,
        qi.roll_id,
        fr.roll_code,
        fr.length_m,
        fr.width_inches,
        fr.gsm,
        qi.inspector_id,
        emp.full_name AS inspector_name,
        qi.attempt_no,
        qi.result,
        qi.assigned_grade,
        qi.total_penalty_points,
        qi.points_per_100_sq_yd,
        qi.inspected_at,
        qi.remarks
      FROM qc_inspection qi
      JOIN fabric_roll fr ON qi.roll_id = fr.roll_id
      JOIN employee emp ON qi.inspector_id = emp.employee_id
      WHERE qi.inspection_id = ?`,
      [inspectionId]
    );
    if (!rows[0]) return null;

    const [defects] = await pool.query(
      `SELECT 
        defect_id,
        inspection_id,
        defect_code,
        defect_name,
        penalty_points,
        position_meters,
        severity
      FROM qc_defect
      WHERE inspection_id = ?
      ORDER BY defect_id ASC`,
      [inspectionId]
    );

    return {
      ...rows[0],
      defects,
    };
  },

  async getLatestAttemptNo(rollId, conn) {
    const db = conn || getPool();
    const [rows] = await db.query(
      `SELECT COALESCE(MAX(attempt_no), 0) AS max_attempt FROM qc_inspection WHERE roll_id = ?`,
      [rollId]
    );
    return Number(rows[0]?.max_attempt || 0);
  },

  async createHeader(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO qc_inspection 
        (roll_id, inspector_id, attempt_no, result, assigned_grade, total_penalty_points, points_per_100_sq_yd, inspected_at, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.roll_id,
        data.inspector_id,
        data.attempt_no,
        data.result,
        data.assigned_grade,
        data.total_penalty_points || 0,
        data.points_per_100_sq_yd || null,
        data.inspected_at || new Date(),
        data.remarks || null,
      ]
    );
    return result.insertId;
  },

  async createDefect(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO qc_defect 
        (inspection_id, defect_code, defect_name, penalty_points, position_meters, severity)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.inspection_id,
        data.defect_code,
        data.defect_name,
        data.penalty_points,
        data.position_meters || null,
        data.severity,
      ]
    );
    return result.insertId;
  },
};

module.exports = QcInspectionsRepository;
