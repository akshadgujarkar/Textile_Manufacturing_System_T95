'use strict';

const { z } = require('zod');

const createSupplierSchema = z.object({
  supplier_code: z.string().min(1).max(20),
  name: z.string().min(1).max(150),
  gstin: z.string().length(15).optional().nullable(),
  contact_person: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

const updateSupplierSchema = createSupplierSchema.partial().omit({ supplier_code: true });

const listSuppliersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
  is_active: z.enum(['true', 'false', '1', '0']).optional().transform((v) => v === 'true' || v === '1'),
});

module.exports = {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersQuerySchema,
};
