'use strict';

const BuyerPaymentsService = require('./buyer-payments.service');
const { success, created, paginated } = require('../../utils/response');

const BuyerPaymentsController = {
  async list(req, res, next) {
    try {
      const result = await BuyerPaymentsService.listPayments(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const payment = await BuyerPaymentsService.getPaymentById(req.params.id);
      success(res, payment);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const payment = await BuyerPaymentsService.recordPayment(req.body);
      created(res, payment);
    } catch (err) {
      next(err);
    }
  },

  async reverse(req, res, next) {
    try {
      const payment = await BuyerPaymentsService.reversePayment(req.params.id);
      success(res, payment);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = BuyerPaymentsController;
