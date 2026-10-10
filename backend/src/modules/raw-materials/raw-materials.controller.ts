import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RawMaterialService } from './raw-materials.service';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.guard';
import { AuthenticatedRequest } from '../../types';

export const rawMaterialsRouter = Router();

// Zod Validation Schemas
const createReceiptItemSchema = z.object({
  yarnItemId: z.number().int().positive('Yarn item ID must be a positive integer'),
  quantityReceived: z.number().positive('Quantity received must be greater than 0'),
  challanQuantity: z.number().positive('Challan quantity must be greater than 0').optional(),
  unitRate: z.number().nonnegative('Unit rate must be non-negative').optional(),
  earmarkedOrderId: z.number().int().positive('Earmarked order ID must be a positive integer').optional(),
});

const createGateReceiptSchema = z.object({
  supplierId: z.number().int().positive('Supplier ID is required and must be positive'),
  supplierChallanNo: z.string().max(100).optional(),
  poId: z.number().int().positive().optional(),
  receivedAt: z.string().datetime().optional(),
  clientRequestId: z.string().uuid('clientRequestId must be a valid UUIDv4'),
  items: z.array(createReceiptItemSchema).min(1, 'Receipt must contain at least one yarn lot item'),
});

const cancelReceiptSchema = z.object({
  reason: z.string().min(5, 'Cancellation reason must be at least 5 characters long').max(500),
});

const listReceiptsQuerySchema = z.object({
  supplierId: z.coerce.number().int().positive().optional(),
  poId: z.coerce.number().int().positive().optional(),
  status: z.enum(['received', 'cancelled']).optional(),
  fromReceivedAt: z.string().optional(),
  toReceivedAt: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

const yarnStockQuerySchema = z.object({
  isLowStock: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  yarnTypeId: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(25),
});

/**
 * POST /api/v1/raw-materials/receipts
 * Create Gate Inward Entry (WF-1)
 * Role: gate_store, admin, owner
 */
rawMaterialsRouter.post(
  '/receipts',
  authenticateJwt,
  requireRoles('gate_store', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createGateReceiptSchema.parse(req.body);
      const result = await RawMaterialService.createGateReceipt(validated, req.user!.userId);

      res.status(result.isIdempotentRetry ? 200 : 201).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'SUPPLIER_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'SUPPLIER_NOT_FOUND', message: 'The specified supplier does not exist.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'SUPPLIER_INACTIVE') {
        res.status(422).json({
          success: false,
          error: { code: 'SUPPLIER_INACTIVE', message: 'The specified supplier is deactivated.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'PO_SUPPLIER_MISMATCH') {
        res.status(422).json({
          success: false,
          error: { code: 'PO_SUPPLIER_MISMATCH', message: 'The selected Purchase Order does not belong to this supplier.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/raw-materials/receipts
 * List Gate Inward Receipts
 */
rawMaterialsRouter.get(
  '/receipts',
  authenticateJwt,
  requireRoles('gate_store', 'accounts', 'owner', 'admin', 'production_manager', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const query = listReceiptsQuerySchema.parse(req.query);
      const result = await RawMaterialService.listReceipts(query);

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
 * GET /api/v1/raw-materials/receipts/:id
 * Get single Goods Receipt details with yarn lots
 */
rawMaterialsRouter.get(
  '/receipts/:id',
  authenticateJwt,
  requireRoles('gate_store', 'accounts', 'owner', 'admin', 'production_manager', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const receiptId = parseInt(req.params.id, 10);
      if (isNaN(receiptId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Receipt ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const receipt = await RawMaterialService.getReceiptById(receiptId);
      res.status(200).json({
        success: true,
        data: receipt,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'RECEIPT_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'RECEIPT_NOT_FOUND', message: `Goods receipt with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/raw-materials/receipts/:id/cancel
 * Cancel Gate Inward Receipt (WF-2)
 */
rawMaterialsRouter.post(
  '/receipts/:id/cancel',
  authenticateJwt,
  requireRoles('gate_store', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const receiptId = parseInt(req.params.id, 10);
      if (isNaN(receiptId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Receipt ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { reason } = cancelReceiptSchema.parse(req.body);
      const cancelled = await RawMaterialService.cancelGateReceipt(receiptId, reason, req.user!.userId);

      res.status(200).json({
        success: true,
        data: cancelled,
        message: 'Goods receipt has been successfully cancelled and stock movements reversed.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'RECEIPT_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'RECEIPT_NOT_FOUND', message: `Goods receipt with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'RECEIPT_ALREADY_CANCELLED') {
        res.status(422).json({
          success: false,
          error: { code: 'ALREADY_CANCELLED', message: 'This goods receipt is already cancelled.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'CANNOT_CANCEL_BILLED_RECEIPT') {
        res.status(409).json({
          success: false,
          error: {
            code: 'RECEIPT_BILLED',
            message: 'Cannot cancel receipt: one or more items have already been billed by the supplier in an active bill.',
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
 * GET /api/v1/raw-materials/stock
 * Query current Yarn Stock Inventory (v_yarn_stock)
 */
rawMaterialsRouter.get(
  '/stock',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const query = yarnStockQuerySchema.parse(req.query);
      const result = await RawMaterialService.getYarnStock(query);

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
 * GET /api/v1/raw-materials/alerts
 * Query Open Low-Stock Alerts (v_open_stock_alerts)
 */
rawMaterialsRouter.get(
  '/alerts',
  authenticateJwt,
  requireRoles('gate_store', 'production_manager', 'owner', 'admin', 'accounts', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const alerts = await RawMaterialService.getOpenStockAlerts();
      res.status(200).json({
        success: true,
        data: alerts,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/raw-materials/alerts/:id/acknowledge
 * Acknowledge low stock alert
 */
rawMaterialsRouter.post(
  '/alerts/:id/acknowledge',
  authenticateJwt,
  requireRoles('gate_store', 'production_manager', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const alertId = parseInt(req.params.id, 10);
      if (isNaN(alertId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Alert ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const acknowledged = await RawMaterialService.acknowledgeStockAlert(alertId, req.user!.userId);
      res.status(200).json({
        success: true,
        data: acknowledged,
        message: 'Stock alert acknowledged successfully.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'ALERT_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'ALERT_NOT_FOUND', message: `Stock alert with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'ALERT_ALREADY_ACKNOWLEDGED') {
        res.status(422).json({
          success: false,
          error: { code: 'ALREADY_ACKNOWLEDGED', message: 'This stock alert has already been acknowledged.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'ALERT_ALREADY_RESOLVED') {
        res.status(422).json({
          success: false,
          error: { code: 'ALREADY_RESOLVED', message: 'This stock alert is already resolved by replenishing stock.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/raw-materials/unbilled-lots
 * Query Unbilled Lots for accounts / gate entry
 */
rawMaterialsRouter.get(
  '/unbilled-lots',
  authenticateJwt,
  requireRoles('accounts', 'owner', 'admin', 'gate_store', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supplierId = req.query.supplierId ? parseInt(req.query.supplierId as string, 10) : undefined;
      const lots = await RawMaterialService.getUnbilledLots(supplierId);

      res.status(200).json({
        success: true,
        data: lots,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/raw-materials/lots/:lotCode/barcode-payload
 * Return thermal printing label payload & ZPL II code
 */
rawMaterialsRouter.get(
  '/lots/:lotCode/barcode-payload',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const lotCode = req.params.lotCode;
      if (!lotCode) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_LOT_CODE', message: 'Lot code is required.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const payload = await RawMaterialService.getLotBarcodePayload(lotCode);
      res.status(200).json({
        success: true,
        data: payload,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'LOT_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'LOT_NOT_FOUND', message: `Yarn lot with code ${req.params.lotCode} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);
