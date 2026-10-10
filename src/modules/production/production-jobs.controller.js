'use strict';

const ProductionJobsService = require('./production-jobs.service');
const { success, created, paginated } = require('../../utils/response');

const ProductionJobsController = {
  async list(req, res, next) {
    try {
      const result = await ProductionJobsService.listJobs(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const job = await ProductionJobsService.getJobById(req.params.id);
      success(res, job);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const job = await ProductionJobsService.createJob(req.body);
      created(res, job);
    } catch (err) {
      next(err);
    }
  },

  async start(req, res, next) {
    try {
      const job = await ProductionJobsService.startJob(req.params.id, req.body);
      success(res, job);
    } catch (err) {
      next(err);
    }
  },

  async complete(req, res, next) {
    try {
      const job = await ProductionJobsService.completeJob(req.params.id, req.body);
      success(res, job);
    } catch (err) {
      next(err);
    }
  },

  async cancel(req, res, next) {
    try {
      const job = await ProductionJobsService.cancelJob(req.params.id, req.body);
      success(res, job);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ProductionJobsController;
