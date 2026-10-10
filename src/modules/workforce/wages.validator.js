'use strict';

const { z } = require('zod');
const { dateString } = require('../../utils/validators');

const createWageRecordSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  payroll_month: dateString,
  base_amount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  piece_rate_amount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  bonus_overtime: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
});

const listWagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  employee_id: z.coerce.number().int().positive().optional(),
  payroll_month: dateString.optional(),
  status: z.enum(['draft', 'approved', 'disbursed', 'reversed']).optional(),
});

module.exports = {
  createWageRecordSchema,
  listWagesQuerySchema,
};
