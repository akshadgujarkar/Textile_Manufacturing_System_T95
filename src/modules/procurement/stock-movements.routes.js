'use strict';

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const StockMovementsController = require('./stock-movements.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createMovementSchema,
  reverseMovementSchema,
  listStockMovementsQuerySchema,
} = require('./stock-movements.validator');

router.get('/reorder-alerts', StockMovementsController.reorderAlerts);
router.get('/', validate({ query: listStockMovementsQuerySchema }), StockMovementsController.list);
router.get('/:id', validate({ params: idParam }), StockMovementsController.getById);
router.post('/', validate({ body: createMovementSchema }), StockMovementsController.create);
router.post('/:id/reverse', validate({ params: idParam, body: reverseMovementSchema }), StockMovementsController.reverse);

module.exports = router;
