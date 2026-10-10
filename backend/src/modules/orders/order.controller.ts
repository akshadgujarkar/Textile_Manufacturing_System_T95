import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OrderService } from './order.service';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.guard';
import { AuthenticatedRequest } from '../../types';

export const orderRouter = Router();

// Zod Validation Schemas
const materialRequirementSchema = z.object({
  yarnItemId: z.number().int().positive('Yarn item ID must be positive'),
  requiredQty: z.number().positive('Required quantity must be greater than 0'),
});

const createOrderItemSchema = z.object({
  productId: z.number().int().positive('Product ID is required'),
  colourId: z.number().int().positive('Colour ID is required'),
  orderedQty: z.number().positive('Ordered quantity must be greater than 0'),
  unitId: z.number().int().positive('Unit ID is required'),
  agreedRate: z.number().nonnegative('Agreed rate must be non-negative'),
  materialRequirements: z.array(materialRequirementSchema).optional(),
});

const createOrderSchema = z.object({
  buyerId: z.number().int().positive('Buyer ID is required'),
  orderDate: z.string().optional(),
  promisedDeliveryDate: z.string().optional(),
  items: z.array(createOrderItemSchema).min(1, 'Order must contain at least one line item'),
});

const confirmOrderSchema = z.object({
  version: z.number().int().positive('Expected OCC version integer is required'),
  autoReserve: z.boolean().optional().default(true),
});

const cancelOrderSchema = z.object({
  reason: z.string().min(5, 'Cancellation reason must be at least 5 characters long').max(500),
});

const listOrdersQuerySchema = z.object({
  buyerId: z.coerce.number().int().positive().optional(),
  status: z.enum(['draft', 'confirmed', 'cancelled', 'closed']).optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * POST /api/v1/orders
 * Create new Customer Order (Draft)
 * Roles: sales, admin, owner
 */
orderRouter.post(
  '/',
  authenticateJwt,
  requireRoles('sales', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createOrderSchema.parse(req.body);
      const result = await OrderService.createOrder(validated, req.user!.userId);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Customer order draft created successfully.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'BUYER_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'BUYER_NOT_FOUND', message: 'The specified buyer does not exist.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'BUYER_INACTIVE') {
        res.status(422).json({
          success: false,
          error: { code: 'BUYER_INACTIVE', message: 'The specified buyer account is deactivated.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('PRODUCT_UNIT_MISMATCH')) {
        res.status(422).json({
          success: false,
          error: { code: 'PRODUCT_UNIT_MISMATCH', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/orders/tracking/phone-lookup
 * Fast 1-second buyer phone lookup
 * Roles: sales, staff_readonly, owner, admin, accounts, production_manager
 */
orderRouter.get(
  '/tracking/phone-lookup',
  authenticateJwt,
  requireRoles('sales', 'staff_readonly', 'owner', 'admin', 'accounts', 'production_manager'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const query = (req.query.q as string) || '';
      if (!query.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_QUERY', message: 'Query parameter "q" (phone, buyer name or order number) is required.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const results = await OrderService.phoneLookup(query);
      res.status(200).json({
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/orders
 * Paginated list of customer orders with stage tracking
 */
orderRouter.get(
  '/',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const query = listOrdersQuerySchema.parse(req.query);
      const result = await OrderService.listOrders(query);

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/orders/:id
 * Retrieve single customer order with lines, requirements, reservations, and history
 */
orderRouter.get(
  '/:id',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = parseInt(req.params.id, 10);
      if (isNaN(orderId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Order ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const order = await OrderService.getOrderById(orderId);
      res.status(200).json({
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'ORDER_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: `Customer order with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/orders/:id/material-check
 * Check material feasibility against live stock inventory (v_order_material_check)
 */
orderRouter.get(
  '/:id/material-check',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = parseInt(req.params.id, 10);
      if (isNaN(orderId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Order ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const check = await OrderService.checkMaterialFeasibility(orderId);
      res.status(200).json({
        success: true,
        data: check,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/orders/:id/confirm
 * Confirm customer order (WF-3) with OCC version check and optional auto-reservation
 * Roles: sales, admin, owner
 */
orderRouter.post(
  '/:id/confirm',
  authenticateJwt,
  requireRoles('sales', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = parseInt(req.params.id, 10);
      if (isNaN(orderId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Order ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { version, autoReserve } = confirmOrderSchema.parse(req.body);
      const confirmed = await OrderService.confirmOrder(orderId, version, autoReserve, req.user!.userId);

      res.status(200).json({
        success: true,
        data: confirmed,
        message: 'Order confirmed successfully and yarn reservations created.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'ORDER_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: `Customer order with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'CONCURRENT_MODIFICATION') {
        res.status(409).json({
          success: false,
          error: {
            code: 'OCC_CONFLICT',
            message: 'Order was modified concurrently by another user. Please refresh and try again.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'MISSING_PROMISED_DELIVERY_DATE') {
        res.status(422).json({
          success: false,
          error: {
            code: 'MISSING_PROMISED_DELIVERY_DATE',
            message: 'A promised delivery date must be set before confirming the order.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'ORDER_HAS_NO_ITEMS') {
        res.status(422).json({
          success: false,
          error: {
            code: 'EMPTY_ORDER',
            message: 'An order must contain at least one line item before it can be confirmed.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('ORDER_NOT_IN_DRAFT')) {
        res.status(422).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Only draft orders can be confirmed.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/orders/:id/cancel
 * Cancel customer order (WF-3c) and release yarn reservations
 * Roles: sales, admin, owner
 */
orderRouter.post(
  '/:id/cancel',
  authenticateJwt,
  requireRoles('sales', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = parseInt(req.params.id, 10);
      if (isNaN(orderId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Order ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { reason } = cancelOrderSchema.parse(req.body);
      const cancelled = await OrderService.cancelOrder(orderId, reason, req.user!.userId);

      res.status(200).json({
        success: true,
        data: cancelled,
        message: 'Order cancelled successfully and all yarn reservations have been released.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'ORDER_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: `Customer order with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'ORDER_ALREADY_CANCELLED') {
        res.status(422).json({
          success: false,
          error: { code: 'ALREADY_CANCELLED', message: 'This customer order is already cancelled.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'ORDER_ALREADY_CLOSED') {
        res.status(422).json({
          success: false,
          error: { code: 'ALREADY_CLOSED', message: 'Cannot cancel a closed order.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);
