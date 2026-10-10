'use strict';

const { getPool } = require('../../config/database');

const SupplierRepository = {
  async findAll({ limit = 20, offset = 0, search, is_active } = {}) {
    const pool = getPool();
    let sql = `SELECT supplier_id, supplier_code, name, gstin, contact_person, phone, address, is_active FROM supplier WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ` AND (name LIKE ? OR supplier_code LIKE ? OR gstin LIKE ? OR contact_person LIKE ?)`;
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

    sql += ` ORDER BY supplier_id ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(supplierId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT supplier_id, supplier_code, name, gstin, contact_person, phone, address, is_active FROM supplier WHERE supplier_id = ?`,
      [supplierId]
    );
    return rows[0] || null;
  },

  async findByCode(supplierCode) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT supplier_id, supplier_code, name, gstin, contact_person, phone, address, is_active FROM supplier WHERE supplier_code = ?`,
      [supplierCode]
    );
    return rows[0] || null;
  },

  async create(data) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO supplier (supplier_code, name, gstin, contact_person, phone, address, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.supplier_code,
        data.name,
        data.gstin || null,
        data.contact_person || null,
        data.phone || null,
        data.address || null,
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      ]
    );
    return this.findById(result.insertId);
  },

  async update(supplierId, data) {
    const pool = getPool();
    const fields = [];
    const params = [];

    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.gstin !== undefined) { fields.push('gstin = ?'); params.push(data.gstin); }
    if (data.contact_person !== undefined) { fields.push('contact_person = ?'); params.push(data.contact_person); }
    if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone); }
    if (data.address !== undefined) { fields.push('address = ?'); params.push(data.address); }
    if (data.is_active !== undefined) { fields.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }

    if (fields.length === 0) return this.findById(supplierId);

    params.push(supplierId);
    await pool.query(`UPDATE supplier SET ${fields.join(', ')} WHERE supplier_id = ?`, params);
    return this.findById(supplierId);
  },
};

module.exports = SupplierRepository;
