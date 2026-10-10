import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { QualityService } from './quality.service';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.guard';
import { AuthenticatedRequest } from '../../types';

export const qualityRouter = Router();

// Zod Validation Schemas
const defectItemSchema = z.object({
  defectTypeId: z.number().int().positive('Defect type ID must be a positive integer'),
  severity: z.enum(['minor', 'major', 'critical']),
  defectCount: z.number().int().positive('Defect count must be positive').optional().default(1),
  positionNote: z.string().max(255).optional(),
});

const recordInspectionSchema = z.object({
  rollCode: z.string().min(1, 'Roll code is required'),
  inspectorId: z.number().int().positive('Inspector employee ID is required'),
  result: z.enum(['passed', 'rework', 'rejected']),
  remarks: z.string().max(500).optional(),
  defects: z.array(defectItemSchema).optional(),
});

const scrapRollSchema = z.object({
  reason: z.string().min(5, 'Scrap reason must be at least 5 characters long').max(500),
});

const shelfInventoryQuerySchema = z.object({
  shelfLocation: z.string().optional(),
  productName: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(25),
});

/**
 * GET /api/v1/quality/rolls/:rollCode
 * Fetch fabric roll details, parent order metadata, and prior inspection history
 */
qualityRouter.get(
  '/rolls/:rollCode',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rollCode = req.params.rollCode;
      if (!rollCode) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_ROLL_CODE', message: 'Roll code parameter is required.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const roll = await QualityService.getRollByCode(rollCode);
      res.status(200).json({
        success: true,
        data: roll,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'ROLL_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'ROLL_NOT_FOUND', message: `Fabric roll with code ${req.params.rollCode} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/quality/inspections
 * Record QC Inspection with defects (WF-7)
 * Roles: quality_checker, admin, owner
 */
qualityRouter.post(
  '/inspections',
  authenticateJwt,
  requireRoles('quality_checker', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = recordInspectionSchema.parse(req.body);
      const result = await QualityService.recordInspection(validated, req.user!.userId);

      res.status(201).json({
        success: true,
        data: result,
        message: `QC inspection recorded. Roll status updated to "${result.roll.status}".`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'ROLL_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'ROLL_NOT_FOUND', message: 'The specified fabric roll does not exist.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('ROLL_NOT_AWAITING_QC')) {
        res.status(422).json({
          success: false,
          error: { code: 'ROLL_NOT_AWAITING_QC', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('CRITICAL_DEFECT_NOT_PASSABLE')) {
        res.status(422).json({
          success: false,
          error: { code: 'CRITICAL_DEFECT_PASSED_VIOLATION', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('DEFECT_REQUIRED_FOR_NON_PASS')) {
        res.status(422).json({
          success: false,
          error: { code: 'DEFECT_ENTRY_REQUIRED', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('DEFECT_TYPE_NOT_FOUND')) {
        res.status(404).json({
          success: false,
          error: { code: 'DEFECT_TYPE_NOT_FOUND', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/quality/rolls/:id/scrap
 * Mark Fabric Roll as Scrapped
 * Roles: quality_checker, production_manager, admin, owner
 */
qualityRouter.post(
  '/rolls/:id/scrap',
  authenticateJwt,
  requireRoles('quality_checker', 'production_manager', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rollId = parseInt(req.params.id, 10);
      if (isNaN(rollId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Roll ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { reason } = scrapRollSchema.parse(req.body);
      const scrapped = await QualityService.scrapRoll(rollId, reason, req.user!.userId);

      res.status(200).json({
        success: true,
        data: scrapped,
        message: 'Fabric roll marked as scrapped.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'ROLL_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'ROLL_NOT_FOUND', message: `Fabric roll with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('CANNOT_SCRAP_DISPATCHED_ROLL')) {
        res.status(422).json({
          success: false,
          error: { code: 'DISPATCHED_ROLL_CANNOT_SCRAP', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/quality/traceability/:rollCode
 * Complete Traceability Dossier Genealogy (v_roll_trace)
 */
qualityRouter.get(
  '/traceability/:rollCode',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rollCode = req.params.rollCode;
      if (!rollCode) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_ROLL_CODE', message: 'Roll code is required.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const trace = await QualityService.getRollTrace(rollCode);
      res.status(200).json({
        success: true,
        data: trace,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'ROLL_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'ROLL_NOT_FOUND', message: `Roll with code ${req.params.rollCode} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/quality/defect-analytics/machines
 * Defect incidents categorized by machine (v_defects_by_machine)
 */
qualityRouter.get(
  '/defect-analytics/machines',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const analytics = await QualityService.getDefectAnalyticsMachines();
      res.status(200).json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/quality/defect-analytics/operators
 * Defect incidents categorized by operator (v_defects_by_operator)
 */
qualityRouter.get(
  '/defect-analytics/operators',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const analytics = await QualityService.getDefectAnalyticsOperators();
      res.status(200).json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/quality/shelf-inventory
 * Shelf inventory of QC-inspected in_stock rolls ready for dispatch loading
 */
qualityRouter.get(
  '/shelf-inventory',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const query = shelfInventoryQuerySchema.parse(req.query);
      const inventory = await QualityService.getShelfInventory(query);

      res.status(200).json({
        success: true,
        data: inventory.data,
        pagination: {
          total: inventory.total,
          page: inventory.page,
          limit: inventory.limit,
          totalPages: Math.ceil(inventory.total / inventory.limit),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);
