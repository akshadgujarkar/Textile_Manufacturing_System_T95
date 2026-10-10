'use strict';

const YarnTypesService = require('./yarn-types.service');
const { success, created } = require('../../utils/response');

const YarnTypesController = {
  async list(req, res, next) {
    try {
      const types = await YarnTypesService.listYarnTypes(req.query);
      success(res, types);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const type = await YarnTypesService.getYarnTypeById(req.params.id);
      success(res, type);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const type = await YarnTypesService.createYarnType(req.body);
      created(res, type);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const type = await YarnTypesService.updateYarnType(req.params.id, req.body);
      success(res, type);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = YarnTypesController;
