'use strict';

const YarnItemsRepository = require('./yarn-items.repository');
const YarnTypesRepository = require('./yarn-types.repository');
const UnitsRepository = require('./units.repository');
const { createError } = require('../../utils/response');

const YarnItemsService = {
  async listYarnItems(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await YarnItemsRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
      yarn_type_id: query.yarn_type_id,
      is_active: query.is_active,
    });

    return { data: rows, total, page, pageSize };
  },

  async getYarnItemById(yarnItemId) {
    const item = await YarnItemsRepository.findById(yarnItemId);
    if (!item) {
      throw createError(`Yarn item with ID ${yarnItemId} not found`, 404, 'NOT_FOUND');
    }
    return item;
  },

  async createYarnItem(data) {
    // Validate yarn_type_id
    const type = await YarnTypesRepository.findById(data.yarn_type_id);
    if (!type) {
      throw createError(`Yarn type with ID ${data.yarn_type_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Validate unit_id
    const unit = await UnitsRepository.findById(data.unit_id);
    if (!unit) {
      throw createError(`Unit of measure with ID ${data.unit_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Check unique (yarn_type_id, colour_code)
    const existing = await YarnItemsRepository.findByTypeAndColour(data.yarn_type_id, data.colour_code);
    if (existing) {
      throw createError(`Yarn item with type ${data.yarn_type_id} and colour "${data.colour_code}" already exists`, 409, 'DUPLICATE_ITEM');
    }

    return YarnItemsRepository.create(data);
  },

  async updateYarnItem(yarnItemId, data) {
    await this.getYarnItemById(yarnItemId);
    return YarnItemsRepository.update(yarnItemId, data);
  },

  async getStockBalance(yarnItemId) {
    await this.getYarnItemById(yarnItemId);
    return YarnItemsRepository.getStockBalance(yarnItemId);
  },

  async getStockLedger(yarnItemId, query = {}) {
    await this.getYarnItemById(yarnItemId);
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 50));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await YarnItemsRepository.getStockLedger(yarnItemId, {
      limit: pageSize,
      offset,
    });

    return { data: rows, total, page, pageSize };
  },
};

module.exports = YarnItemsService;
