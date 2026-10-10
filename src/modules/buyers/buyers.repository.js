'use strict';

const { getPool } = require('../../config/database');

const BuyerRepository = {
  async findAll({ limit = 20, offset = 0, search, is_active } = {}) {
    const pool = getPool();
    let sql = `SELECT buyer_id, buyer_code, name, gstin, contact_person, phone, credit_limit, payment_terms_days, is_active FROM buyer WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ` AND (name LIKE ? OR buyer_code LIKE ? OR gstin LIKE ? OR contact_person LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (is_active !== undefined) {
      sql += ` AND is_active = ?`;
      params.push(is_active ? 1 : 0);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY buyer_id ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(buyerId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT buyer_id, buyer_code, name, gstin, contact_person, phone, credit_limit, payment_terms_days, is_active FROM buyer WHERE buyer_id = ?`,
      [buyerId]
    );
    return rows[0] || null;
  },

  async findByCode(buyerCode) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT buyer_id, buyer_code, name, gstin, contact_person, phone, credit_limit, payment_terms_days, is_active FROM buyer WHERE buyer_code = ?`,
      [buyerCode]
    );
    return rows[0] || null;
  },

  async create(data) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO buyer (buyer_code, name, gstin, contact_person, phone, credit_limit, payment_terms_days, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.buyer_code,
        data.name,
        data.gstin || null,
        data.contact_person || null,
        data.phone || null,
        data.credit_limit !== undefined ? data.credit_limit : 0.00,
        data.payment_terms_days !== undefined ? data.payment_terms_days : 30,
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      ]
    );
    return this.findById(result.insertId);
  },

  async update(buyerId, data) {
    const pool = getPool();
    const fields = [];
    const params = [];

    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.gstin !== undefined) { fields.push('gstin = ?'); params.push(data.gstin); }
    if (data.contact_person !== undefined) { fields.push('contact_person = ?'); params.push(data.contact_person); }
    if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone); }
    if (data.credit_limit !== undefined) { fields.push('credit_limit = ?'); params.push(data.credit_limit); }
    if (data.payment_terms_days !== undefined) { fields.push('payment_terms_days = ?'); params.push(data.payment_terms_days); }
    if (data.is_active !== undefined) { fields.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }

    if (fields.length === 0) return this.findById(buyerId);

    params.push(buyerId);
    await pool.query(`UPDATE buyer SET ${fields.join(', ')} WHERE buyer_id = ?`, params);
    return this.findById(buyerId);
  },
};

module.exports = BuyerRepository;
