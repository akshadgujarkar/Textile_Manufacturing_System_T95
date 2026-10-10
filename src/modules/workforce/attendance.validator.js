'use strict';

const { z } = require('zod');
const { dateString } = require('../../utils/validators');

const createAttendanceSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  work_date: dateString,
  shift_code: z.string().min(1).max(30),
  status: z.enum(['present', 'absent', 'half_day', 'leave', 'overtime']),
  hours_worked: z.union([z.number(), z.string()]).transform(Number).refine((n) => n >= 0 && n <= 24, 'Hours must be 0 to 24'),
});

const updateAttendanceSchema = z.object({
  status: z.enum(['present', 'absent', 'half_day', 'leave', 'overtime']).optional(),
  hours_worked: z.union([z.number(), z.string()]).transform(Number).refine((n) => n >= 0 && n <= 24, 'Hours must be 0 to 24').optional(),
});

const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  employee_id: z.coerce.number().int().positive().optional(),
  work_date: dateString.optional(),
  shift_code: z.string().max(30).optional(),
  status: z.enum(['present', 'absent', 'half_day', 'leave', 'overtime']).optional(),
});

module.exports = {
  createAttendanceSchema,
  updateAttendanceSchema,
  listAttendanceQuerySchema,
};
