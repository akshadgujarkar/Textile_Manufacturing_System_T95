'use strict';

const { getPool } = require('../../config/database');

const BuyerPaymentsRepository = {
  async findAll({ limit = 20, offset = 0, buyer_id, invoice_id, status } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        bp.payment_id,
        bp.payment_ref,
        bp.buyer_id,
        b.name AS buyer_name,
        b.buyer_code,
        bp.invoice_id,
        inv.invoice_no,
        bp.received_on,
        bp.amount,
        bp.mode,
        bp.status,
        bp.client_request_id,
        bp.created_by_employee_id,
        emp.full_name AS created_by_name,
        bp.created_at
      FROM buyer_payment bp
      JOIN buyer b ON bp.buyer_id = b.buyer_id
      JOIN invoice inv ON bp.invoice_id = inv.invoice_id
      JOIN employee emp ON bp.created_by_employee_id = emp.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (buyer_id) {
      sql += ` AND bp.buyer_id = ?`;
      params.push(buyer_id);
    }
    if (invoice_id) {
      sql += ` AND bp.invoice_id = ?`;
      params.push(invoice_id);
    }
    if (status) {
      sql += ` AND bp.status = ?`;
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY bp.received_on DESC, bp.payment_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(paymentId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        bp.payment_id,
        bp.payment_ref,
        bp.buyer_id,
        b.name AS buyer_name,
        b.buyer_code,
        bp.invoice_id,
        inv.invoice_no,
        inv.total_amount AS invoice_total_amount,
        bp.received_on,
        bp.amount,
        bp.mode,
        bp.status,
        bp.client_request_id,
        bp.created_by_employee_id,
        emp.full_name AS created_by_name,
        bp.created_at
      FROM buyer_payment bp
      JOIN buyer b ON bp.buyer_id = b.buyer_id
      JOIN invoice inv ON bp.invoice_id = inv.invoice_id
      JOIN employee emp ON bp.created_by_employee_id = emp.employee_id
      WHERE bp.payment_id = ?`,
      [paymentId]
    );
    return rows[0] || null;
  },

  async findByPaymentRef(paymentRef) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT payment_id FROM buyer_payment WHERE payment_ref = ?`,
      [paymentRef]
    );
    return rows[0] || null;
  },

  async findByClientRequestId(clientRequestId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT payment_id FROM buyer_payment WHERE client_request_id = ?`,
      [clientRequestId]
    );
    return rows[0] || null;
  },

  async create(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO buyer_payment 
        (payment_ref, buyer_id, invoice_id, received_on, amount, mode, status, client_request_id, created_by_employee_id)
       VALUES (?, ?, ?, ?, ?, ?, 'recorded', ?, ?)`,
      [
        data.payment_ref,
        data.buyer_id,
        data.invoice_id,
        data.received_on,
        data.amount,
        data.mode,
        data.client_request_id,
        data.created_by_employee_id,
      ]
    );
    return result.insertId;
  },

  async updateStatus(paymentId, status, conn) {
    const db = conn || getPool();
    await db.query(`UPDATE buyer_payment SET status = ? WHERE payment_id = ?`, [status, paymentId]);
  },
};

module.exports = BuyerPaymentsRepository;
