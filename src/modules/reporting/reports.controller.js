'use strict';

const ReportsService = require('./reports.service');
const { success } = require('../../utils/response');

const ReportsController = {
  async inventorySummary(req, res, next) {
    try {
      const summary = await ReportsService.getInventorySummary();
      success(res, summary);
    } catch (err) {
      next(err);
    }
  },

  async reorderAlerts(req, res, next) {
    try {
      const alerts = await ReportsService.getReorderAlerts();
      success(res, alerts);
    } catch (err) {
      next(err);
    }
  },

  async orderProgress(req, res, next) {
    try {
      const progress = await ReportsService.getOrderProgress(req.query);
      success(res, progress);
    } catch (err) {
      next(err);
    }
  },

  async productionOutput(req, res, next) {
    try {
      const output = await ReportsService.getProductionOutput(req.query);
      success(res, output);
    } catch (err) {
      next(err);
    }
  },

  async rollQuality(req, res, next) {
    try {
      const quality = await ReportsService.getRollQuality();
      success(res, quality);
    } catch (err) {
      next(err);
    }
  },

  async invoiceOutstanding(req, res, next) {
    try {
      const outstanding = await ReportsService.getInvoiceOutstanding(req.query);
      success(res, outstanding);
    } catch (err) {
      next(err);
    }
  },

  async costByOrder(req, res, next) {
    try {
      const cost = await ReportsService.getCostByOrder(req.query);
      success(res, cost);
    } catch (err) {
      next(err);
    }
  },

  async costByMachine(req, res, next) {
    try {
      const cost = await ReportsService.getCostByMachine(req.query);
      success(res, cost);
    } catch (err) {
      next(err);
    }
  },

  async wageSummary(req, res, next) {
    try {
      const summary = await ReportsService.getWageSummary(req.query);
      success(res, summary);
    } catch (err) {
      next(err);
    }
  },

  async reconciliation(req, res, next) {
    try {
      const report = await ReportsService.getReconciliationReport();
      success(res, report);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ReportsController;
