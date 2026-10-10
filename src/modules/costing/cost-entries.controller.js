'use strict';

const CostEntriesService = require('./cost-entries.service');
const { success, created, paginated } = require('../../utils/response');

const CostEntriesController = {
  async list(req, res, next) {
    try {
      const result = await CostEntriesService.listCostEntries(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const entry = await CostEntriesService.getCostEntryById(req.params.id);
      success(res, entry);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const entry = await CostEntriesService.createCostEntry(req.body);
      created(res, entry);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = CostEntriesController;
