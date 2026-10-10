'use strict';

const { z } = require('zod');
const { dateString } = require('../../utils/validators');

const orderItemInputSchema = z.object({
  line_no: z.coerce.number().int().positive(),
  product_id: z.coerce.number().int().positive(),
  colour_code: z.string().min(1).max(30),
  ordered_qty: z.union([z.number(), z.string()]).transform(Number).refine((n) => n > 0, 'Ordered qty must be > 0'),
  unit_id: z.coerce.number().int().positive(),
  agreed_rate: z.union([z.number(), z.string()]).transform(Number).refine((n) => n >= 0, 'Rate must be >= 0'),
});

const createCustomerOrderSchema = z.object({
  order_no: z.string().min(1).max(30),
  buyer_id: z.coerce.number().int().positive(),
  order_date: dateString,
  promised_delivery_date: dateString.optional().nullable(),
  created_by_employee_id: z.coerce.number().int().positive(),
  items: z.array(orderItemInputSchema).min(1, 'At least one order item is required'),
});

const addOrderItemSchema = orderItemInputSchema;

const updateOrderStatusSchema = z.object({
  status: z.enum(['draft', 'confirmed', 'in_production', 'ready_for_dispatch', 'dispatched', 'closed', 'cancelled']),
  version: z.coerce.number().int().positive(),
});

const listCustomerOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
  buyer_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['draft', 'confirmed', 'in_production', 'ready_for_dispatch', 'dispatched', 'closed', 'cancelled']).optional(),
});

module.exports = {
  createCustomerOrderSchema,
  addOrderItemSchema,
  updateOrderStatusSchema,
  listCustomerOrdersQuerySchema,
};
