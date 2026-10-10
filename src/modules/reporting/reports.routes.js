'use strict';

const express = require('express');
const router = express.Router();
const ReportsController = require('./reports.controller');

router.get('/inventory-summary', ReportsController.inventorySummary);
router.get('/reorder-alerts', ReportsController.reorderAlerts);
router.get('/order-progress', ReportsController.orderProgress);
router.get('/production-output', ReportsController.productionOutput);
router.get('/roll-quality', ReportsController.rollQuality);
router.get('/invoice-outstanding', ReportsController.invoiceOutstanding);
router.get('/cost-by-order', ReportsController.costByOrder);
router.get('/cost-by-machine', ReportsController.costByMachine);
router.get('/wage-summary', ReportsController.wageSummary);
router.get('/reconciliation', ReportsController.reconciliation);

module.exports = router;
