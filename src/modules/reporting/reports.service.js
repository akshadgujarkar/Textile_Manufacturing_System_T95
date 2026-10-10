'use strict';

const ReportsRepository = require('./reports.repository');
const StockMovementsRepository = require('../procurement/stock-movements.repository');

const ReportsService = {
  async getInventorySummary() {
    return ReportsRepository.getInventorySummary();
  },

  async getReorderAlerts() {
    return StockMovementsRepository.getReorderAlerts();
  },

  async getOrderProgress(query) {
    return ReportsRepository.getOrderProgress(query);
  },

  async getProductionOutput(query) {
    return ReportsRepository.getProductionOutputSummary(query);
  },

  async getRollQuality() {
    return ReportsRepository.getRollQualitySummary();
  },

  async getInvoiceOutstanding(query) {
    return ReportsRepository.getInvoiceOutstandingSummary(query);
  },

  async getCostByOrder(query) {
    return ReportsRepository.getCostByOrderSummary(query);
  },

  async getCostByMachine(query) {
    return ReportsRepository.getCostByMachineSummary(query);
  },

  async getWageSummary(query) {
    return ReportsRepository.getWageSummary(query);
  },

  async getReconciliationReport() {
    return ReportsRepository.getReconciliationReport();
  },
};

module.exports = ReportsService;
