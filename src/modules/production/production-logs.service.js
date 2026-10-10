'use strict';

const ProductionLogsRepository = require('./production-logs.repository');
const ProductionJobsRepository = require('./production-jobs.repository');
const EmployeeRepository = require('../employees/employees.repository');
const { createError } = require('../../utils/response');

const ProductionLogsService = {
  async listLogs(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await ProductionLogsRepository.findAll({
      limit: pageSize,
      offset,
      job_id: query.job_id,
      operator_id: query.operator_id,
      shift_code: query.shift_code,
    });

    return { data: rows, total, page, pageSize };
  },

  async getLogById(logId) {
    const log = await ProductionLogsRepository.findById(logId);
    if (!log) {
      throw createError(`Production log with ID ${logId} not found`, 404, 'NOT_FOUND');
    }
    return log;
  },

  async createLog(data) {
    // 1. Idempotency Guard check: if client_request_id already logged, return existing
    const existingReq = await ProductionLogsRepository.findByClientRequestId(data.client_request_id);
    if (existingReq) {
      return ProductionLogsRepository.findById(existingReq.log_id);
    }

    // 2. Validate job exists
    const job = await ProductionJobsRepository.findById(data.job_id);
    if (!job) {
      throw createError(`Production job with ID ${data.job_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // 3. Validate operator employee exists
    const operator = await EmployeeRepository.findById(data.operator_id);
    if (!operator) {
      throw createError(`Operator employee with ID ${data.operator_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    const logId = await ProductionLogsRepository.create(data);
    return this.getLogById(logId);
  },
};

module.exports = ProductionLogsService;
