'use strict';

const InvoicesService = require('./invoices.service');
const { success, created, paginated } = require('../../utils/response');

const InvoicesController = {
  async list(req, res, next) {
    try {
      const result = await InvoicesService.listInvoices(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const invoice = await InvoicesService.getInvoiceById(req.params.id);
      success(res, invoice);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const invoice = await InvoicesService.createInvoice(req.body);
      created(res, invoice);
    } catch (err) {
      next(err);
    }
  },

  async issue(req, res, next) {
    try {
      const invoice = await InvoicesService.issueInvoice(req.params.id, req.body);
      success(res, invoice);
    } catch (err) {
      next(err);
    }
  },

  async voidInvoice(req, res, next) {
    try {
      const invoice = await InvoicesService.voidInvoice(req.params.id, req.body);
      success(res, invoice);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = InvoicesController;
