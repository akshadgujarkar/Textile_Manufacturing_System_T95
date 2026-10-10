'use strict';

const UnitsService = require('./units.service');
const { success, created } = require('../../utils/response');

const UnitsController = {
  async list(req, res, next) {
    try {
      const units = await UnitsService.listUnits();
      success(res, units);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const unit = await UnitsService.getUnitById(req.params.id);
      success(res, unit);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const unit = await UnitsService.createUnit(req.body);
      created(res, unit);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const unit = await UnitsService.updateUnit(req.params.id, req.body);
      success(res, unit);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = UnitsController;
