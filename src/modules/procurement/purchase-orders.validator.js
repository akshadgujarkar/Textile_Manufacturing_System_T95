'use strict';

const { z } = require('zod');
const { dateString } = require('../../utils/validators');

const poItemInputSchema = z.object({
  yarn_item_id: z.coerce.number().int().positive(),
  quantity: z.union([z.number(), z.string()]).transform(Number).refine((n) => n > 0, 'Quantity must be > 0'),
  agreed_rate: z.union([z.number(), z.string()]).transform(Number).refine((n) => n >= 0, 'Rate must be >= 0'),
});

const createPurchaseOrderSchema = z.object({
  po_no: z.string().min(1).max(30),
  supplier_id: z.coerce.number().int().positive(),
  order_date: dateString,
  expected_delivery_date: dateString.optional().nullable(),
  created_by: z.coerce.number().int().positive(),
  items: z.array(poItemInputSchema).min(1, 'At least one item is required'),
});

const addPoItemSchema = poItemInputSchema;

const updatePoStatusSchema = z.object({
  status: z.enum(['draft', 'sent', 'partially_received', 'closed', 'cancelled']),
});

const listPurchaseOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['draft', 'sent', 'partially_received', 'closed', 'cancelled']).optional(),
});

module.exports = {
  createPurchaseOrderSchema,
  addPoItemSchema,
  updatePoStatusSchema,
  listPurchaseOrdersQuerySchema,
};
