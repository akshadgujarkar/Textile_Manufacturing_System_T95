'use strict';

const WagesService = require('./wages.service');
const { success, created, paginated } = require('../../utils/response');

const WagesController = {
  async list(req, res, next) {
    try {
      const result = await WagesService.listWages(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const wage = await WagesService.getWageById(req.params.id);
      success(res, wage);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const wage = await WagesService.createWageRecord(req.body);
      created(res, wage);
    } catch (err) {
      next(err);
    }
  },

  async approve(req, res, next) {
    try {
      const wage = await WagesService.approveWage(req.params.id);
      success(res, wage);
    } catch (err) {
      next(err);
    }
  },

  async disburse(req, res, next) {
    try {
      const wage = await WagesService.disburseWage(req.params.id);
      success(res, wage);
    } catch (err) {
      next(err);
    }
  },

  async reverse(req, res, next) {
    try {
      const wage = await WagesService.reverseWage(req.params.id);
      success(res, wage);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = WagesController;
