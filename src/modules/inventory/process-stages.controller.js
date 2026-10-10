'use strict';

const ProcessStagesService = require('./process-stages.service');
const { success, created } = require('../../utils/response');

const ProcessStagesController = {
  async list(req, res, next) {
    try {
      const stages = await ProcessStagesService.listProcessStages();
      success(res, stages);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const stage = await ProcessStagesService.getProcessStageById(req.params.id);
      success(res, stage);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const stage = await ProcessStagesService.createProcessStage(req.body);
      created(res, stage);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const stage = await ProcessStagesService.updateProcessStage(req.params.id, req.body);
      success(res, stage);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ProcessStagesController;
