'use strict';

const express = require('express');
const router = express.Router();
const CostEntriesController = require('./cost-entries.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createCostEntrySchema,
  listCostEntriesQuerySchema,
} = require('./cost-entries.validator');

router.get('/', validate({ query: listCostEntriesQuerySchema }), CostEntriesController.list);
router.get('/:id', validate({ params: idParam }), CostEntriesController.getById);
router.post('/', validate({ body: createCostEntrySchema }), CostEntriesController.create);

module.exports = router;
