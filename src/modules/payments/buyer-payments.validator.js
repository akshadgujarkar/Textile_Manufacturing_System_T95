'use strict';

const { z } = require('zod');
const { dateString, uuidString } = require('../../utils/validators');

const createBuyerPaymentSchema = z.object({
  payment_ref: z.string().min(1).max(50),
  buyer_id: z.coerce.number().int().positive(),
  invoice_id: z.coerce.number().int().positive(),
  received_on: dateString,
  amount: z.union([z.number(), z.string()]).transform(Number).refine((n) => n > 0, 'Amount must be > 0'),
  mode: z.enum(['NEFT/RTGS', 'Cheque', 'UPI', 'LC']),
  client_request_id: uuidString,
  created_by_employee_id: z.coerce.number().int().positive(),
});

const listBuyerPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  buyer_id: z.coerce.number().int().positive().optional(),
  invoice_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['recorded', 'reversed']).optional(),
});

module.exports = {
  createBuyerPaymentSchema,
  listBuyerPaymentsQuerySchema,
};
