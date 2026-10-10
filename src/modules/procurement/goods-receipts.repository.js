'use strict';

const { getPool } = require('../../config/database');

const GoodsReceiptsRepository = {
  async findAll({ limit = 20, offset = 0, search, supplier_id, status } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        gr.receipt_id,
        gr.receipt_no,
        gr.supplier_id,
        s.name AS supplier_name,
        gr.po_id,
        po.po_no,
        gr.supplier_challan_no,
        gr.vehicle_number,
        gr.received_at,
        gr.received_by_employee_id,
        emp.full_name AS received_by_name,
        gr.client_request_id,
        gr.status,
        gr.created_at
      FROM goods_receipt gr
      JOIN supplier s ON gr.supplier_id = s.supplier_id
      LEFT JOIN purchase_order po ON gr.po_id = po.po_id
      JOIN employee emp ON gr.received_by_employee_id = emp.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (gr.receipt_no LIKE ? OR gr.supplier_challan_no LIKE ? OR s.name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (supplier_id) {
      sql += ` AND gr.supplier_id = ?`;
      params.push(supplier_id);
    }
    if (status) {
      sql += ` AND gr.status = ?`;
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY gr.receipt_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(receiptId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        gr.receipt_id,
        gr.receipt_no,
        gr.supplier_id,
        s.name AS supplier_name,
        s.supplier_code,
        gr.po_id,
        po.po_no,
        gr.supplier_challan_no,
        gr.vehicle_number,
        gr.received_at,
        gr.received_by_employee_id,
        emp.full_name AS received_by_name,
        gr.client_request_id,
        gr.status,
        gr.created_at
      FROM goods_receipt gr
      JOIN supplier s ON gr.supplier_id = s.supplier_id
      LEFT JOIN purchase_order po ON gr.po_id = po.po_id
      JOIN employee emp ON gr.received_by_employee_id = emp.employee_id
      WHERE gr.receipt_id = ?`,
      [receiptId]
    );
    if (!rows[0]) return null;

    const [items] = await pool.query(
      `SELECT 
        gri.receipt_item_id,
        gri.receipt_id,
        gri.yarn_item_id,
        yt.name AS yarn_type_name,
        yi.colour_code,
        yi.colour_name,
        uom.unit_code,
        gri.lot_code,
        gri.quantity_received,
        gri.earmarked_order_id,
        co.order_no AS earmarked_order_no,
        gri.storage_location
      FROM goods_receipt_item gri
      JOIN yarn_item yi ON gri.yarn_item_id = yi.yarn_item_id
      JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
      JOIN unit_of_measure uom ON yi.unit_id = uom.unit_id
      LEFT JOIN customer_order co ON gri.earmarked_order_id = co.order_id
      WHERE gri.receipt_id = ?
      ORDER BY gri.receipt_item_id ASC`,
      [receiptId]
    );

    return { ...rows[0], items };
  },

  async findByClientRequestId(clientRequestId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT receipt_id FROM goods_receipt WHERE client_request_id = ?`,
      [clientRequestId]
    );
    return rows[0] || null;
  },

  async findByReceiptNo(receiptNo) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT receipt_id FROM goods_receipt WHERE receipt_no = ?`,
      [receiptNo]
    );
    return rows[0] || null;
  },

  async findLotByCode(lotCode) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT receipt_item_id FROM goods_receipt_item WHERE lot_code = ?`,
      [lotCode]
    );
    return rows[0] || null;
  },

  async createHeader(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO goods_receipt 
        (receipt_no, supplier_id, po_id, supplier_challan_no, vehicle_number, received_at, received_by_employee_id, client_request_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.receipt_no,
        data.supplier_id,
        data.po_id || null,
        data.supplier_challan_no || null,
        data.vehicle_number || null,
        data.received_at || new Date(),
        data.received_by_employee_id,
        data.client_request_id,
        data.status || 'received',
      ]
    );
    return result.insertId;
  },

  async createItem(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO goods_receipt_item 
        (receipt_id, yarn_item_id, lot_code, quantity_received, earmarked_order_id, storage_location)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.receipt_id,
        data.yarn_item_id,
        data.lot_code,
        data.quantity_received,
        data.earmarked_order_id || null,
        data.storage_location || null,
      ]
    );
    return result.insertId;
  },

  async updateStatus(receiptId, status, conn) {
    const db = conn || getPool();
    await db.query(`UPDATE goods_receipt SET status = ? WHERE receipt_id = ?`, [status, receiptId]);
    return this.findById(receiptId);
  },
};

module.exports = GoodsReceiptsRepository;

