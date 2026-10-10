'use strict';

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const DispatchesController = require('./dispatches.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createDispatchSchema,
  scanRollSchema,
  transitionDispatchSchema,
  listDispatchesQuerySchema,
} = require('./dispatches.validator');

const itemParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
});

router.get('/', validate({ query: listDispatchesQuerySchema }), DispatchesController.list);
router.get('/:id', validate({ params: idParam }), DispatchesController.getById);
router.post('/', validate({ body: createDispatchSchema }), DispatchesController.create);
router.post('/:id/items', validate({ params: idParam, body: scanRollSchema }), DispatchesController.scanRoll);
router.post('/:id/items/:itemId/remove', validate({ params: itemParamSchema }), DispatchesController.removeRoll);
router.post('/:id/dispatch', validate({ params: idParam, body: transitionDispatchSchema }), DispatchesController.dispatch);
router.post('/:id/cancel', validate({ params: idParam, body: transitionDispatchSchema }), DispatchesController.cancel);

module.exports = router;
