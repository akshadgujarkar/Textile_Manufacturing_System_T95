'use strict';

const { getPool } = require('../../config/database');

const DispatchesRepository = {
  async findAll({ limit = 20, offset = 0, search, buyer_id, order_id, status } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        d.dispatch_id,
        d.dispatch_no,
        d.buyer_id,
        b.name AS buyer_name,
        b.buyer_code,
        d.order_id,
        co.order_no,
        d.invoice_id,
        inv.invoice_no,
        d.vehicle_no,
        d.driver_name,
        d.driver_phone,
        d.destination,
        d.status,
        d.dispatched_at,
        d.version,
        d.created_at,
        (
          SELECT COUNT(*) FROM dispatch_item WHERE dispatch_id = d.dispatch_id AND state = 'active'
        ) AS active_roll_count
      FROM dispatch d
      JOIN buyer b ON d.buyer_id = b.buyer_id
      JOIN customer_order co ON d.order_id = co.order_id
      LEFT JOIN invoice inv ON d.invoice_id = inv.invoice_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (d.dispatch_no LIKE ? OR d.vehicle_no LIKE ? OR d.driver_name LIKE ? OR co.order_no LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (buyer_id) {
      sql += ` AND d.buyer_id = ?`;
      params.push(buyer_id);
    }
    if (order_id) {
      sql += ` AND d.order_id = ?`;
      params.push(order_id);
    }
    if (status) {
      sql += ` AND d.status = ?`;
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY d.dispatch_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(dispatchId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        d.dispatch_id,
        d.dispatch_no,
        d.buyer_id,
        b.name AS buyer_name,
        b.buyer_code,
        d.order_id,
        co.order_no,
        d.invoice_id,
        inv.invoice_no,
        d.vehicle_no,
        d.driver_name,
        d.driver_phone,
        d.destination,
        d.status,
        d.dispatched_at,
        d.version,
        d.created_at
      FROM dispatch d
      JOIN buyer b ON d.buyer_id = b.buyer_id
      JOIN customer_order co ON d.order_id = co.order_id
      LEFT JOIN invoice inv ON d.invoice_id = inv.invoice_id
      WHERE d.dispatch_id = ?`,
      [dispatchId]
    );
    if (!rows[0]) return null;

    const [items] = await pool.query(
      `SELECT 
        di.dispatch_item_id,
        di.dispatch_id,
        di.roll_id,
        fr.roll_code,
        fr.length_m,
        fr.weight_kg,
        fp.name AS product_name,
        oi.colour_code,
        di.scanned_at,
        di.scanned_by_employee_id,
        emp.full_name AS scanned_by_name,
        di.state
      FROM dispatch_item di
      JOIN fabric_roll fr ON di.roll_id = fr.roll_id
      JOIN production_job pj ON fr.job_id = pj.job_id
      JOIN order_item oi ON pj.order_item_id = oi.order_item_id
      JOIN fabric_product fp ON oi.product_id = fp.product_id
      JOIN employee emp ON di.scanned_by_employee_id = emp.employee_id
      WHERE di.dispatch_id = ?
      ORDER BY di.dispatch_item_id ASC`,
      [dispatchId]
    );

    return {
      ...rows[0],
      items,
    };
  },

  async findByDispatchNo(dispatchNo) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT dispatch_id FROM dispatch WHERE dispatch_no = ?`,
      [dispatchNo]
    );
    return rows[0] || null;
  },

  async create(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO dispatch 
        (dispatch_no, buyer_id, order_id, invoice_id, vehicle_no, driver_name, driver_phone, destination, status, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1)`,
      [
        data.dispatch_no,
        data.buyer_id,
        data.order_id,
        data.invoice_id || null,
        data.vehicle_no || null,
        data.driver_name || null,
        data.driver_phone || null,
        data.destination || null,
      ]
    );
    return result.insertId;
  },

  async findActiveDispatchItemByRoll(rollId, conn) {
    const db = conn || getPool();
    const [rows] = await db.query(
      `SELECT di.dispatch_item_id, di.dispatch_id, d.dispatch_no 
       FROM dispatch_item di
       JOIN dispatch d ON di.dispatch_id = d.dispatch_id
       WHERE di.roll_id = ? AND di.state = 'active'`,
      [rollId]
    );
    return rows[0] || null;
  },

  async addDispatchItem(data, conn) {
    const db = conn || getPool();
    const [result] = await db.query(
      `INSERT INTO dispatch_item (dispatch_id, roll_id, scanned_at, scanned_by_employee_id, state)
       VALUES (?, ?, ?, ?, 'active')`,
      [
        data.dispatch_id,
        data.roll_id,
        data.scanned_at || new Date(),
        data.scanned_by_employee_id,
      ]
    );
    return result.insertId;
  },

  async findDispatchItemById(itemId, conn) {
    const db = conn || getPool();
    const [rows] = await db.query(
      `SELECT dispatch_item_id, dispatch_id, roll_id, state FROM dispatch_item WHERE dispatch_item_id = ?`,
      [itemId]
    );
    return rows[0] || null;
  },

  async removeDispatchItem(itemId, conn) {
    const db = conn || getPool();
    await db.query(
      `UPDATE dispatch_item SET state = 'removed' WHERE dispatch_item_id = ?`,
      [itemId]
    );
  },

  async updateStatusWithVersion(dispatchId, { status, dispatched_at, expectedVersion }, conn) {
    const db = conn || getPool();
    let sql = `UPDATE dispatch SET status = ?, version = version + 1`;
    const params = [status];

    if (dispatched_at !== undefined) {
      sql += `, dispatched_at = ?`;
      params.push(dispatched_at);
    }

    sql += ` WHERE dispatch_id = ? AND version = ?`;
    params.push(dispatchId, expectedVersion);

    const [result] = await db.query(sql, params);
    return result.affectedRows > 0;
  },

  async getActiveRollsInDispatch(dispatchId, conn) {
    const db = conn || getPool();
    const [rows] = await db.query(
      `SELECT roll_id FROM dispatch_item WHERE dispatch_id = ? AND state = 'active'`,
      [dispatchId]
    );
    return rows.map((r) => r.roll_id);
  },
};

module.exports = DispatchesRepository;
