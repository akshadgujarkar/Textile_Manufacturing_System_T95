'use strict';

const express = require('express');
const router = express.Router();
const WagesController = require('./wages.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createWageRecordSchema,
  listWagesQuerySchema,
} = require('./wages.validator');

router.get('/', validate({ query: listWagesQuerySchema }), WagesController.list);
router.get('/:id', validate({ params: idParam }), WagesController.getById);
router.post('/', validate({ body: createWageRecordSchema }), WagesController.create);
router.post('/:id/approve', validate({ params: idParam }), WagesController.approve);
router.post('/:id/disburse', validate({ params: idParam }), WagesController.disburse);
router.post('/:id/reverse', validate({ params: idParam }), WagesController.reverse);

module.exports = router;
