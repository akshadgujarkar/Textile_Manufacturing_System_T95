'use strict';

const PurchaseOrdersService = require('./purchase-orders.service');
const { success, created, paginated } = require('../../utils/response');

const PurchaseOrdersController = {
  async list(req, res, next) {
    try {
      const result = await PurchaseOrdersService.listPurchaseOrders(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const po = await PurchaseOrdersService.getPurchaseOrderById(req.params.id);
      success(res, po);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const po = await PurchaseOrdersService.createPurchaseOrder(req.body);
      created(res, po);
    } catch (err) {
      next(err);
    }
  },

  async addItem(req, res, next) {
    try {
      const po = await PurchaseOrdersService.addItemToPo(req.params.id, req.body);
      created(res, po);
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const po = await PurchaseOrdersService.updatePoStatus(req.params.id, req.body.status);
      success(res, po);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = PurchaseOrdersController;
