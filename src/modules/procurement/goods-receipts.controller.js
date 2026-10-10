'use strict';

const GoodsReceiptsService = require('./goods-receipts.service');
const { success, created, paginated } = require('../../utils/response');

const GoodsReceiptsController = {
  async list(req, res, next) {
    try {
      const result = await GoodsReceiptsService.listGoodsReceipts(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const receipt = await GoodsReceiptsService.getGoodsReceiptById(req.params.id);
      success(res, receipt);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const receipt = await GoodsReceiptsService.createGoodsReceipt(req.body);
      created(res, receipt);
    } catch (err) {
      next(err);
    }
  },

  async cancel(req, res, next) {
    try {
      const receipt = await GoodsReceiptsService.cancelReceipt(req.params.id, req.body);
      success(res, receipt);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = GoodsReceiptsController;

