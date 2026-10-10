'use strict';

const QcInspectionsService = require('./qc-inspections.service');
const { success, created, paginated } = require('../../utils/response');

const QcInspectionsController = {
  async list(req, res, next) {
    try {
      const result = await QcInspectionsService.listInspections(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const inspection = await QcInspectionsService.getInspectionById(req.params.id);
      success(res, inspection);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const inspection = await QcInspectionsService.createInspection(req.body);
      created(res, inspection);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = QcInspectionsController;
