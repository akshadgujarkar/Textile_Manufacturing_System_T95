'use strict';

const { z } = require('zod');

const createProductionJobSchema = z.object({
  job_no: z.string().min(1).max(30),
  order_item_id: z.coerce.number().int().positive(),
  stage_id: z.coerce.number().int().positive(),
  machine_id: z.coerce.number().int().positive(),
  planned_qty: z.union([z.number(), z.string()]).transform(Number).refine((n) => n > 0, 'Planned qty must be > 0'),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional().default('Medium'),
});

const transitionJobSchema = z.object({
  version: z.coerce.number().int().positive(),
});

const listProductionJobsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
  stage_id: z.coerce.number().int().positive().optional(),
  machine_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['planned', 'running', 'interrupted', 'completed', 'cancelled']).optional(),
});

module.exports = {
  createProductionJobSchema,
  transitionJobSchema,
  listProductionJobsQuerySchema,
};
