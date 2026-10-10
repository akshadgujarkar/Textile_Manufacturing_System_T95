import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ProductionService } from './production.service';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.guard';
import { AuthenticatedRequest } from '../../types';

export const productionRouter = Router();

// Zod Validation Schemas
const createJobSchema = z.object({
  orderItemId: z.number().int().positive('Order item ID is required and must be positive'),
  stageId: z.number().int().positive('Stage ID is required and must be positive'),
  machineId: z.number().int().positive('Machine ID is required and must be positive'),
  plannedQty: z.number().positive('Planned quantity must be greater than 0'),
});

const logShiftOutputSchema = z.object({
  jobId: z.number().int().positive('Job ID is required'),
  shiftId: z.number().int().positive('Shift ID is required'),
  operatorId: z.number().int().positive().optional(),
  outputQty: z.number().positive('Output quantity must be greater than 0'),
  clientRequestId: z.string().uuid('clientRequestId must be a valid UUIDv4'),
  generateFabricRoll: z.boolean().optional().default(true),
  rollWeightKg: z.number().positive().optional(),
  shelfLocation: z.string().max(50).optional(),
});

const recordBreakdownSchema = z.object({
  note: z.string().min(5, 'Breakdown note must be at least 5 characters long').max(500),
  reportedBy: z.number().int().positive().optional(),
});

const resolveDowntimeSchema = z.object({
  note: z.string().max(500).optional(),
});

const reassignJobSchema = z.object({
  newMachineId: z.number().int().positive('New machine ID is required'),
});

const listJobsQuerySchema = z.object({
  jobStatus: z.enum(['planned', 'running', 'interrupted', 'completed', 'cancelled']).optional(),
  machineCode: z.string().optional(),
  orderNo: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

const shiftOutputQuerySchema = z.object({
  productionDate: z.string().optional(),
  shiftId: z.coerce.number().int().positive().optional(),
  machineId: z.coerce.number().int().positive().optional(),
});

/**
 * GET /api/v1/production/floor-matrix
 * Real-time Machine Floor Status Matrix (v_machine_status)
 */
productionRouter.get(
  '/floor-matrix',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const matrix = await ProductionService.getFloorMatrix();
      res.status(200).json({
        success: true,
        data: matrix,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/production/jobs
 * List Production Jobs with progress tracking (v_job_progress)
 */
productionRouter.get(
  '/jobs',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const query = listJobsQuerySchema.parse(req.query);
      const result = await ProductionService.getJobProgress(query);

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
 * GET /api/v1/production/jobs/:id
 * Retrieve Job details, logs, and rolls
 */
productionRouter.get(
  '/jobs/:id',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id, 10);
      if (isNaN(jobId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Job ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const job = await ProductionService.getJobById(jobId);
      res.status(200).json({
        success: true,
        data: job,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'JOB_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'JOB_NOT_FOUND', message: `Production job with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/production/jobs
 * Schedule a new Production Job
 * Roles: production_manager, admin, owner
 */
productionRouter.post(
  '/jobs',
  authenticateJwt,
  requireRoles('production_manager', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createJobSchema.parse(req.body);
      const job = await ProductionService.createJob(validated, req.user!.userId);

      res.status(201).json({
        success: true,
        data: job,
        message: 'Production job scheduled successfully.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'ORDER_ITEM_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_ITEM_NOT_FOUND', message: 'The specified order item does not exist.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('ORDER_NOT_CONFIRMED')) {
        res.status(422).json({
          success: false,
          error: { code: 'ORDER_NOT_CONFIRMED', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('MACHINE_STAGE_MISMATCH')) {
        res.status(422).json({
          success: false,
          error: { code: 'MACHINE_STAGE_MISMATCH', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/production/jobs/:id/start
 * Start Production Job (WF-4)
 * Roles: production_manager, operator, admin, owner
 */
productionRouter.post(
  '/jobs/:id/start',
  authenticateJwt,
  requireRoles('production_manager', 'operator', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id, 10);
      if (isNaN(jobId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Job ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const started = await ProductionService.startJob(jobId, req.user!.userId);
      res.status(200).json({
        success: true,
        data: started,
        message: 'Production job started successfully and machine state set to running.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'JOB_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'JOB_NOT_FOUND', message: `Job with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'JOB_ALREADY_RUNNING') {
        res.status(422).json({
          success: false,
          error: { code: 'ALREADY_RUNNING', message: 'This job is already running.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('MACHINE_BUSY')) {
        res.status(409).json({
          success: false,
          error: { code: 'MACHINE_BUSY', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/production/jobs/:id/complete
 * Mark Production Job as Completed
 * Roles: production_manager, admin, owner
 */
productionRouter.post(
  '/jobs/:id/complete',
  authenticateJwt,
  requireRoles('production_manager', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id, 10);
      if (isNaN(jobId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Job ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const completed = await ProductionService.completeJob(jobId, req.user!.userId);
      res.status(200).json({
        success: true,
        data: completed,
        message: 'Production job completed successfully and machine state transitioned to idle.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'JOB_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'JOB_NOT_FOUND', message: `Job with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('INVALID_JOB_STATUS')) {
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
 * POST /api/v1/production/jobs/:id/reassign
 * Reassign an Interrupted Job to an Available Machine
 * Roles: production_manager, admin, owner
 */
productionRouter.post(
  '/jobs/:id/reassign',
  authenticateJwt,
  requireRoles('production_manager', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id, 10);
      if (isNaN(jobId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Job ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { newMachineId } = reassignJobSchema.parse(req.body);
      const reassigned = await ProductionService.reassignInterruptedJob(jobId, newMachineId, req.user!.userId);

      res.status(200).json({
        success: true,
        data: reassigned,
        message: 'Job reassigned to new machine successfully.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'JOB_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'JOB_NOT_FOUND', message: `Job with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('INVALID_JOB_STATUS')) {
        res.status(422).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('MACHINE_STAGE_MISMATCH')) {
        res.status(422).json({
          success: false,
          error: { code: 'MACHINE_STAGE_MISMATCH', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/production/logs
 * Log Shift Output and optionally generate fabric roll (WF-5)
 * Roles: operator, production_manager, admin, owner
 */
productionRouter.post(
  '/logs',
  authenticateJwt,
  requireRoles('operator', 'production_manager', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = logShiftOutputSchema.parse(req.body);
      const result = await ProductionService.logShiftOutput(validated, req.user!.userId);

      res.status(result.isIdempotentRetry ? 200 : 201).json({
        success: true,
        data: result,
        message: result.isIdempotentRetry
          ? 'Output log was previously recorded (idempotent response).'
          : 'Shift output logged successfully.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'JOB_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'JOB_NOT_FOUND', message: 'The specified production job does not exist.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('JOB_NOT_RUNNING')) {
        res.status(422).json({
          success: false,
          error: { code: 'JOB_NOT_RUNNING', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/production/machines/:id/breakdown
 * Record Machine Breakdown / Interruption (WF-6)
 * Roles: operator, production_manager, admin, owner
 */
productionRouter.post(
  '/machines/:id/breakdown',
  authenticateJwt,
  requireRoles('operator', 'production_manager', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const machineId = parseInt(req.params.id, 10);
      if (isNaN(machineId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Machine ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const dto = recordBreakdownSchema.parse(req.body);
      const result = await ProductionService.recordBreakdown(machineId, dto, req.user!.userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Machine breakdown recorded. Running job transitioned to interrupted.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'MACHINE_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'MACHINE_NOT_FOUND', message: `Machine with ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/production/machines/:id/resolve-downtime
 * Resolve Machine Downtime & set machine to Idle
 * Roles: production_manager, admin, owner
 */
productionRouter.post(
  '/machines/:id/resolve-downtime',
  authenticateJwt,
  requireRoles('production_manager', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const machineId = parseInt(req.params.id, 10);
      if (isNaN(machineId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Machine ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const dto = resolveDowntimeSchema.parse(req.body);
      const result = await ProductionService.resolveDowntime(machineId, dto.note, req.user!.userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Machine downtime resolved and state transitioned to idle.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message && error.message.startsWith('NO_OPEN_DOWNTIME_EVENT')) {
        res.status(422).json({
          success: false,
          error: { code: 'NO_OPEN_DOWNTIME', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/production/shift-output
 * Query Shift Output summaries (v_output_by_machine_shift)
 */
productionRouter.get(
  '/shift-output',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const query = shiftOutputQuerySchema.parse(req.query);
      const output = await ProductionService.getShiftOutput(query);

      res.status(200).json({
        success: true,
        data: output,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);
