'use strict';

const { z } = require('zod');

const createBuyerSchema = z.object({
  buyer_code: z.string().min(1).max(20),
  name: z.string().min(1).max(150),
  gstin: z.string().length(15).optional().nullable(),
  contact_person: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  credit_limit: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  payment_terms_days: z.coerce.number().int().min(0).optional().default(30),
  is_active: z.boolean().optional().default(true),
});

const updateBuyerSchema = createBuyerSchema.partial().omit({ buyer_code: true });

const listBuyersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
  is_active: z.enum(['true', 'false', '1', '0']).optional().transform((v) => v === 'true' || v === '1'),
});

module.exports = {
  createBuyerSchema,
  updateBuyerSchema,
  listBuyersQuerySchema,
};
