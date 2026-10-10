'use strict';

const { z } = require('zod');
const { uuidString } = require('../../utils/validators');

const grItemInputSchema = z.object({
  yarn_item_id: z.coerce.number().int().positive(),
  lot_code: z.string().min(1).max(50),
  quantity_received: z.union([z.number(), z.string()]).transform(Number).refine((n) => n > 0, 'Quantity must be > 0'),
  unit_cost: z.union([z.number(), z.string()]).transform(Number).optional().nullable(),
  earmarked_order_id: z.coerce.number().int().positive().optional().nullable(),
  storage_location: z.string().max(50).optional().nullable(),
});

const createGoodsReceiptSchema = z.object({
  receipt_no: z.string().min(1).max(30),
  supplier_id: z.coerce.number().int().positive(),
  po_id: z.coerce.number().int().positive().optional().nullable(),
  supplier_challan_no: z.string().max(50).optional().nullable(),
  vehicle_number: z.string().max(20).optional().nullable(),
  received_by_employee_id: z.coerce.number().int().positive(),
  client_request_id: uuidString,
  items: z.array(grItemInputSchema).min(1, 'At least one item is required'),
});

const listGoodsReceiptsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['received', 'cancelled']).optional(),
});

const cancelGoodsReceiptSchema = z.object({
  reason: z.string().max(255).optional(),
  employee_id: z.coerce.number().int().positive().optional(),
});

module.exports = {
  createGoodsReceiptSchema,
  listGoodsReceiptsQuerySchema,
  cancelGoodsReceiptSchema,
};

