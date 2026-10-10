'use strict';

const { getPool } = require('../../config/database');

const FabricProductsRepository = {
  async findAll({ limit = 20, offset = 0, search } = {}) {
    const pool = getPool();
    let sql = `
      SELECT 
        fp.product_id,
        fp.product_code,
        fp.name,
        fp.weave_type,
        fp.nominal_gsm,
        fp.nominal_width_inches,
        fp.unit_id,
        uom.unit_code
      FROM fabric_product fp
      JOIN unit_of_measure uom ON fp.unit_id = uom.unit_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (fp.name LIKE ? OR fp.product_code LIKE ? OR fp.weave_type LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ` ORDER BY fp.product_id ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return { rows, total };
  },

  async findById(productId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT 
        fp.product_id,
        fp.product_code,
        fp.name,
        fp.weave_type,
        fp.nominal_gsm,
        fp.nominal_width_inches,
        fp.unit_id,
        uom.unit_code
      FROM fabric_product fp
      JOIN unit_of_measure uom ON fp.unit_id = uom.unit_id
      WHERE fp.product_id = ?`,
      [productId]
    );
    return rows[0] || null;
  },

  async findByCode(productCode) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT product_id FROM fabric_product WHERE product_code = ?`,
      [productCode]
    );
    return rows[0] || null;
  },

  async create(data) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO fabric_product (product_code, name, weave_type, nominal_gsm, nominal_width_inches, unit_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.product_code,
        data.name,
        data.weave_type || null,
        data.nominal_gsm !== undefined ? data.nominal_gsm : null,
        data.nominal_width_inches !== undefined ? data.nominal_width_inches : null,
        data.unit_id,
      ]
    );
    return this.findById(result.insertId);
  },

  async update(productId, data) {
    const pool = getPool();
    const fields = [];
    const params = [];

    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.weave_type !== undefined) { fields.push('weave_type = ?'); params.push(data.weave_type); }
    if (data.nominal_gsm !== undefined) { fields.push('nominal_gsm = ?'); params.push(data.nominal_gsm); }
    if (data.nominal_width_inches !== undefined) { fields.push('nominal_width_inches = ?'); params.push(data.nominal_width_inches); }
    if (data.unit_id !== undefined) { fields.push('unit_id = ?'); params.push(data.unit_id); }

    if (fields.length === 0) return this.findById(productId);

    params.push(productId);
    await pool.query(`UPDATE fabric_product SET ${fields.join(', ')} WHERE product_id = ?`, params);
    return this.findById(productId);
  },
};

module.exports = FabricProductsRepository;
