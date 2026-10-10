'use strict';

const ProductionLogsService = require('./production-logs.service');
const { success, created, paginated } = require('../../utils/response');

const ProductionLogsController = {
  async list(req, res, next) {
    try {
      const result = await ProductionLogsService.listLogs(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const log = await ProductionLogsService.getLogById(req.params.id);
      success(res, log);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const log = await ProductionLogsService.createLog(req.body);
      created(res, log);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ProductionLogsController;
