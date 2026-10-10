'use strict';

const BuyerRepository = require('./buyers.repository');
const { createError } = require('../../utils/response');

const BuyerService = {
  async listBuyers(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await BuyerRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
      is_active: query.is_active,
    });

    return { data: rows, total, page, pageSize };
  },

  async getBuyerById(buyerId) {
    const buyer = await BuyerRepository.findById(buyerId);
    if (!buyer) {
      throw createError(`Buyer with ID ${buyerId} not found`, 404, 'NOT_FOUND');
    }
    return buyer;
  },

  async createBuyer(data) {
    const existing = await BuyerRepository.findByCode(data.buyer_code);
    if (existing) {
      throw createError(`Buyer code "${data.buyer_code}" already exists`, 409, 'DUPLICATE_CODE');
    }
    return BuyerRepository.create(data);
  },

  async updateBuyer(buyerId, data) {
    await this.getBuyerById(buyerId);
    return BuyerRepository.update(buyerId, data);
  },
};

module.exports = BuyerService;
