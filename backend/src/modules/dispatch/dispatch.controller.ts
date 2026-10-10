import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DispatchService } from './dispatch.service';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.guard';
import { AuthenticatedRequest } from '../../types';

export const dispatchRouter = Router();

// Zod Validation Schemas
const createDispatchSchema = z.object({
  buyerId: z.number().int().positive('Buyer ID is required'),
  orderId: z.number().int().positive('Order ID is required'),
  vehicleNo: z.string().max(50).optional(),
});

const startLoadingSchema = z.object({
  version: z.number().int().positive('Expected OCC version integer is required'),
});

const scanRollSchema = z.object({
  rollCode: z.string().min(1, 'Roll code is required'),
});

const removeRollSchema = z.object({
  reason: z.string().min(5, 'Removal reason must be at least 5 characters long').max(500),
});

const completeDispatchSchema = z.object({
  vehicleNo: z.string().min(3, 'Vehicle number is required and must be at least 3 characters long').max(50),
});

const cancelDispatchSchema = z.object({
  reason: z.string().min(5, 'Cancellation reason must be at least 5 characters long').max(500),
});

const listDispatchesQuerySchema = z.object({
  status: z.enum(['draft', 'loading', 'dispatched', 'cancelled']).optional(),
  buyerId: z.coerce.number().int().positive().optional(),
  orderId: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * POST /api/v1/dispatches
 * Create new Dispatch Manifest (Draft)
 * Roles: dispatch, admin, owner
 */
dispatchRouter.post(
  '/',
  authenticateJwt,
  requireRoles('dispatch', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createDispatchSchema.parse(req.body);
      const dispatch = await DispatchService.createDispatch(validated, req.user!.userId);

      res.status(201).json({
        success: true,
        data: dispatch,
        message: 'Dispatch manifest created in draft status.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message && error.message.startsWith('ORDER_BUYER_MISMATCH')) {
        res.status(422).json({
          success: false,
          error: { code: 'ORDER_BUYER_MISMATCH', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('ORDER_NOT_DISPATCHABLE')) {
        res.status(422).json({
          success: false,
          error: { code: 'ORDER_NOT_DISPATCHABLE', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/dispatches
 * List Dispatch Manifests with pagination and status filters
 */
dispatchRouter.get(
  '/',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const query = listDispatchesQuerySchema.parse(req.query);
      const result = await DispatchService.listDispatches(query);

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
 * GET /api/v1/dispatches/progress
 * Overall Dispatch Progress by Order (v_dispatch_progress)
 */
dispatchRouter.get(
  '/progress',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = req.query.orderId ? parseInt(req.query.orderId as string, 10) : undefined;
      const progress = await DispatchService.getDispatchProgress(orderId);

      res.status(200).json({
        success: true,
        data: progress,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/dispatches/:id
 * Retrieve Dispatch Details, loaded rolls, and weight stats
 */
dispatchRouter.get(
  '/:id',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dispatchId = parseInt(req.params.id, 10);
      if (isNaN(dispatchId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Dispatch ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const dispatch = await DispatchService.getDispatchById(dispatchId);
      res.status(200).json({
        success: true,
        data: dispatch,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'DISPATCH_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'DISPATCH_NOT_FOUND', message: `Dispatch with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/dispatches/:id/lines
 * Retrieve summarized lines for billing / invoice calculation (v_dispatch_lines)
 */
dispatchRouter.get(
  '/:id/lines',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dispatchId = parseInt(req.params.id, 10);
      if (isNaN(dispatchId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Dispatch ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const lines = await DispatchService.getDispatchLines(dispatchId);
      res.status(200).json({
        success: true,
        data: lines,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/dispatches/:id/start-loading
 * Start loading dispatch manifest
 * Roles: dispatch, admin, owner
 */
dispatchRouter.post(
  '/:id/start-loading',
  authenticateJwt,
  requireRoles('dispatch', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dispatchId = parseInt(req.params.id, 10);
      if (isNaN(dispatchId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Dispatch ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { version } = startLoadingSchema.parse(req.body);
      const updated = await DispatchService.startLoading(dispatchId, version, req.user!.userId);

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Dispatch status updated to loading.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'DISPATCH_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'DISPATCH_NOT_FOUND', message: `Dispatch with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'CONCURRENT_MODIFICATION') {
        res.status(409).json({
          success: false,
          error: { code: 'OCC_CONFLICT', message: 'Dispatch was modified concurrently. Please refresh.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/dispatches/:id/scan-roll
 * Live barcode scanning of fabric rolls onto truck (WF-9)
 * Roles: dispatch, admin, owner
 */
dispatchRouter.post(
  '/:id/scan-roll',
  authenticateJwt,
  requireRoles('dispatch', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dispatchId = parseInt(req.params.id, 10);
      if (isNaN(dispatchId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Dispatch ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { rollCode } = scanRollSchema.parse(req.body);
      const result = await DispatchService.scanRollToDispatch(dispatchId, rollCode, req.user!.userId);

      res.status(201).json({
        success: true,
        data: result,
        message: `Roll ${rollCode} successfully scanned and loaded onto truck.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'DISPATCH_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'DISPATCH_NOT_FOUND', message: `Dispatch with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('ROLL_NOT_FOUND')) {
        res.status(404).json({
          success: false,
          error: { code: 'ROLL_NOT_FOUND', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('ROLL_NOT_IN_STOCK')) {
        res.status(422).json({
          success: false,
          error: { code: 'ROLL_NOT_IN_STOCK', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('ROLL_ORDER_MISMATCH')) {
        res.status(422).json({
          success: false,
          error: { code: 'ORDER_MISMATCH', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('DISPATCH_CLOSED')) {
        res.status(422).json({
          success: false,
          error: { code: 'DISPATCH_CLOSED', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/dispatches/:id/items/:itemId/remove
 * Remove loaded roll from dispatch manifest and return roll to shelf
 * Roles: dispatch, admin, owner
 */
dispatchRouter.post(
  '/:id/items/:itemId/remove',
  authenticateJwt,
  requireRoles('dispatch', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const itemId = parseInt(req.params.itemId, 10);
      if (isNaN(itemId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Dispatch item ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { reason } = removeRollSchema.parse(req.body);
      const removed = await DispatchService.removeRollFromDispatch(itemId, reason, req.user!.userId);

      res.status(200).json({
        success: true,
        data: removed,
        message: 'Roll removed from dispatch manifest and returned to in_stock status.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'DISPATCH_ITEM_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'DISPATCH_ITEM_NOT_FOUND', message: `Dispatch item with ID ${req.params.itemId} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'ITEM_ALREADY_REMOVED') {
        res.status(422).json({
          success: false,
          error: { code: 'ALREADY_REMOVED', message: 'This item has already been removed from the manifest.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/dispatches/:id/complete
 * Complete Loading & Dispatch Truck (WF-10)
 * Roles: dispatch, admin, owner
 */
dispatchRouter.post(
  '/:id/complete',
  authenticateJwt,
  requireRoles('dispatch', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dispatchId = parseInt(req.params.id, 10);
      if (isNaN(dispatchId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Dispatch ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { vehicleNo } = completeDispatchSchema.parse(req.body);
      const completed = await DispatchService.completeDispatch(dispatchId, vehicleNo, req.user!.userId);

      res.status(200).json({
        success: true,
        data: completed,
        message: 'Dispatch completed successfully and all active rolls transitioned to dispatched.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'DISPATCH_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'DISPATCH_NOT_FOUND', message: `Dispatch with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('CANNOT_COMPLETE_EMPTY_DISPATCH')) {
        res.status(422).json({
          success: false,
          error: { code: 'EMPTY_DISPATCH', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/dispatches/:id/cancel
 * Cancel Dispatch Manifest
 * Roles: dispatch, admin, owner
 */
dispatchRouter.post(
  '/:id/cancel',
  authenticateJwt,
  requireRoles('dispatch', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dispatchId = parseInt(req.params.id, 10);
      if (isNaN(dispatchId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Dispatch ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { reason } = cancelDispatchSchema.parse(req.body);
      const cancelled = await DispatchService.cancelDispatch(dispatchId, reason, req.user!.userId);

      res.status(200).json({
        success: true,
        data: cancelled,
        message: 'Dispatch manifest cancelled and all active rolls returned to shelf.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'DISPATCH_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'DISPATCH_NOT_FOUND', message: `Dispatch with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'DISPATCH_ALREADY_CANCELLED') {
        res.status(422).json({
          success: false,
          error: { code: 'ALREADY_CANCELLED', message: 'This dispatch is already cancelled.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('CANNOT_CANCEL_COMPLETED_DISPATCH')) {
        res.status(422).json({
          success: false,
          error: { code: 'DISPATCHED_CANNOT_CANCEL', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);
