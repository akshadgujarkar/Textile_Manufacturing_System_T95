'use strict';

const FabricRollsRepository = require('./fabric-rolls.repository');
const ProductionJobsRepository = require('../production/production-jobs.repository');
const EmployeeRepository = require('../employees/employees.repository');
const { createError } = require('../../utils/response');

const FabricRollsService = {
  async listFabricRolls(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await FabricRollsRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
      job_id: query.job_id,
      status: query.status,
    });

    return { data: rows, total, page, pageSize };
  },

  async getFabricRollById(rollId) {
    const roll = await FabricRollsRepository.findById(rollId);
    if (!roll) {
      throw createError(`Fabric roll with ID ${rollId} not found`, 404, 'NOT_FOUND');
    }
    return roll;
  },

  async createFabricRoll(data) {
    // Validate job
    const job = await ProductionJobsRepository.findById(data.job_id);
    if (!job) {
      throw createError(`Production job with ID ${data.job_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Validate operator
    const operator = await EmployeeRepository.findById(data.operator_id);
    if (!operator) {
      throw createError(`Operator with ID ${data.operator_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Unique roll_code
    const existing = await FabricRollsRepository.findByRollCode(data.roll_code);
    if (existing) {
      throw createError(`Roll code "${data.roll_code}" already exists`, 409, 'DUPLICATE_ROLL_CODE');
    }

    const rollId = await FabricRollsRepository.create(data);
    return this.getFabricRollById(rollId);
  },

  async updateRollStatus(rollId, { status, version }) {
    await this.getFabricRollById(rollId);

    const updated = await FabricRollsRepository.updateStatusWithVersion(rollId, status, version);
    if (!updated) {
      throw createError(
        `Optimistic lock failure on fabric roll #${rollId} (version mismatch)`,
        409,
        'CONCURRENCY_CONFLICT'
      );
    }

    return this.getFabricRollById(rollId);
  },
};

module.exports = FabricRollsService;
