'use strict';

const { getPool } = require('../../config/database');

const InvoicesRepository = {
  async findAll({ limit = 20, offset = 0, search, buyer_id, status } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        inv.invoice_id,
        inv.invoice_no,
        inv.buyer_id,
        b.name AS buyer_name,
        b.buyer_code,
        inv.invoice_date,
        inv.due_date,
        inv.subtotal,
        inv.tax_rate,
        inv.tax_amount,
        inv.total_amount,
        inv.status,
        inv.version,
        inv.created_at,
        COALESCE((
          SELECT SUM(amount) 
          FROM buyer_payment 
          WHERE invoice_id = inv.invoice_id AND status = 'recorded'
        ), 0) AS total_paid_amount,
        (
          inv.total_amount - COALESCE((
            SELECT SUM(amount) 
            FROM buyer_payment 
            WHERE invoice_id = inv.invoice_id AND status = 'recorded'
          ), 0)
        ) AS outstanding_balance
      FROM invoice inv
      JOIN buyer b ON inv.buyer_id = b.buyer_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (inv.invoice_no LIKE ? OR b.name LIKE ? OR b.buyer_code LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (buyer_id) {
      sql += ` AND inv.buyer_id = ?`;
      params.push(buyer_id);
    }
    if (status) {
      sql += ` AND inv.status = ?`;
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY inv.invoice_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(invoiceId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        inv.invoice_id,
        inv.invoice_no,
        inv.buyer_id,
        b.name AS buyer_name,
        b.buyer_code,
        b.gstin AS buyer_gstin,
        inv.invoice_date,
        inv.due_date,
        inv.subtotal,
        inv.tax_rate,
        inv.tax_amount,
        inv.total_amount,
        inv.status,
        inv.version,
        inv.created_at,
        COALESCE((
          SELECT SUM(amount) 
          FROM buyer_payment 
          WHERE invoice_id = inv.invoice_id AND status = 'recorded'
        ), 0) AS total_paid_amount,
        (
          inv.total_amount - COALESCE((
            SELECT SUM(amount) 
            FROM buyer_payment 
            WHERE invoice_id = inv.invoice_id AND status = 'recorded'
          ), 0)
        ) AS outstanding_balance
      FROM invoice inv
      JOIN buyer b ON inv.buyer_id = b.buyer_id
      WHERE inv.invoice_id = ?`,
      [invoiceId]
    );
    if (!rows[0]) return null;

    const [items] = await pool.query(
      `SELECT 
        ii.invoice_item_id,
        ii.invoice_id,
        ii.order_item_id,
        oi.order_id,
        co.order_no,
        fp.product_code,
        fp.name AS product_name,
        oi.colour_code,
        ii.hsn_code,
        ii.quantity,
        ii.rate,
        ii.amount
      FROM invoice_item ii
      JOIN order_item oi ON ii.order_item_id = oi.order_item_id
      JOIN customer_order co ON oi.order_id = co.order_id
      JOIN fabric_product fp ON oi.product_id = fp.product_id
      WHERE ii.invoice_id = ?
      ORDER BY ii.invoice_item_id ASC`,
      [invoiceId]
    );

    const [payments] = await pool.query(
      `SELECT 
        bp.payment_id,
        bp.payment_ref,
        bp.received_on,
        bp.amount,
        bp.mode,
        bp.status,
        bp.client_request_id,
        bp.created_by_employee_id,
        emp.full_name AS created_by_name,
        bp.created_at
      FROM buyer_payment bp
      JOIN employee emp ON bp.created_by_employee_id = emp.employee_id
      WHERE bp.invoice_id = ?
      ORDER BY bp.payment_id ASC`,
      [invoiceId]
    );

    return {
      ...rows[0],
      items,
      payments,
    };
  },

  async findByInvoiceNo(invoiceNo) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT invoice_id FROM invoice WHERE invoice_no = ?`,
      [invoiceNo]
    );
    return rows[0] || null;
  },

  async createHeader(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO invoice 
        (invoice_no, buyer_id, invoice_date, due_date, subtotal, tax_rate, tax_amount, total_amount, status, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1)`,
      [
        data.invoice_no,
        data.buyer_id,
        data.invoice_date,
        data.due_date || null,
        data.subtotal,
        data.tax_rate !== undefined ? data.tax_rate : 5.00,
        data.tax_amount,
        data.total_amount,
      ]
    );
    return result.insertId;
  },

  async createItem(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO invoice_item (invoice_id, order_item_id, hsn_code, quantity, rate, amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.invoice_id,
        data.order_item_id,
        data.hsn_code || '5208',
        data.quantity,
        data.rate,
        data.amount,
      ]
    );
    return result.insertId;
  },

  async updateStatusWithVersion(invoiceId, newStatus, expectedVersion, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `UPDATE invoice SET status = ?, version = version + 1 WHERE invoice_id = ? AND version = ?`,
      [newStatus, invoiceId, expectedVersion]
    );
    return result.affectedRows > 0;
  },
};

module.exports = InvoicesRepository;
