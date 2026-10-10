'use strict';

const FabricProductsRepository = require('./fabric-products.repository');
const UnitsRepository = require('./units.repository');
const { createError } = require('../../utils/response');

const FabricProductsService = {
  async listFabricProducts(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await FabricProductsRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
    });

    return { data: rows, total, page, pageSize };
  },

  async getFabricProductById(productId) {
    const prod = await FabricProductsRepository.findById(productId);
    if (!prod) {
      throw createError(`Fabric product with ID ${productId} not found`, 404, 'NOT_FOUND');
    }
    return prod;
  },

  async createFabricProduct(data) {
    const unit = await UnitsRepository.findById(data.unit_id);
    if (!unit) {
      throw createError(`Unit of measure with ID ${data.unit_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    const existing = await FabricProductsRepository.findByCode(data.product_code);
    if (existing) {
      throw createError(`Product code "${data.product_code}" already exists`, 409, 'DUPLICATE_CODE');
    }

    return FabricProductsRepository.create(data);
  },

  async updateFabricProduct(productId, data) {
    await this.getFabricProductById(productId);
    if (data.unit_id) {
      const unit = await UnitsRepository.findById(data.unit_id);
      if (!unit) {
        throw createError(`Unit of measure with ID ${data.unit_id} does not exist`, 400, 'INVALID_REFERENCE');
      }
    }
    return FabricProductsRepository.update(productId, data);
  },
};

module.exports = FabricProductsService;
