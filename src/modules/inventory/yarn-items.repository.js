'use strict';

const { getPool } = require('../../config/database');

const YarnItemsRepository = {
  async findAll({ limit = 20, offset = 0, search, yarn_type_id, is_active } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        yi.yarn_item_id,
        yi.yarn_type_id,
        yt.name AS yarn_type_name,
        yt.fiber_content,
        yt.nominal_count,
        yi.colour_code,
        yi.colour_name,
        yi.unit_id,
        uom.unit_code,
        yi.reorder_level,
        yi.is_active,
        COALESCE((
          SELECT SUM(quantity) 
          FROM yarn_stock_movement 
          WHERE yarn_item_id = yi.yarn_item_id
        ), 0) AS current_stock
      FROM yarn_item yi
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      JOIN unit_of_measure uom ON yi.unit_id = uom.unit_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (yt.name LIKE ? OR yi.colour_code LIKE ? OR yi.colour_name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (yarn_type_id) {
      sql += ` AND yi.yarn_type_id = ?`;
      params.push(yarn_type_id);
    }
    if (is_active !== undefined) {
      sql += ` AND yi.is_active = ?`;
      params.push(is_active ? 1 : 0);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY yi.yarn_item_id ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(yarnItemId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        yi.yarn_item_id,
        yi.yarn_type_id,
        yt.name AS yarn_type_name,
        yt.fiber_content,
        yt.nominal_count,
        yi.colour_code,
        yi.colour_name,
        yi.unit_id,
        uom.unit_code,
        yi.reorder_level,
        yi.is_active,
        COALESCE((
          SELECT SUM(quantity) 
          FROM yarn_stock_movement 
          WHERE yarn_item_id = yi.yarn_item_id
        ), 0) AS current_stock
      FROM yarn_item yi
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      JOIN unit_of_measure uom ON yi.unit_id = uom.unit_id
      WHERE yi.yarn_item_id = ?`,
      [yarnItemId]
    );
    return rows[0] || null;
  },

  async findByTypeAndColour(yarnTypeId, colourCode) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT yarn_item_id FROM yarn_item WHERE yarn_type_id = ? AND colour_code = ?`,
      [yarnTypeId, colourCode]
    );
    return rows[0] || null;
  },

  async create(data) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO yarn_item (yarn_type_id, colour_code, colour_name, unit_id, reorder_level, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.yarn_type_id,
        data.colour_code,
        data.colour_name || null,
        data.unit_id,
        data.reorder_level !== undefined ? data.reorder_level : 0.000,
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      ]
    );
    return this.findById(result.insertId);
  },

  async update(yarnItemId, data) {
    const pool = getPool();
    const fields = [];
    const params = [];

    if (data.colour_name !== undefined) { fields.push('colour_name = ?'); params.push(data.colour_name); }
    if (data.reorder_level !== undefined) { fields.push('reorder_level = ?'); params.push(data.reorder_level); }
    if (data.is_active !== undefined) { fields.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }

    if (fields.length === 0) return this.findById(yarnItemId);

    params.push(yarnItemId);
    await pool.query(`UPDATE yarn_item SET ${fields.join(', ')} WHERE yarn_item_id = ?`, params);
    return this.findById(yarnItemId);
  },

  async getStockBalance(yarnItemId) {
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
        (COALESCE(SUM(ysm.quantity), 0) < yi.reorder_level) AS is_reorder_needed
      FROM yarn_item yi
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      JOIN unit_of_measure uom ON yi.unit_id = uom.unit_id
      LEFT JOIN yarn_stock_movement ysm ON yi.yarn_item_id = ysm.yarn_item_id
      WHERE yi.yarn_item_id = ?
      GROUP BY yi.yarn_item_id`,
      [yarnItemId]
    );
    return rows[0] || null;
  },

  async getStockLedger(yarnItemId, { limit = 50, offset = 0 } = {}) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        ysm.movement_id,
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
      LEFT JOIN goods_receipt_item gri ON ysm.receipt_item_id = gri.receipt_item_id
      LEFT JOIN production_job pj ON ysm.production_job_id = pj.job_id
      LEFT JOIN employee emp ON ysm.created_by_employee_id = emp.employee_id
      WHERE ysm.yarn_item_id = ?
      ORDER BY ysm.occurred_at DESC, ysm.movement_id DESC
      LIMIT ? OFFSET ?`,
      [yarnItemId, Number(limit), Number(offset)]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM yarn_stock_movement WHERE yarn_item_id = ?`,
      [yarnItemId]
    );
    const total = countRows[0]?.total || 0;

    return { rows, total };
  },
};

module.exports = YarnItemsRepository;
