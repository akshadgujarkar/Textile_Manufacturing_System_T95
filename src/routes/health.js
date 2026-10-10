'use strict';

const express = require('express');
const { checkDatabaseHealth } = require('../config/database');
const { success } = require('../utils/response');

const router = express.Router();

/**
 * GET /api/v1/health
 * Basic application health check.
 */
router.get('/health', (req, res) => {
  success(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Everest Textile Manufacturing System',
    version: '1.0.0',
  });
});

/**
 * GET /api/v1/health/database
 * Verifies the MySQL connection is alive.
 */
router.get('/health/database', async (req, res, next) => {
  try {
    const result = await checkDatabaseHealth();
    success(res, {
      status: 'ok',
      database: 'mysql',
      ...result,
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database connection failed',
      },
    });
  }
});

module.exports = router;
