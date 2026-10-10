'use strict';

const express = require('express');
const router = express.Router();
const FabricRollsController = require('./fabric-rolls.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createFabricRollSchema,
  updateRollStatusSchema,
  listFabricRollsQuerySchema,
} = require('./fabric-rolls.validator');

router.get('/', validate({ query: listFabricRollsQuerySchema }), FabricRollsController.list);
router.get('/:id', validate({ params: idParam }), FabricRollsController.getById);
router.post('/', validate({ body: createFabricRollSchema }), FabricRollsController.create);
router.patch('/:id/status', validate({ params: idParam, body: updateRollStatusSchema }), FabricRollsController.updateStatus);

module.exports = router;
