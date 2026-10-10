'use strict';

const MachinesRepository = require('./machines.repository');
const ProcessStagesRepository = require('./process-stages.repository');
const { createError } = require('../../utils/response');

const MachinesService = {
  async listMachines(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await MachinesRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
      stage_id: query.stage_id,
      current_status: query.current_status,
      is_active: query.is_active,
    });

    return { data: rows, total, page, pageSize };
  },

  async getMachineById(machineId) {
    const machine = await MachinesRepository.findById(machineId);
    if (!machine) {
      throw createError(`Machine with ID ${machineId} not found`, 404, 'NOT_FOUND');
    }
    return machine;
  },

  async createMachine(data) {
    const stage = await ProcessStagesRepository.findById(data.stage_id);
    if (!stage) {
      throw createError(`Process stage with ID ${data.stage_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    const existing = await MachinesRepository.findByCode(data.machine_code);
    if (existing) {
      throw createError(`Machine code "${data.machine_code}" already exists`, 409, 'DUPLICATE_CODE');
    }

    return MachinesRepository.create(data);
  },

  async updateMachine(machineId, data) {
    await this.getMachineById(machineId);
    if (data.stage_id) {
      const stage = await ProcessStagesRepository.findById(data.stage_id);
      if (!stage) {
        throw createError(`Process stage with ID ${data.stage_id} does not exist`, 400, 'INVALID_REFERENCE');
      }
    }
    return MachinesRepository.update(machineId, data);
  },
};

module.exports = MachinesService;
