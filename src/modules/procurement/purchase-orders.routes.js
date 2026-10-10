'use strict';

const express = require('express');
const router = express.Router();
const PurchaseOrdersController = require('./purchase-orders.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createPurchaseOrderSchema,
  addPoItemSchema,
  updatePoStatusSchema,
  listPurchaseOrdersQuerySchema,
} = require('./purchase-orders.validator');

router.get('/', validate({ query: listPurchaseOrdersQuerySchema }), PurchaseOrdersController.list);
router.get('/:id', validate({ params: idParam }), PurchaseOrdersController.getById);
router.post('/', validate({ body: createPurchaseOrderSchema }), PurchaseOrdersController.create);
router.post('/:id/items', validate({ params: idParam, body: addPoItemSchema }), PurchaseOrdersController.addItem);
router.patch('/:id/status', validate({ params: idParam, body: updatePoStatusSchema }), PurchaseOrdersController.updateStatus);

module.exports = router;
