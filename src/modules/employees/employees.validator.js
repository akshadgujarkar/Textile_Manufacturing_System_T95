'use strict';

const { z } = require('zod');

const createEmployeeSchema = z.object({
  employee_code: z.string().min(1).max(20),
  full_name: z.string().min(1).max(100),
  designation: z.string().max(50).optional().nullable(),
  pay_basis: z.enum(['monthly', 'daily', 'piece_rate']).default('monthly'),
  pay_rate: z.union([z.number(), z.string()]).transform(Number).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

const updateEmployeeSchema = createEmployeeSchema.partial().omit({ employee_code: true });

const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
  is_active: z.enum(['true', 'false', '1', '0']).optional().transform((v) => v === 'true' || v === '1'),
});

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  listEmployeesQuerySchema,
};
