'use strict';

const { z } = require('zod');

const defectInputSchema = z.object({
  defect_code: z.string().min(1).max(30),
  defect_name: z.string().min(1).max(100),
  penalty_points: z.union([z.number(), z.string()]).transform(Number).refine((n) => [1, 2, 3, 4].includes(n), 'Points must be 1, 2, 3, or 4'),
  position_meters: z.union([z.number(), z.string()]).transform(Number).optional().nullable(),
  severity: z.enum(['minor', 'major', 'critical']),
});

const createQcInspectionSchema = z.object({
  roll_id: z.coerce.number().int().positive(),
  inspector_id: z.coerce.number().int().positive(),
  result: z.enum(['passed', 'rework', 'rejected']),
  assigned_grade: z.enum(['A', 'B', 'C', 'Rejection']),
  remarks: z.string().optional().nullable(),
  defects: z.array(defectInputSchema).optional().default([]),
});

const listQcInspectionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  roll_id: z.coerce.number().int().positive().optional(),
  inspector_id: z.coerce.number().int().positive().optional(),
  result: z.enum(['passed', 'rework', 'rejected']).optional(),
});

module.exports = {
  createQcInspectionSchema,
  listQcInspectionsQuerySchema,
};
