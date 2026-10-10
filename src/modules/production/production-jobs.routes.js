'use strict';

const express = require('express');
const router = express.Router();
const ProductionJobsController = require('./production-jobs.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createProductionJobSchema,
  transitionJobSchema,
  listProductionJobsQuerySchema,
} = require('./production-jobs.validator');

router.get('/', validate({ query: listProductionJobsQuerySchema }), ProductionJobsController.list);
router.get('/:id', validate({ params: idParam }), ProductionJobsController.getById);
router.post('/', validate({ body: createProductionJobSchema }), ProductionJobsController.create);
router.post('/:id/start', validate({ params: idParam, body: transitionJobSchema }), ProductionJobsController.start);
router.post('/:id/complete', validate({ params: idParam, body: transitionJobSchema }), ProductionJobsController.complete);
router.post('/:id/cancel', validate({ params: idParam, body: transitionJobSchema }), ProductionJobsController.cancel);

module.exports = router;
