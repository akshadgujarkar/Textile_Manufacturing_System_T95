'use strict';

const UnitsRepository = require('./units.repository');
const { createError } = require('../../utils/response');

const UnitsService = {
  async listUnits() {
    return UnitsRepository.findAll();
  },

  async getUnitById(unitId) {
    const unit = await UnitsRepository.findById(unitId);
    if (!unit) {
      throw createError(`Unit of measure with ID ${unitId} not found`, 404, 'NOT_FOUND');
    }
    return unit;
  },

  async createUnit(data) {
    const existing = await UnitsRepository.findByCode(data.unit_code);
    if (existing) {
      throw createError(`Unit code "${data.unit_code}" already exists`, 409, 'DUPLICATE_CODE');
    }
    return UnitsRepository.create(data);
  },

  async updateUnit(unitId, data) {
    await this.getUnitById(unitId);
    return UnitsRepository.update(unitId, data);
  },
};

module.exports = UnitsService;
