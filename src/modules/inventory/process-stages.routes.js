'use strict';

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const ProcessStagesController = require('./process-stages.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');

const createProcessStageSchema = z.object({
  name: z.string().min(1).max(50),
  sequence_hint: z.coerce.number().int().positive(),
});

const updateProcessStageSchema = createProcessStageSchema.partial().omit({ name: true });

router.get('/', ProcessStagesController.list);
router.get('/:id', validate({ params: idParam }), ProcessStagesController.getById);
router.post('/', validate({ body: createProcessStageSchema }), ProcessStagesController.create);
router.patch('/:id', validate({ params: idParam, body: updateProcessStageSchema }), ProcessStagesController.update);

module.exports = router;
