'use strict';

const BuyerService = require('./buyers.service');
const { success, created, paginated } = require('../../utils/response');

const BuyerController = {
  async list(req, res, next) {
    try {
      const result = await BuyerService.listBuyers(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const buyer = await BuyerService.getBuyerById(req.params.id);
      success(res, buyer);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const buyer = await BuyerService.createBuyer(req.body);
      created(res, buyer);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const buyer = await BuyerService.updateBuyer(req.params.id, req.body);
      success(res, buyer);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = BuyerController;
