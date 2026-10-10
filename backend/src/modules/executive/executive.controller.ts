import { Router, Response, NextFunction } from 'express';
import { ExecutiveService } from './executive.service';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.guard';
import { AuthenticatedRequest } from '../../types';

export const executiveRouter = Router();

/**
 * GET /api/v1/executive/pl-statement
 * Monthly Profit & Loss Statement (v_monthly_pl)
 * Roles: owner, admin, accounts, auditor
 */
executiveRouter.get(
  '/pl-statement',
  authenticateJwt,
  requireRoles('owner', 'admin', 'accounts', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const periodId = req.query.periodId ? parseInt(req.query.periodId as string, 10) : undefined;
      const result = await ExecutiveService.getExecutivePL(periodId);

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
 * GET /api/v1/executive/order-costing
 * Order-level contribution margin and gross profit analysis (v_order_cost)
 * Roles: owner, admin, accounts, sales, staff_readonly
 */
executiveRouter.get(
  '/order-costing',
  authenticateJwt,
  requireRoles('owner', 'admin', 'accounts', 'sales', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = req.query.orderId ? parseInt(req.query.orderId as string, 10) : undefined;
      const result = await ExecutiveService.getOrderCosting(orderId);

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
 * GET /api/v1/executive/roll-costing
 * Roll-level full cost calculation (material + wages + overheads) (v_roll_cost)
 * Roles: owner, admin, accounts, quality_checker, staff_readonly
 */
executiveRouter.get(
  '/roll-costing',
  authenticateJwt,
  requireRoles('owner', 'admin', 'accounts', 'quality_checker', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rollId = req.query.rollId ? parseInt(req.query.rollId as string, 10) : undefined;
      const result = await ExecutiveService.getRollCosting(rollId);

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
 * GET /api/v1/executive/machine-productivity
 * Machine output and downtime analytics (v_machine_output)
 * Roles: owner, admin, accounts, production_manager, staff_readonly
 */
executiveRouter.get(
  '/machine-productivity',
  authenticateJwt,
  requireRoles('owner', 'admin', 'accounts', 'production_manager', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const periodId = req.query.periodId ? parseInt(req.query.periodId as string, 10) : undefined;
      const machineId = req.query.machineId ? parseInt(req.query.machineId as string, 10) : undefined;
      const result = await ExecutiveService.getMachineProductivity(periodId, machineId);

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
