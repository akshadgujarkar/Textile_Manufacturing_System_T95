'use strict';

const { getPool } = require('../../config/database');

const OrderMaterialReqRepository = {
  async findAll({ limit = 20, offset = 0, order_item_id, yarn_item_id, allocation_status } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        omr.requirement_id,
        omr.order_item_id,
        oi.order_id,
        co.order_no,
        omr.yarn_item_id,
        yt.name AS yarn_type_name,
        yi.colour_code AS yarn_colour_code,
        yi.colour_name AS yarn_colour_name,
        omr.required_qty,
        omr.waste_factor_pct,
        omr.reserved_qty,
        omr.allocation_status
      FROM order_material_requirement omr
      JOIN order_item oi ON omr.order_item_id = oi.order_item_id
      JOIN customer_order co ON oi.order_id = co.order_id
      JOIN yarn_item yi ON omr.yarn_item_id = yi.yarn_item_id
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      WHERE 1=1
    `;
    const params = [];

    if (order_item_id) {
      sql += ` AND omr.order_item_id = ?`;
      params.push(order_item_id);
    }
    if (yarn_item_id) {
      sql += ` AND omr.yarn_item_id = ?`;
      params.push(yarn_item_id);
    }
    if (allocation_status) {
      sql += ` AND omr.allocation_status = ?`;
      params.push(allocation_status);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY omr.requirement_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(requirementId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        omr.requirement_id,
        omr.order_item_id,
        oi.order_id,
        co.order_no,
        omr.yarn_item_id,
        yt.name AS yarn_type_name,
        yi.colour_code AS yarn_colour_code,
        yi.colour_name AS yarn_colour_name,
        omr.required_qty,
        omr.waste_factor_pct,
        omr.reserved_qty,
        omr.allocation_status
      FROM order_material_requirement omr
      JOIN order_item oi ON omr.order_item_id = oi.order_item_id
      JOIN customer_order co ON oi.order_id = co.order_id
      JOIN yarn_item yi ON omr.yarn_item_id = yi.yarn_item_id
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      WHERE omr.requirement_id = ?`,
      [requirementId]
    );
    return rows[0] || null;
  },

  async create(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO order_material_requirement (order_item_id, yarn_item_id, required_qty, waste_factor_pct, reserved_qty, allocation_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.order_item_id,
        data.yarn_item_id,
        data.required_qty,
        data.waste_factor_pct || 0.00,
        data.reserved_qty || 0.000,
        data.allocation_status || 'unallocated',
      ]
    );
    return result.insertId;
  },

  async updateReservation(requirementId, reservedQty, allocationStatus, conn) {
    const db = conn || getPool();
    await db.query(
      `UPDATE order_material_requirement 
       SET reserved_qty = ?, allocation_status = ? 
       WHERE requirement_id = ?`,
      [reservedQty, allocationStatus, requirementId]
    );
  },

  async checkSufficiencyByOrderId(orderId) {
    const pool = getPool();
    const sql = `
      SELECT 
        omr.requirement_id,
        oi.order_id,
        co.order_no,
        omr.yarn_item_id,
        yt.name AS yarn_type_name,
        yi.colour_code AS yarn_colour_code,
        yi.colour_name AS yarn_colour_name,
        omr.required_qty,
        omr.reserved_qty,
        COALESCE(stk.current_stock, 0) AS on_hand_stock,
        COALESCE(stk.current_stock, 0) - COALESCE(res.total_reserved, 0) AS free_stock,
        COALESCE(po.open_po_qty, 0) AS on_order_po,
        GREATEST(omr.required_qty - (COALESCE(stk.current_stock, 0) - COALESCE(res.total_reserved, 0)), 0) AS shortfall_now,
        GREATEST(omr.required_qty - (COALESCE(stk.current_stock, 0) - COALESCE(res.total_reserved, 0)) - COALESCE(po.open_po_qty, 0), 0) AS must_buy
      FROM order_material_requirement omr
      JOIN order_item oi ON omr.order_item_id = oi.order_item_id
      JOIN customer_order co ON oi.order_id = co.order_id
      JOIN yarn_item yi ON omr.yarn_item_id = yi.yarn_item_id
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      LEFT JOIN (
        SELECT yarn_item_id, SUM(quantity) AS current_stock 
        FROM yarn_stock_movement 
        GROUP BY yarn_item_id
      ) stk ON stk.yarn_item_id = omr.yarn_item_id
      LEFT JOIN (
        SELECT yarn_item_id, SUM(reserved_qty) AS total_reserved 
        FROM order_material_requirement 
        WHERE allocation_status IN ('reserved', 'partially_reserved')
        GROUP BY yarn_item_id
      ) res ON res.yarn_item_id = omr.yarn_item_id
      LEFT JOIN (
        SELECT poi.yarn_item_id, SUM(poi.quantity) AS open_po_qty
        FROM purchase_order po
        JOIN purchase_order_item poi ON po.po_id = poi.po_id
        WHERE po.status IN ('approved', 'sent', 'partially_received')
        GROUP BY poi.yarn_item_id
      ) po ON po.yarn_item_id = omr.yarn_item_id
      WHERE oi.order_id = ?
      ORDER BY omr.requirement_id ASC
    `;
    const [rows] = await pool.query(sql, [orderId]);
    return rows;
  },
};

module.exports = OrderMaterialReqRepository;

