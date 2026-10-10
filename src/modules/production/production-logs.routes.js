'use strict';

const express = require('express');
const router = express.Router();
const ProductionLogsController = require('./production-logs.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createProductionLogSchema,
  listProductionLogsQuerySchema,
} = require('./production-logs.validator');

router.get('/', validate({ query: listProductionLogsQuerySchema }), ProductionLogsController.list);
router.get('/:id', validate({ params: idParam }), ProductionLogsController.getById);
router.post('/', validate({ body: createProductionLogSchema }), ProductionLogsController.create);

module.exports = router;
