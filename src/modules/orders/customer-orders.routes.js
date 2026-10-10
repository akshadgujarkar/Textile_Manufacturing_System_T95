'use strict';

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const CustomerOrdersController = require('./customer-orders.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createCustomerOrderSchema,
  updateOrderStatusSchema,
  listCustomerOrdersQuerySchema,
} = require('./customer-orders.validator');

const versionActionSchema = z.object({
  version: z.coerce.number().int().positive(),
});

router.get('/', validate({ query: listCustomerOrdersQuerySchema }), CustomerOrdersController.list);
router.get('/:id', validate({ params: idParam }), CustomerOrdersController.getById);
router.post('/', validate({ body: createCustomerOrderSchema }), CustomerOrdersController.create);
router.patch('/:id/status', validate({ params: idParam, body: updateOrderStatusSchema }), CustomerOrdersController.updateStatus);
router.post('/:id/confirm', validate({ params: idParam, body: versionActionSchema }), CustomerOrdersController.confirm);
router.post('/:id/cancel', validate({ params: idParam, body: versionActionSchema }), CustomerOrdersController.cancel);

module.exports = router;
