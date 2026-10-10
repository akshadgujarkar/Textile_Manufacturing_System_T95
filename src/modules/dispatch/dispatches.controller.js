'use strict';

const DispatchesService = require('./dispatches.service');
const { success, created, paginated } = require('../../utils/response');

const DispatchesController = {
  async list(req, res, next) {
    try {
      const result = await DispatchesService.listDispatches(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const dispatch = await DispatchesService.getDispatchById(req.params.id);
      success(res, dispatch);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const dispatch = await DispatchesService.createDispatch(req.body);
      created(res, dispatch);
    } catch (err) {
      next(err);
    }
  },

  async scanRoll(req, res, next) {
    try {
      const dispatch = await DispatchesService.scanRollToDispatch(req.params.id, req.body);
      created(res, dispatch);
    } catch (err) {
      next(err);
    }
  },

  async removeRoll(req, res, next) {
    try {
      const dispatch = await DispatchesService.removeRollFromDispatch(req.params.id, req.params.itemId);
      success(res, dispatch);
    } catch (err) {
      next(err);
    }
  },

  async dispatch(req, res, next) {
    try {
      const dispatch = await DispatchesService.completeDispatch(req.params.id, req.body);
      success(res, dispatch);
    } catch (err) {
      next(err);
    }
  },

  async cancel(req, res, next) {
    try {
      const dispatch = await DispatchesService.cancelDispatch(req.params.id, req.body);
      success(res, dispatch);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = DispatchesController;
