'use strict';

const express = require('express');
const router = express.Router();
const BuyerPaymentsController = require('./buyer-payments.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createBuyerPaymentSchema,
  listBuyerPaymentsQuerySchema,
} = require('./buyer-payments.validator');

router.get('/', validate({ query: listBuyerPaymentsQuerySchema }), BuyerPaymentsController.list);
router.get('/:id', validate({ params: idParam }), BuyerPaymentsController.getById);
router.post('/', validate({ body: createBuyerPaymentSchema }), BuyerPaymentsController.create);
router.post('/:id/reverse', validate({ params: idParam }), BuyerPaymentsController.reverse);

module.exports = router;
