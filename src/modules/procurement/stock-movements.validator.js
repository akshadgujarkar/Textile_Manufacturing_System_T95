'use strict';

const { z } = require('zod');

const createMovementSchema = z.object({
  yarn_item_id: z.coerce.number().int().positive(),
  movement_type: z.enum(['receipt', 'issue', 'return', 'adjustment', 'reversal']),
  quantity: z.union([z.number(), z.string()]).transform(Number),
  unit_cost: z.union([z.number(), z.string()]).transform(Number).optional().nullable(),
  production_job_id: z.coerce.number().int().positive().optional().nullable(),
  reverses_movement_id: z.coerce.number().int().positive().optional().nullable(),
  reason: z.string().max(255).optional().nullable(),
  created_by_employee_id: z.coerce.number().int().positive(),
});

const reverseMovementSchema = z.object({
  reason: z.string().min(1).max(255),
  created_by_employee_id: z.coerce.number().int().positive(),
});

const listStockMovementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  yarn_item_id: z.coerce.number().int().positive().optional(),
  movement_type: z.enum(['receipt', 'issue', 'return', 'adjustment', 'reversal']).optional(),
  production_job_id: z.coerce.number().int().positive().optional(),
});

module.exports = {
  createMovementSchema,
  reverseMovementSchema,
  listStockMovementsQuerySchema,
};
