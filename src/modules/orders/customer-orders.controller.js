'use strict';

const CustomerOrdersService = require('./customer-orders.service');
const { success, created, paginated } = require('../../utils/response');

const CustomerOrdersController = {
  async list(req, res, next) {
    try {
      const result = await CustomerOrdersService.listCustomerOrders(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const order = await CustomerOrdersService.getCustomerOrderById(req.params.id);
      success(res, order);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const order = await CustomerOrdersService.createCustomerOrder(req.body);
      created(res, order);
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const order = await CustomerOrdersService.updateOrderStatus(req.params.id, req.body);
      success(res, order);
    } catch (err) {
      next(err);
    }
  },

  async confirm(req, res, next) {
    try {
      const order = await CustomerOrdersService.confirmOrder(req.params.id, req.body);
      success(res, order);
    } catch (err) {
      next(err);
    }
  },

  async cancel(req, res, next) {
    try {
      const order = await CustomerOrdersService.cancelOrder(req.params.id, req.body);
      success(res, order);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = CustomerOrdersController;
