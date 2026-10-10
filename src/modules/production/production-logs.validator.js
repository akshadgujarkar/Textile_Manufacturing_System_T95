'use strict';

const { z } = require('zod');
const { uuidString } = require('../../utils/validators');

const createProductionLogSchema = z.object({
  job_id: z.coerce.number().int().positive(),
  shift_code: z.string().min(1).max(30),
  operator_id: z.coerce.number().int().positive(),
  output_qty: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  scrap_qty: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  power_kwh: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  client_request_id: uuidString,
});

const listProductionLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  job_id: z.coerce.number().int().positive().optional(),
  operator_id: z.coerce.number().int().positive().optional(),
  shift_code: z.string().max(30).optional(),
});

module.exports = {
  createProductionLogSchema,
  listProductionLogsQuerySchema,
};
