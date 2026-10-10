'use strict';

const { z } = require('zod');
const { dateString } = require('../../utils/validators');

const createCostEntrySchema = z.object({
  cost_type: z.enum(['material', 'wage', 'power', 'maintenance', 'overhead']),
  amount: z.union([z.number(), z.string()]).transform(Number).refine((n) => n >= 0, 'Amount must be >= 0'),
  cost_date: dateString,
  order_id: z.coerce.number().int().positive().optional().nullable(),
  machine_id: z.coerce.number().int().positive().optional().nullable(),
  roll_id: z.coerce.number().int().positive().optional().nullable(),
  movement_id: z.coerce.number().int().positive().optional().nullable(),
  wage_id: z.coerce.number().int().positive().optional().nullable(),
});

const listCostEntriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  cost_type: z.enum(['material', 'wage', 'power', 'maintenance', 'overhead']).optional(),
  order_id: z.coerce.number().int().positive().optional(),
  machine_id: z.coerce.number().int().positive().optional(),
  roll_id: z.coerce.number().int().positive().optional(),
  from_date: dateString.optional(),
  to_date: dateString.optional(),
});

module.exports = {
  createCostEntrySchema,
  listCostEntriesQuerySchema,
};
