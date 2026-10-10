'use strict';

const { getPool } = require('../../config/database');

const StockMovementsRepository = {
  async findAll({ limit = 20, offset = 0, yarn_item_id, movement_type, production_job_id } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        ysm.movement_id,
        ysm.yarn_item_id,
        yt.name AS yarn_type_name,
        yi.colour_code,
        yi.colour_name,
        uom.unit_code,
        ysm.movement_type,
        ysm.quantity,
        ysm.unit_cost,
        ysm.receipt_item_id,
        gri.lot_code,
        ysm.production_job_id,
        pj.job_no,
        ysm.reverses_movement_id,
        ysm.reason,
        ysm.occurred_at,
        ysm.created_by_employee_id,
        emp.full_name AS created_by_name
      FROM yarn_stock_movement ysm
      JOIN yarn_item yi ON ysm.yarn_item_id = yi.yarn_item_id
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      JOIN unit_of_measure uom ON yi.unit_id = uom.unit_id
      LEFT JOIN goods_receipt_item gri ON ysm.receipt_item_id = gri.receipt_item_id
      LEFT JOIN production_job pj ON ysm.production_job_id = pj.job_id
      LEFT JOIN employee emp ON ysm.created_by_employee_id = emp.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (yarn_item_id) {
      sql += ` AND ysm.yarn_item_id = ?`;
      params.push(yarn_item_id);
    }
    if (movement_type) {
      sql += ` AND ysm.movement_type = ?`;
      params.push(movement_type);
    }
    if (production_job_id) {
      sql += ` AND ysm.production_job_id = ?`;
      params.push(production_job_id);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY ysm.occurred_at DESC, ysm.movement_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(movementId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        ysm.movement_id,
        ysm.yarn_item_id,
        yt.name AS yarn_type_name,
        yi.colour_code,
        yi.colour_name,
        uom.unit_code,
        ysm.movement_type,
        ysm.quantity,
        ysm.unit_cost,
        ysm.receipt_item_id,
        gri.lot_code,
        ysm.production_job_id,
        pj.job_no,
        ysm.reverses_movement_id,
        ysm.reason,
        ysm.occurred_at,
        ysm.created_by_employee_id,
        emp.full_name AS created_by_name
      FROM yarn_stock_movement ysm
      JOIN yarn_item yi ON ysm.yarn_item_id = yi.yarn_item_id
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      JOIN unit_of_measure uom ON yi.unit_id = uom.unit_id
      LEFT JOIN goods_receipt_item gri ON ysm.receipt_item_id = gri.receipt_item_id
      LEFT JOIN production_job pj ON ysm.production_job_id = pj.job_id
      LEFT JOIN employee emp ON ysm.created_by_employee_id = emp.employee_id
      WHERE ysm.movement_id = ?`,
      [movementId]
    );
    return rows[0] || null;
  },

  async getCurrentStock(yarnItemId, conn) {
    const db = conn || getPool();
    const [rows] = await db.query(
      `SELECT COALESCE(SUM(quantity), 0) AS stock 
       FROM yarn_stock_movement 
       WHERE yarn_item_id = ? FOR UPDATE`,
      [yarnItemId]
    );
    return Number(rows[0]?.stock || 0);
  },

  async create(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO yarn_stock_movement 
        (yarn_item_id, movement_type, quantity, unit_cost, receipt_item_id, production_job_id, reverses_movement_id, reason, occurred_at, created_by_employee_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.yarn_item_id,
        data.movement_type,
        data.quantity,
        data.unit_cost !== undefined ? data.unit_cost : null,
        data.receipt_item_id || null,
        data.production_job_id || null,
        data.reverses_movement_id || null,
        data.reason || null,
        data.occurred_at || new Date(),
        data.created_by_employee_id,
      ]
    );
    return result.insertId;
  },

  async getReorderAlerts() {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        yi.yarn_item_id,
        yi.yarn_type_id,
        yt.name AS yarn_type_name,
        yi.colour_code,
        yi.colour_name,
        uom.unit_code,
        yi.reorder_level,
        COALESCE(SUM(ysm.quantity), 0) AS current_stock,
        (yi.reorder_level - COALESCE(SUM(ysm.quantity), 0)) AS deficit_qty
      FROM yarn_item yi
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      JOIN unit_of_measure uom ON yi.unit_id = uom.unit_id
      LEFT JOIN yarn_stock_movement ysm ON yi.yarn_item_id = ysm.yarn_item_id
      WHERE yi.is_active = 1
      GROUP BY yi.yarn_item_id
      HAVING current_stock < yi.reorder_level
      ORDER BY deficit_qty DESC`
    );
    return rows;
  },
};

module.exports = StockMovementsRepository;
