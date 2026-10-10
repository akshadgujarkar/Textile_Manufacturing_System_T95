'use strict';

const { z } = require('zod');

const createDispatchSchema = z.object({
  dispatch_no: z.string().min(1).max(30),
  buyer_id: z.coerce.number().int().positive(),
  order_id: z.coerce.number().int().positive(),
  invoice_id: z.coerce.number().int().positive().optional().nullable(),
  vehicle_no: z.string().max(20).optional().nullable(),
  driver_name: z.string().max(100).optional().nullable(),
  driver_phone: z.string().max(20).optional().nullable(),
  destination: z.string().max(150).optional().nullable(),
});

const scanRollSchema = z.object({
  roll_id: z.coerce.number().int().positive(),
  scanned_by_employee_id: z.coerce.number().int().positive(),
});

const transitionDispatchSchema = z.object({
  version: z.coerce.number().int().positive(),
});

const listDispatchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
  buyer_id: z.coerce.number().int().positive().optional(),
  order_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['draft', 'loading', 'dispatched', 'cancelled']).optional(),
});

module.exports = {
  createDispatchSchema,
  scanRollSchema,
  transitionDispatchSchema,
  listDispatchesQuerySchema,
};
