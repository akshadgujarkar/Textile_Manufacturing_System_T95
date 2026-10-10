'use strict';

const FabricRollsService = require('./fabric-rolls.service');
const { success, created, paginated } = require('../../utils/response');

const FabricRollsController = {
  async list(req, res, next) {
    try {
      const result = await FabricRollsService.listFabricRolls(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const roll = await FabricRollsService.getFabricRollById(req.params.id);
      success(res, roll);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const roll = await FabricRollsService.createFabricRoll(req.body);
      created(res, roll);
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const roll = await FabricRollsService.updateRollStatus(req.params.id, req.body);
      success(res, roll);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = FabricRollsController;
