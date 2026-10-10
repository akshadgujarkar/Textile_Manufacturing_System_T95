'use strict';

const { z } = require('zod');
const { dateString } = require('../../utils/validators');

const invoiceItemInputSchema = z.object({
  order_item_id: z.coerce.number().int().positive(),
  hsn_code: z.string().max(10).optional().default('5208'),
  quantity: z.union([z.number(), z.string()]).transform(Number).refine((n) => n > 0, 'Quantity must be > 0'),
  rate: z.union([z.number(), z.string()]).transform(Number).refine((n) => n >= 0, 'Rate must be >= 0'),
});

const createInvoiceSchema = z.object({
  invoice_no: z.string().min(1).max(30),
  buyer_id: z.coerce.number().int().positive(),
  invoice_date: dateString,
  due_date: dateString.optional().nullable(),
  tax_rate: z.union([z.number(), z.string()]).transform(Number).refine((n) => n >= 0, 'Tax rate must be >= 0').optional().default(5.00),
  items: z.array(invoiceItemInputSchema).min(1, 'At least one invoice line is required'),
});

const transitionInvoiceSchema = z.object({
  version: z.coerce.number().int().positive(),
});

const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
  buyer_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['draft', 'issued', 'void']).optional(),
});

module.exports = {
  createInvoiceSchema,
  transitionInvoiceSchema,
  listInvoicesQuerySchema,
};
