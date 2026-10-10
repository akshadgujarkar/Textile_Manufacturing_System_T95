'use strict';

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const UnitsController = require('./units.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');

const createUnitSchema = z.object({
  unit_code: z.string().min(1).max(10),
  description: z.string().max(50).optional().nullable(),
});

const updateUnitSchema = createUnitSchema.partial().omit({ unit_code: true });

router.get('/', UnitsController.list);
router.get('/:id', validate({ params: idParam }), UnitsController.getById);
router.post('/', validate({ body: createUnitSchema }), UnitsController.create);
router.patch('/:id', validate({ params: idParam, body: updateUnitSchema }), UnitsController.update);

module.exports = router;
