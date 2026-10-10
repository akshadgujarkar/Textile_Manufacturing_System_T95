'use strict';

const { getPool } = require('../../config/database');

const FabricRollsRepository = {
  async findAll({ limit = 20, offset = 0, search, job_id, status } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        fr.roll_id,
        fr.roll_code,
        fr.job_id,
        pj.job_no,
        oi.order_id,
        co.order_no,
        b.name AS buyer_name,
        fp.name AS product_name,
        fr.operator_id,
        emp.full_name AS operator_name,
        fr.length_m,
        fr.weight_kg,
        fr.gsm,
        fr.width_inches,
        fr.status,
        fr.shelf_location,
        fr.version,
        fr.created_at
      FROM fabric_roll fr
      JOIN production_job pj ON fr.job_id = pj.job_id
      JOIN order_item oi ON pj.order_item_id = oi.order_item_id
      JOIN customer_order co ON oi.order_id = co.order_id
      JOIN buyer b ON co.buyer_id = b.buyer_id
      JOIN fabric_product fp ON oi.product_id = fp.product_id
      JOIN employee emp ON fr.operator_id = emp.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (fr.roll_code LIKE ? OR pj.job_no LIKE ? OR co.order_no LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (job_id) {
      sql += ` AND fr.job_id = ?`;
      params.push(job_id);
    }
    if (status) {
      sql += ` AND fr.status = ?`;
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY fr.roll_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(rollId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        fr.roll_id,
        fr.roll_code,
        fr.job_id,
        pj.job_no,
        oi.order_id,
        co.order_no,
        b.buyer_id,
        b.name AS buyer_name,
        b.buyer_code,
        fp.product_id,
        fp.product_code,
        fp.name AS product_name,
        oi.colour_code,
        fr.operator_id,
        emp.full_name AS operator_name,
        fr.length_m,
        fr.weight_kg,
        fr.gsm,
        fr.width_inches,
        fr.status,
        fr.shelf_location,
        fr.version,
        fr.created_at
      FROM fabric_roll fr
      JOIN production_job pj ON fr.job_id = pj.job_id
      JOIN order_item oi ON pj.order_item_id = oi.order_item_id
      JOIN customer_order co ON oi.order_id = co.order_id
      JOIN buyer b ON co.buyer_id = b.buyer_id
      JOIN fabric_product fp ON oi.product_id = fp.product_id
      JOIN employee emp ON fr.operator_id = emp.employee_id
      WHERE fr.roll_id = ?`,
      [rollId]
    );
    if (!rows[0]) return null;

    const [inspections] = await pool.query(
      `SELECT 
        qi.inspection_id,
        qi.attempt_no,
        qi.result,
        qi.assigned_grade,
        qi.total_penalty_points,
        qi.points_per_100_sq_yd,
        qi.inspector_id,
        emp.full_name AS inspector_name,
        qi.inspected_at,
        qi.remarks
      FROM qc_inspection qi
      JOIN employee emp ON qi.inspector_id = emp.employee_id
      WHERE qi.roll_id = ?
      ORDER BY qi.attempt_no ASC`,
      [rollId]
    );

    return {
      ...rows[0],
      inspections,
    };
  },

  async findByRollCode(rollCode) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT roll_id, status FROM fabric_roll WHERE roll_code = ?`,
      [rollCode]
    );
    return rows[0] || null;
  },

  async create(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO fabric_roll 
        (roll_code, job_id, operator_id, length_m, weight_kg, gsm, width_inches, status, shelf_location, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_qc', ?, 1)`,
      [
        data.roll_code,
        data.job_id,
        data.operator_id,
        data.length_m,
        data.weight_kg,
        data.gsm || null,
        data.width_inches || null,
        data.shelf_location || null,
      ]
    );
    return result.insertId;
  },

  async updateStatusWithVersion(rollId, newStatus, expectedVersion, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `UPDATE fabric_roll 
       SET status = ?, version = version + 1 
       WHERE roll_id = ? AND version = ?`,
      [newStatus, rollId, expectedVersion]
    );
    return result.affectedRows > 0;
  },

  async setStatus(rollId, newStatus, conn) {
    const db = conn || getPool();
    await db.query(
      `UPDATE fabric_roll SET status = ?, version = version + 1 WHERE roll_id = ?`,
      [newStatus, rollId]
    );
  },
};

module.exports = FabricRollsRepository;
