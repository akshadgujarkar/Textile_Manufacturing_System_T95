'use strict';

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const QcDefectsController = require('./qc-defects.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');

const listDefectsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  inspection_id: z.coerce.number().int().positive().optional(),
  defect_code: z.string().max(30).optional(),
  severity: z.enum(['minor', 'major', 'critical']).optional(),
});

router.get('/', validate({ query: listDefectsQuerySchema }), QcDefectsController.list);
router.get('/:id', validate({ params: idParam }), QcDefectsController.getById);

module.exports = router;
