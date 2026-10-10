'use strict';

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const YarnItemsController = require('./yarn-items.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');

const createYarnItemSchema = z.object({
  yarn_type_id: z.coerce.number().int().positive(),
  colour_code: z.string().min(1).max(30),
  colour_name: z.string().max(100).optional().nullable(),
  unit_id: z.coerce.number().int().positive(),
  reorder_level: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  is_active: z.boolean().optional().default(true),
});

const updateYarnItemSchema = z.object({
  colour_name: z.string().max(100).optional().nullable(),
  reorder_level: z.union([z.number(), z.string()]).transform(Number).optional(),
  is_active: z.boolean().optional(),
});

const listYarnItemsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
  yarn_type_id: z.coerce.number().int().positive().optional(),
  is_active: z.enum(['true', 'false', '1', '0']).optional().transform((v) => v === 'true' || v === '1'),
});

router.get('/', validate({ query: listYarnItemsQuerySchema }), YarnItemsController.list);
router.get('/:id', validate({ params: idParam }), YarnItemsController.getById);
router.post('/', validate({ body: createYarnItemSchema }), YarnItemsController.create);
router.patch('/:id', validate({ params: idParam, body: updateYarnItemSchema }), YarnItemsController.update);
router.get('/:id/stock', validate({ params: idParam }), YarnItemsController.getStock);
router.get('/:id/stock-ledger', validate({ params: idParam }), YarnItemsController.getStockLedger);

module.exports = router;
