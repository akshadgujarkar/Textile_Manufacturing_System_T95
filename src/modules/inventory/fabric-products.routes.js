'use strict';

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const FabricProductsController = require('./fabric-products.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');

const createFabricProductSchema = z.object({
  product_code: z.string().min(1).max(30),
  name: z.string().min(1).max(150),
  weave_type: z.string().max(50).optional().nullable(),
  nominal_gsm: z.union([z.number(), z.string()]).transform(Number).optional().nullable(),
  nominal_width_inches: z.union([z.number(), z.string()]).transform(Number).optional().nullable(),
  unit_id: z.coerce.number().int().positive(),
});

const updateFabricProductSchema = createFabricProductSchema.partial().omit({ product_code: true });

const listFabricProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
});

router.get('/', validate({ query: listFabricProductsQuerySchema }), FabricProductsController.list);
router.get('/:id', validate({ params: idParam }), FabricProductsController.getById);
router.post('/', validate({ body: createFabricProductSchema }), FabricProductsController.create);
router.patch('/:id', validate({ params: idParam, body: updateFabricProductSchema }), FabricProductsController.update);

module.exports = router;
