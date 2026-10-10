'use strict';

const ProcessStagesRepository = require('./process-stages.repository');
const { createError } = require('../../utils/response');

const ProcessStagesService = {
  async listProcessStages() {
    return ProcessStagesRepository.findAll();
  },

  async getProcessStageById(stageId) {
    const stage = await ProcessStagesRepository.findById(stageId);
    if (!stage) {
      throw createError(`Process stage with ID ${stageId} not found`, 404, 'NOT_FOUND');
    }
    return stage;
  },

  async createProcessStage(data) {
    const existingName = await ProcessStagesRepository.findByName(data.name);
    if (existingName) {
      throw createError(`Process stage with name "${data.name}" already exists`, 409, 'DUPLICATE_NAME');
    }
    return ProcessStagesRepository.create(data);
  },

  async updateProcessStage(stageId, data) {
    await this.getProcessStageById(stageId);
    return ProcessStagesRepository.update(stageId, data);
  },
};

module.exports = ProcessStagesService;
