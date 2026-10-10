'use strict';

const { z } = require('zod');

const createMaterialReqSchema = z.object({
  order_item_id: z.coerce.number().int().positive(),
  yarn_item_id: z.coerce.number().int().positive(),
  required_qty: z.union([z.number(), z.string()]).transform(Number).refine((n) => n > 0, 'Required qty must be > 0'),
  waste_factor_pct: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
});

const reserveMaterialSchema = z.object({
  quantity_to_reserve: z.union([z.number(), z.string()]).transform(Number).refine((n) => n > 0, 'Quantity must be > 0'),
});

const listMaterialReqQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  order_item_id: z.coerce.number().int().positive().optional(),
  yarn_item_id: z.coerce.number().int().positive().optional(),
  allocation_status: z.enum(['unallocated', 'partial', 'reserved', 'issued', 'cancelled']).optional(),
});

module.exports = {
  createMaterialReqSchema,
  reserveMaterialSchema,
  listMaterialReqQuerySchema,
};
