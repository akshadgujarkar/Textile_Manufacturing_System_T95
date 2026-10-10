'use strict';

const SupplierService = require('./suppliers.service');
const { success, created, paginated } = require('../../utils/response');

const SupplierController = {
  async list(req, res, next) {
    try {
      const result = await SupplierService.listSuppliers(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const sup = await SupplierService.getSupplierById(req.params.id);
      success(res, sup);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const sup = await SupplierService.createSupplier(req.body);
      created(res, sup);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const sup = await SupplierService.updateSupplier(req.params.id, req.body);
      success(res, sup);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = SupplierController;
