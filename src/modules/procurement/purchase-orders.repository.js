'use strict';

const { getPool } = require('../../config/database');

const PurchaseOrdersRepository = {
  async findAll({ limit = 20, offset = 0, search, supplier_id, status } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        po.po_id,
        po.po_no,
        po.supplier_id,
        s.name AS supplier_name,
        po.order_date,
        po.expected_delivery_date,
        po.status,
        po.total_amount,
        po.created_by,
        emp.full_name AS created_by_name,
        po.created_at
      FROM purchase_order po
      JOIN supplier s ON po.supplier_id = s.supplier_id
      JOIN employee emp ON po.created_by = emp.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (po.po_no LIKE ? OR s.name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s);
    }
    if (supplier_id) {
      sql += ` AND po.supplier_id = ?`;
      params.push(supplier_id);
    }
    if (status) {
      sql += ` AND po.status = ?`;
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY po.po_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(poId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        po.po_id,
        po.po_no,
        po.supplier_id,
        s.name AS supplier_name,
        s.supplier_code,
        po.order_date,
        po.expected_delivery_date,
        po.status,
        po.total_amount,
        po.created_by,
        emp.full_name AS created_by_name,
        po.created_at
      FROM purchase_order po
      JOIN supplier s ON po.supplier_id = s.supplier_id
      JOIN employee emp ON po.created_by = emp.employee_id
      WHERE po.po_id = ?`,
      [poId]
    );
    if (!rows[0]) return null;

    const [items] = await pool.query(
      `SELECT 
        poi.po_item_id,
        poi.po_id,
        poi.yarn_item_id,
        yt.name AS yarn_type_name,
        yi.colour_code,
        yi.colour_name,
        uom.unit_code,
        poi.quantity,
        poi.agreed_rate,
        poi.line_total
      FROM purchase_order_item poi
      JOIN yarn_item yi ON poi.yarn_item_id = yi.yarn_item_id
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      JOIN unit_of_measure uom ON yi.unit_id = uom.unit_id
      WHERE poi.po_id = ?
      ORDER BY poi.po_item_id ASC`,
      [poId]
    );

    return { ...rows[0], items };
  },

  async findByPoNo(poNo) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT po_id FROM purchase_order WHERE po_no = ?`,
      [poNo]
    );
    return rows[0] || null;
  },

  async create(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO purchase_order (po_no, supplier_id, order_date, expected_delivery_date, status, total_amount, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.po_no,
        data.supplier_id,
        data.order_date,
        data.expected_delivery_date || null,
        data.status || 'draft',
        data.total_amount || 0.00,
        data.created_by,
      ]
    );
    return result.insertId;
  },

  async addItem(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO purchase_order_item (po_id, yarn_item_id, quantity, agreed_rate, line_total)
       VALUES (?, ?, ?, ?, ?)`,
      [data.po_id, data.yarn_item_id, data.quantity, data.agreed_rate, data.line_total]
    );
    return result.insertId;
  },

  async updateStatus(poId, status, conn) {
    const db = conn || getPool();
    await db.query(`UPDATE purchase_order SET status = ? WHERE po_id = ?`, [status, poId]);
  },

  async updateTotalAmount(poId, conn) {
    const db = conn || getPool();
    await db.query(
      `UPDATE purchase_order 
       SET total_amount = (SELECT COALESCE(SUM(line_total), 0) FROM purchase_order_item WHERE po_id = ?)
       WHERE po_id = ?`,
      [poId, poId]
    );
  },
};

module.exports = PurchaseOrdersRepository;
