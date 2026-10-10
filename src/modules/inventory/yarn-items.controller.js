'use strict';

const YarnItemsService = require('./yarn-items.service');
const { success, created, paginated } = require('../../utils/response');

const YarnItemsController = {
  async list(req, res, next) {
    try {
      const result = await YarnItemsService.listYarnItems(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const item = await YarnItemsService.getYarnItemById(req.params.id);
      success(res, item);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const item = await YarnItemsService.createYarnItem(req.body);
      created(res, item);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const item = await YarnItemsService.updateYarnItem(req.params.id, req.body);
      success(res, item);
    } catch (err) {
      next(err);
    }
  },

  async getStock(req, res, next) {
    try {
      const stock = await YarnItemsService.getStockBalance(req.params.id);
      success(res, stock);
    } catch (err) {
      next(err);
    }
  },

  async getStockLedger(req, res, next) {
    try {
      const result = await YarnItemsService.getStockLedger(req.params.id, req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = YarnItemsController;
