import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ReconciliationService } from './reconciliation.service';
import { AdminService } from './admin.service';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.guard';
import { AuthenticatedRequest } from '../../types';

export const adminRouter = Router();

// Zod Validation Schemas
const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(200),
  contact: z.string().max(200).optional(),
  taxId: z.string().max(50).optional(),
});

const buyerSchema = z.object({
  name: z.string().min(1, 'Buyer name is required').max(200),
  contact: z.string().max(200).optional(),
  taxId: z.string().max(50).optional(),
});

const yarnItemSchema = z.object({
  yarnTypeId: z.number().int().positive('Yarn type ID is required'),
  colourId: z.number().int().positive('Colour ID is required'),
  unitId: z.number().int().positive('Unit of measure ID is required'),
  reorderLevel: z.number().nonnegative().optional(),
});

const fabricProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  specification: z.string().max(500).optional(),
  unitId: z.number().int().positive('Unit of measure ID is required'),
});

const machineSchema = z.object({
  machineCode: z.string().min(1, 'Machine code is required').max(50),
  stageId: z.number().int().positive('Process stage ID is required'),
  description: z.string().max(200).optional(),
});

const defectTypeSchema = z.object({
  name: z.string().min(1, 'Defect type name is required').max(100),
});

const employeeSchema = z.object({
  employeeCode: z.string().min(1, 'Employee code is required').max(50),
  fullName: z.string().min(1, 'Full name is required').max(200),
  designation: z.string().max(100).optional(),
  payBasis: z.enum(['daily', 'monthly', 'piece_rate']),
  payRate: z.number().nonnegative('Pay rate must be non-negative'),
});

const shiftSchema = z.object({
  name: z.string().min(1, 'Shift name is required').max(100),
  startsAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time format must be HH:MM or HH:MM:SS'),
  endsAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time format must be HH:MM or HH:MM:SS'),
});

// =========================================================================
// 1. Reconciliation & System Invariant Health Checks
// =========================================================================

/**
 * GET /api/v1/admin/health-check
 * Executes all 7 invariant reconciliation queries and returns health diagnostics.
 * Roles: admin, owner, staff_readonly
 */
adminRouter.get(
  '/health-check',
  authenticateJwt,
  requireRoles('admin', 'owner', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const healthReport = await ReconciliationService.runAllHealthChecks();
      res.status(200).json({
        success: true,
        data: healthReport,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 2. Audit Trail Queries
// =========================================================================

/**
 * GET /api/v1/admin/audit-logs
 * Keyset/offset paginated search over append-only audit_log table.
 * Roles: admin, owner, staff_readonly
 */
adminRouter.get(
  '/audit-logs',
  authenticateJwt,
  requireRoles('admin', 'owner', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const filters = {
        actorId: req.query.actorId ? parseInt(req.query.actorId as string, 10) : undefined,
        entityName: req.query.entityName as string | undefined,
        entityId: req.query.entityId as string | undefined,
        action: req.query.action as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
        cursor: req.query.cursor ? parseInt(req.query.cursor as string, 10) : undefined,
      };

      const result = await AdminService.getAuditLogs(filters);

      res.status(200).json({
        success: true,
        total: result.totalCount,
        count: result.logs.length,
        data: result.logs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================================
// 3. Master Data CRUD
// =========================================================================

// Suppliers
adminRouter.get(
  '/masters/suppliers',
  authenticateJwt,
  requireRoles('admin', 'owner', 'staff_readonly', 'accounts', 'gate_store'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const result = await AdminService.getSuppliers(activeOnly);
      res.status(200).json({ success: true, count: result.length, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

adminRouter.post(
  '/masters/suppliers',
  authenticateJwt,
  requireRoles('admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = supplierSchema.parse(req.body);
      const result = await AdminService.createSupplier(validated, req.user!.userId);
      res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

adminRouter.put(
  '/masters/suppliers/:id',
  authenticateJwt,
  requireRoles('admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      const result = await AdminService.updateSupplier(id, req.body, req.user!.userId);
      res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

// Buyers
adminRouter.get(
  '/masters/buyers',
  authenticateJwt,
  requireRoles('admin', 'owner', 'staff_readonly', 'accounts', 'sales'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const result = await AdminService.getBuyers(activeOnly);
      res.status(200).json({ success: true, count: result.length, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

adminRouter.post(
  '/masters/buyers',
  authenticateJwt,
  requireRoles('admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = buyerSchema.parse(req.body);
      const result = await AdminService.createBuyer(validated, req.user!.userId);
      res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

adminRouter.put(
  '/masters/buyers/:id',
  authenticateJwt,
  requireRoles('admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      const result = await AdminService.updateBuyer(id, req.body, req.user!.userId);
      res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

// Yarn Items
adminRouter.get(
  '/masters/yarn-items',
  authenticateJwt,
  requireRoles('admin', 'owner', 'staff_readonly', 'gate_store', 'sales', 'production_manager'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await AdminService.getYarnItems();
      res.status(200).json({ success: true, count: result.length, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

adminRouter.post(
  '/masters/yarn-items',
  authenticateJwt,
  requireRoles('admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = yarnItemSchema.parse(req.body);
      const result = await AdminService.createYarnItem(validated, req.user!.userId);
      res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

// Fabric Products
adminRouter.get(
  '/masters/fabric-products',
  authenticateJwt,
  requireRoles('admin', 'owner', 'staff_readonly', 'sales', 'production_manager', 'quality_checker'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await AdminService.getFabricProducts();
      res.status(200).json({ success: true, count: result.length, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

adminRouter.post(
  '/masters/fabric-products',
  authenticateJwt,
  requireRoles('admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = fabricProductSchema.parse(req.body);
      const result = await AdminService.createFabricProduct(validated, req.user!.userId);
      res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

// Machines
adminRouter.get(
  '/masters/machines',
  authenticateJwt,
  requireRoles('admin', 'owner', 'staff_readonly', 'production_manager', 'operator'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await AdminService.getMachines();
      res.status(200).json({ success: true, count: result.length, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

adminRouter.post(
  '/masters/machines',
  authenticateJwt,
  requireRoles('admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = machineSchema.parse(req.body);
      const result = await AdminService.createMachine(validated, req.user!.userId);
      res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

// Defect Types
adminRouter.get(
  '/masters/defect-types',
  authenticateJwt,
  requireRoles('admin', 'owner', 'staff_readonly', 'quality_checker'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await AdminService.getDefectTypes();
      res.status(200).json({ success: true, count: result.length, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

adminRouter.post(
  '/masters/defect-types',
  authenticateJwt,
  requireRoles('admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = defectTypeSchema.parse(req.body);
      const result = await AdminService.createDefectType(validated.name, req.user!.userId);
      res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

// Employees
adminRouter.get(
  '/masters/employees',
  authenticateJwt,
  requireRoles('admin', 'owner', 'staff_readonly', 'accounts', 'production_manager'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await AdminService.getEmployees();
      res.status(200).json({ success: true, count: result.length, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

adminRouter.post(
  '/masters/employees',
  authenticateJwt,
  requireRoles('admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = employeeSchema.parse(req.body);
      const result = await AdminService.createEmployee(validated, req.user!.userId);
      res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

// Shifts
adminRouter.get(
  '/masters/shifts',
  authenticateJwt,
  requireRoles('admin', 'owner', 'staff_readonly', 'production_manager'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await AdminService.getShifts();
      res.status(200).json({ success: true, count: result.length, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);

adminRouter.post(
  '/masters/shifts',
  authenticateJwt,
  requireRoles('admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = shiftSchema.parse(req.body);
      const result = await AdminService.createShift(validated, req.user!.userId);
      res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
);
