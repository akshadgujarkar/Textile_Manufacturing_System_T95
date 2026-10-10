'use strict';

const YarnTypesRepository = require('./yarn-types.repository');
const { createError } = require('../../utils/response');

const YarnTypesService = {
  async listYarnTypes(query = {}) {
    return YarnTypesRepository.findAll(query);
  },

  async getYarnTypeById(yarnTypeId) {
    const type = await YarnTypesRepository.findById(yarnTypeId);
    if (!type) {
      throw createError(`Yarn type with ID ${yarnTypeId} not found`, 404, 'NOT_FOUND');
    }
    return type;
  },

  async createYarnType(data) {
    const existing = await YarnTypesRepository.findByName(data.name);
    if (existing) {
      throw createError(`Yarn type with name "${data.name}" already exists`, 409, 'DUPLICATE_NAME');
    }
    return YarnTypesRepository.create(data);
  },

  async updateYarnType(yarnTypeId, data) {
    await this.getYarnTypeById(yarnTypeId);
    return YarnTypesRepository.update(yarnTypeId, data);
  },
};

module.exports = YarnTypesService;
