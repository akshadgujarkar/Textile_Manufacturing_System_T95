'use strict';

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const YarnTypesController = require('./yarn-types.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');

const createYarnTypeSchema = z.object({
  name: z.string().min(1).max(100),
  fiber_content: z.string().max(100).optional().nullable(),
  nominal_count: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
});

const updateYarnTypeSchema = createYarnTypeSchema.partial().omit({ name: true });

router.get('/', YarnTypesController.list);
router.get('/:id', validate({ params: idParam }), YarnTypesController.getById);
router.post('/', validate({ body: createYarnTypeSchema }), YarnTypesController.create);
router.patch('/:id', validate({ params: idParam, body: updateYarnTypeSchema }), YarnTypesController.update);

module.exports = router;
