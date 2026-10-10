'use strict';

const CostEntriesRepository = require('./cost-entries.repository');
const CustomerOrdersRepository = require('../orders/customer-orders.repository');
const MachinesRepository = require('../inventory/machines.repository');
const FabricRollsRepository = require('../quality/fabric-rolls.repository');
const { createError } = require('../../utils/response');

const CostEntriesService = {
  async listCostEntries(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await CostEntriesRepository.findAll({
      limit: pageSize,
      offset,
      cost_type: query.cost_type,
      order_id: query.order_id,
      machine_id: query.machine_id,
      roll_id: query.roll_id,
      from_date: query.from_date,
      to_date: query.to_date,
    });

    return { data: rows, total, page, pageSize };
  },

  async getCostEntryById(costId) {
    const entry = await CostEntriesRepository.findById(costId);
    if (!entry) {
      throw createError(`Cost entry with ID ${costId} not found`, 404, 'NOT_FOUND');
    }
    return entry;
  },

  async createCostEntry(data) {
    // Validate optional references if provided
    if (data.order_id) {
      const order = await CustomerOrdersRepository.findById(data.order_id);
      if (!order) {
        throw createError(`Customer order with ID ${data.order_id} does not exist`, 400, 'INVALID_REFERENCE');
      }
    }
    if (data.machine_id) {
      const machine = await MachinesRepository.findById(data.machine_id);
      if (!machine) {
        throw createError(`Machine with ID ${data.machine_id} does not exist`, 400, 'INVALID_REFERENCE');
      }
    }
    if (data.roll_id) {
      const roll = await FabricRollsRepository.findById(data.roll_id);
      if (!roll) {
        throw createError(`Fabric roll with ID ${data.roll_id} does not exist`, 400, 'INVALID_REFERENCE');
      }
    }

    return CostEntriesRepository.create(data);
  },
};

module.exports = CostEntriesService;
