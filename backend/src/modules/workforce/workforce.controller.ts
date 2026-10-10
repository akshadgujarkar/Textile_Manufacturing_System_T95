import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { WorkforceService } from './workforce.service';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.guard';
import { AuthenticatedRequest } from '../../types';

export const workforceRouter = Router();

// Zod Validation Schemas
const attendanceItemSchema = z.object({
  employeeId: z.number().int().positive('Employee ID is required'),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Work date must be in YYYY-MM-DD format'),
  shiftId: z.number().int().positive('Shift ID is required'),
  status: z.enum(['present', 'absent', 'half_day', 'leave']),
  hoursWorked: z.number().min(0).max(24),
});

const batchAttendanceSchema = z.object({
  records: z.array(attendanceItemSchema).min(1, 'At least one attendance record is required'),
});

const generateWagesSchema = z.object({
  periodId: z.number().int().positive('Period ID is required'),
});

const reverseWageSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters long').max(500),
});

/**
 * POST /api/v1/workforce/attendance
 * Batch records daily employee attendance (WF-13a)
 * Roles: production_manager, accounts, admin, owner
 */
workforceRouter.post(
  '/attendance',
  authenticateJwt,
  requireRoles('production_manager', 'accounts', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = batchAttendanceSchema.parse(req.body);
      const result = await WorkforceService.recordAttendance(validated.records, req.user!.userId);

      res.status(201).json({
        success: true,
        data: result,
        message: `Successfully recorded ${result.recordedCount} attendance entries.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message && error.message.startsWith('INVALID_HOURS')) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_HOURS', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/workforce/attendance
 * List attendance records with optional filtering
 * Roles: production_manager, accounts, admin, owner, auditor
 */
workforceRouter.get(
  '/attendance',
  authenticateJwt,
  requireRoles('production_manager', 'accounts', 'admin', 'owner', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const filters = {
        employeeId: req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        shiftId: req.query.shiftId ? parseInt(req.query.shiftId as string, 10) : undefined,
      };

      const result = await WorkforceService.listAttendance(filters);

      res.status(200).json({
        success: true,
        count: result.length,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/workforce/wages/generate
 * Month-end draft wage calculations from attendance & output logs (WF-13b)
 * Roles: accounts, admin, owner
 */
workforceRouter.post(
  '/wages/generate',
  authenticateJwt,
  requireRoles('accounts', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = generateWagesSchema.parse(req.body);
      const result = await WorkforceService.generateMonthlyWages(validated.periodId, req.user!.userId);

      res.status(201).json({
        success: true,
        data: result,
        message: `Successfully generated ${result.generatedCount} wage records for period #${result.periodId}.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'PERIOD_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'PERIOD_NOT_FOUND', message: `Accounting period was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('PERIOD_CLOSED')) {
        res.status(422).json({
          success: false,
          error: { code: 'PERIOD_CLOSED', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/workforce/wages
 * Query wage summary view (WF-13) with automatic salary redaction for non-finance roles
 * Roles: accounts, admin, owner, staff_readonly, production_manager
 */
workforceRouter.get(
  '/wages',
  authenticateJwt,
  requireRoles('accounts', 'admin', 'owner', 'staff_readonly', 'production_manager'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const periodId = req.query.periodId ? parseInt(req.query.periodId as string, 10) : undefined;
      const result = await WorkforceService.getWageSummary(periodId, req.user?.roles);

      res.status(200).json({
        success: true,
        count: result.length,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/workforce/wages/:id/approve
 * Approves draft wage record and posts plant-level wage cost_entry (WF-13c)
 * Roles: accounts, admin, owner
 */
workforceRouter.post(
  '/wages/:id/approve',
  authenticateJwt,
  requireRoles('accounts', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const wageId = parseInt(req.params.id, 10);
      if (isNaN(wageId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Wage ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await WorkforceService.approveWageRecord(wageId, req.user!.userId);

      res.status(200).json({
        success: true,
        data: result,
        message: `Wage record #${wageId} approved and posted to cost ledger.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'WAGE_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'WAGE_NOT_FOUND', message: `Wage record #${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('INVALID_STATUS')) {
        res.status(422).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/workforce/wages/:id/reverse
 * Reverses approved wage record and posts negative twin cost_entry (WF-13d)
 * Roles: accounts, admin, owner
 */
workforceRouter.post(
  '/wages/:id/reverse',
  authenticateJwt,
  requireRoles('accounts', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const wageId = parseInt(req.params.id, 10);
      if (isNaN(wageId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Wage ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const validated = reverseWageSchema.parse(req.body);
      const result = await WorkforceService.reverseWageRecord(wageId, validated.reason, req.user!.userId);

      res.status(200).json({
        success: true,
        data: result,
        message: `Wage record #${wageId} reversed.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'WAGE_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'WAGE_NOT_FOUND', message: `Wage record #${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('INVALID_STATUS')) {
        res.status(422).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);
