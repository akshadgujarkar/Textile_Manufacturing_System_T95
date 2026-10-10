'use strict';

const StockMovementsService = require('./stock-movements.service');
const { success, created, paginated } = require('../../utils/response');

const StockMovementsController = {
  async list(req, res, next) {
    try {
      const result = await StockMovementsService.listMovements(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const mov = await StockMovementsService.getMovementById(req.params.id);
      success(res, mov);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const mov = await StockMovementsService.createMovement(req.body);
      created(res, mov);
    } catch (err) {
      next(err);
    }
  },

  async reverse(req, res, next) {
    try {
      const mov = await StockMovementsService.reverseMovement(req.params.id, req.body);
      created(res, mov);
    } catch (err) {
      next(err);
    }
  },

  async reorderAlerts(req, res, next) {
    try {
      const alerts = await StockMovementsService.getReorderAlerts();
      success(res, alerts);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = StockMovementsController;
