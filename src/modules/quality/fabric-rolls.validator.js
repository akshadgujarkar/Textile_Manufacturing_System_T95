'use strict';

const { z } = require('zod');

const createFabricRollSchema = z.object({
  roll_code: z.string().min(1).max(50),
  job_id: z.coerce.number().int().positive(),
  operator_id: z.coerce.number().int().positive(),
  length_m: z.union([z.number(), z.string()]).transform(Number).refine((n) => n > 0, 'Length must be > 0'),
  weight_kg: z.union([z.number(), z.string()]).transform(Number).refine((n) => n > 0, 'Weight must be > 0'),
  gsm: z.union([z.number(), z.string()]).transform(Number).optional().nullable(),
  width_inches: z.union([z.number(), z.string()]).transform(Number).optional().nullable(),
  shelf_location: z.string().max(50).optional().nullable(),
});

const updateRollStatusSchema = z.object({
  status: z.enum(['pending_qc', 'in_stock', 'rework', 'rejected', 'loaded', 'dispatched', 'scrapped']),
  version: z.coerce.number().int().positive(),
});

const listFabricRollsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
  job_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['pending_qc', 'in_stock', 'rework', 'rejected', 'loaded', 'dispatched', 'scrapped']).optional(),
});

module.exports = {
  createFabricRollSchema,
  updateRollStatusSchema,
  listFabricRollsQuerySchema,
};
