'use strict';

const express = require('express');
const router = express.Router();
const InvoicesController = require('./invoices.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createInvoiceSchema,
  transitionInvoiceSchema,
  listInvoicesQuerySchema,
} = require('./invoices.validator');

router.get('/', validate({ query: listInvoicesQuerySchema }), InvoicesController.list);
router.get('/:id', validate({ params: idParam }), InvoicesController.getById);
router.post('/', validate({ body: createInvoiceSchema }), InvoicesController.create);
router.post('/:id/issue', validate({ params: idParam, body: transitionInvoiceSchema }), InvoicesController.issue);
router.post('/:id/void', validate({ params: idParam, body: transitionInvoiceSchema }), InvoicesController.voidInvoice);

module.exports = router;
