'use strict';

const SupplierRepository = require('./suppliers.repository');
const { createError } = require('../../utils/response');

const SupplierService = {
  async listSuppliers(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await SupplierRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
      is_active: query.is_active,
    });

    return { data: rows, total, page, pageSize };
  },

  async getSupplierById(supplierId) {
    const sup = await SupplierRepository.findById(supplierId);
    if (!sup) {
      throw createError(`Supplier with ID ${supplierId} not found`, 404, 'NOT_FOUND');
    }
    return sup;
  },

  async createSupplier(data) {
    const existing = await SupplierRepository.findByCode(data.supplier_code);
    if (existing) {
      throw createError(`Supplier code "${data.supplier_code}" already exists`, 409, 'DUPLICATE_CODE');
    }
    return SupplierRepository.create(data);
  },

  async updateSupplier(supplierId, data) {
    await this.getSupplierById(supplierId);
    return SupplierRepository.update(supplierId, data);
  },
};

module.exports = SupplierService;
