'use strict';

const { getPool } = require('../../config/database');

const CustomerOrdersRepository = {
  async findAll({ limit = 20, offset = 0, search, buyer_id, status } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        co.order_id,
        co.order_no,
        co.buyer_id,
        b.name AS buyer_name,
        b.buyer_code,
        co.order_date,
        co.promised_delivery_date,
        co.status,
        co.version,
        co.created_by_employee_id,
        emp.full_name AS created_by_name,
        co.created_at,
        (
          SELECT COALESCE(SUM(line_total), 0)
          FROM order_item
          WHERE order_id = co.order_id
        ) AS total_order_value
      FROM customer_order co
      JOIN buyer b ON co.buyer_id = b.buyer_id
      JOIN employee emp ON co.created_by_employee_id = emp.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (co.order_no LIKE ? OR b.name LIKE ? OR b.buyer_code LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (buyer_id) {
      sql += ` AND co.buyer_id = ?`;
      params.push(buyer_id);
    }
    if (status) {
      sql += ` AND co.status = ?`;
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY co.order_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(orderId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        co.order_id,
        co.order_no,
        co.buyer_id,
        b.name AS buyer_name,
        b.buyer_code,
        b.credit_limit,
        b.payment_terms_days,
        co.order_date,
        co.promised_delivery_date,
        co.status,
        co.version,
        co.created_by_employee_id,
        emp.full_name AS created_by_name,
        co.created_at
      FROM customer_order co
      JOIN buyer b ON co.buyer_id = b.buyer_id
      JOIN employee emp ON co.created_by_employee_id = emp.employee_id
      WHERE co.order_id = ?`,
      [orderId]
    );
    if (!rows[0]) return null;

    const [items] = await pool.query(
      `SELECT 
        oi.order_item_id,
        oi.order_id,
        oi.line_no,
        oi.product_id,
        fp.product_code,
        fp.name AS product_name,
        fp.weave_type,
        oi.colour_code,
        oi.ordered_qty,
        oi.unit_id,
        uom.unit_code,
        oi.agreed_rate,
        oi.line_total
      FROM order_item oi
      JOIN fabric_product fp ON oi.product_id = fp.product_id
      JOIN unit_of_measure uom ON oi.unit_id = uom.unit_id
      WHERE oi.order_id = ?
      ORDER BY oi.line_no ASC`,
      [orderId]
    );

    const [requirements] = await pool.query(
      `SELECT 
        omr.requirement_id,
        omr.order_item_id,
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
      JOIN yarn_item yi ON omr.yarn_item_id = yi.yarn_item_id
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      WHERE oi.order_id = ?
      ORDER BY omr.requirement_id ASC`,
      [orderId]
    );

    return {
      ...rows[0],
      items,
      material_requirements: requirements,
    };
  },

  async findByOrderNo(orderNo) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT order_id FROM customer_order WHERE order_no = ?`,
      [orderNo]
    );
    return rows[0] || null;
  },

  async createHeader(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO customer_order (order_no, buyer_id, order_date, promised_delivery_date, status, version, created_by_employee_id)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [
        data.order_no,
        data.buyer_id,
        data.order_date,
        data.promised_delivery_date || null,
        data.status || 'draft',
        data.created_by_employee_id,
      ]
    );
    return result.insertId;
  },

  async createItem(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO order_item (order_id, line_no, product_id, colour_code, ordered_qty, unit_id, agreed_rate, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.order_id,
        data.line_no,
        data.product_id,
        data.colour_code,
        data.ordered_qty,
        data.unit_id,
        data.agreed_rate,
        data.line_total,
      ]
    );
    return result.insertId;
  },

  async updateStatusWithVersion(orderId, newStatus, expectedVersion, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `UPDATE customer_order 
       SET status = ?, version = version + 1 
       WHERE order_id = ? AND version = ?`,
      [newStatus, orderId, expectedVersion]
    );
    return result.affectedRows > 0;
  },
};

module.exports = CustomerOrdersRepository;
