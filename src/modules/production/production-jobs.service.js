'use strict';

const ProductionJobsRepository = require('./production-jobs.repository');
const MachinesRepository = require('../inventory/machines.repository');
const ProcessStagesRepository = require('../inventory/process-stages.repository');
const { withTransaction } = require('../../config/database');
const { createError } = require('../../utils/response');

const ProductionJobsService = {
  async listJobs(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await ProductionJobsRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
      stage_id: query.stage_id,
      machine_id: query.machine_id,
      status: query.status,
    });

    return { data: rows, total, page, pageSize };
  },

  async getJobById(jobId) {
    const job = await ProductionJobsRepository.findById(jobId);
    if (!job) {
      throw createError(`Production job with ID ${jobId} not found`, 404, 'NOT_FOUND');
    }
    return job;
  },

  async createJob(data) {
    // Validate stage
    const stage = await ProcessStagesRepository.findById(data.stage_id);
    if (!stage) {
      throw createError(`Process stage with ID ${data.stage_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Validate machine
    const machine = await MachinesRepository.findById(data.machine_id);
    if (!machine) {
      throw createError(`Machine with ID ${data.machine_id} does not exist`, 400, 'INVALID_REFERENCE');
    }
    if (machine.stage_id !== data.stage_id) {
      throw createError(
        `Machine #${data.machine_id} is assigned to stage #${machine.stage_id}, not requested stage #${data.stage_id}`,
        400,
        'MACHINE_STAGE_MISMATCH'
      );
    }

    // Check unique job_no
    const existing = await ProductionJobsRepository.findByJobNo(data.job_no);
    if (existing) {
      throw createError(`Job number "${data.job_no}" already exists`, 409, 'DUPLICATE_JOB_NO');
    }

    const jobId = await ProductionJobsRepository.create(data);
    return this.getJobById(jobId);
  },

  async startJob(jobId, { version }) {
    const job = await this.getJobById(jobId);
    if (job.status !== 'planned' && job.status !== 'interrupted') {
      throw createError(`Cannot start job from "${job.status}" state`, 400, 'INVALID_STATUS_TRANSITION');
    }

    return withTransaction(async (conn) => {
      const updated = await ProductionJobsRepository.updateStatusWithVersion(jobId, {
        status: 'running',
        started_at: job.started_at || new Date(),
        expectedVersion: version,
      }, conn);

      if (!updated) {
        throw createError(
          `Optimistic lock failure on job #${jobId} (version mismatch)`,
          409,
          'CONCURRENCY_CONFLICT'
        );
      }

      // Update machine status to running
      await MachinesRepository.update(job.machine_id, { current_status: 'running' });

      return ProductionJobsRepository.findById(jobId);
    });
  },

  async completeJob(jobId, { version }) {
    const job = await this.getJobById(jobId);
    if (job.status !== 'running') {
      throw createError(`Cannot complete job from "${job.status}" state (must be running)`, 400, 'INVALID_STATUS_TRANSITION');
    }

    return withTransaction(async (conn) => {
      const updated = await ProductionJobsRepository.updateStatusWithVersion(jobId, {
        status: 'completed',
        ended_at: new Date(),
        expectedVersion: version,
      }, conn);

      if (!updated) {
        throw createError(
          `Optimistic lock failure on job #${jobId} (version mismatch)`,
          409,
          'CONCURRENCY_CONFLICT'
        );
      }

      // Free machine back to idle
      await MachinesRepository.update(job.machine_id, { current_status: 'idle' });

      return ProductionJobsRepository.findById(jobId);
    });
  },

  async cancelJob(jobId, { version }) {
    const job = await this.getJobById(jobId);
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw createError(`Cannot cancel a ${job.status} job`, 400, 'INVALID_STATUS_TRANSITION');
    }

    return withTransaction(async (conn) => {
      const updated = await ProductionJobsRepository.updateStatusWithVersion(jobId, {
        status: 'cancelled',
        ended_at: new Date(),
        expectedVersion: version,
      }, conn);

      if (!updated) {
        throw createError(
          `Optimistic lock failure on job #${jobId} (version mismatch)`,
          409,
          'CONCURRENCY_CONFLICT'
        );
      }

      // Free machine back to idle
      await MachinesRepository.update(job.machine_id, { current_status: 'idle' });

      return ProductionJobsRepository.findById(jobId);
    });
  },
};

module.exports = ProductionJobsService;
