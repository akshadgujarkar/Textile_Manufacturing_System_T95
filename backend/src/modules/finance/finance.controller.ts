import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { FinanceService } from './finance.service';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.guard';
import { AuthenticatedRequest } from '../../types';

export const financeRouter = Router();

// Zod Validation Schemas
const voidInvoiceSchema = z.object({
  reason: z.string().min(5, 'Void reason must be at least 5 characters long').max(500),
});

const supplierBillLineSchema = z.object({
  receiptItemId: z.number().int().positive('Receipt item ID is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  rate: z.number().nonnegative('Rate must be non-negative'),
});

const createSupplierBillSchema = z.object({
  supplierId: z.number().int().positive('Supplier ID is required'),
  supplierBillNo: z.string().min(1, 'Supplier bill number is required').max(100),
  billDate: z.string().min(1, 'Bill date is required'),
  lines: z.array(supplierBillLineSchema).min(1, 'Supplier bill must have at least one line'),
});

const paymentAllocationSchema = z.object({
  invoiceId: z.number().int().positive('Invoice ID is required'),
  amount: z.number().positive('Allocated amount must be greater than 0'),
});

const recordBuyerPaymentSchema = z.object({
  buyerId: z.number().int().positive('Buyer ID is required'),
  receivedOn: z.string().min(1, 'Payment date is required'),
  amount: z.number().positive('Payment amount must be greater than 0'),
  mode: z.enum(['cash', 'cheque', 'bank_transfer', 'upi', 'other']),
  instrumentRef: z.string().max(100).optional(),
  clientRequestId: z.string().uuid('clientRequestId must be a valid UUIDv4'),
  allocations: z.array(paymentAllocationSchema).optional(),
});

/**
 * POST /api/v1/finance/invoices/from-dispatch/:dispatchId
 * Generate draft sales invoice from a completed dispatch (WF-10b)
 * Roles: accounts, admin, owner
 */
financeRouter.post(
  '/invoices/from-dispatch/:dispatchId',
  authenticateJwt,
  requireRoles('accounts', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dispatchId = parseInt(req.params.dispatchId, 10);
      if (isNaN(dispatchId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Dispatch ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await FinanceService.generateInvoiceFromDispatch(dispatchId, req.user!.userId);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Sales invoice generated from dispatch.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'DISPATCH_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'DISPATCH_NOT_FOUND', message: `Dispatch ID ${req.params.dispatchId} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('DISPATCH_ALREADY_INVOICED')) {
        res.status(409).json({
          success: false,
          error: { code: 'ALREADY_INVOICED', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('DISPATCH_NOT_SENT')) {
        res.status(422).json({
          success: false,
          error: { code: 'DISPATCH_NOT_SENT', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/finance/invoices/:id/issue
 * Issue sales invoice (WF-11: gap-free numbering per Indian fiscal year)
 * Roles: accounts, admin, owner
 */
financeRouter.post(
  '/invoices/:id/issue',
  authenticateJwt,
  requireRoles('accounts', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const invoiceId = parseInt(req.params.id, 10);
      if (isNaN(invoiceId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Invoice ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const issued = await FinanceService.issueInvoice(invoiceId, req.user!.userId);
      res.status(200).json({
        success: true,
        data: issued,
        message: `Sales invoice ${issued.invoice_no} issued successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'INVOICE_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: `Invoice ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message && error.message.startsWith('INVALID_INVOICE_STATUS')) {
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
 * POST /api/v1/finance/invoices/:id/void
 * Void a sales invoice
 * Roles: accounts, admin, owner
 */
financeRouter.post(
  '/invoices/:id/void',
  authenticateJwt,
  requireRoles('accounts', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const invoiceId = parseInt(req.params.id, 10);
      if (isNaN(invoiceId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Invoice ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { reason } = voidInvoiceSchema.parse(req.body);
      const voided = await FinanceService.voidInvoice(invoiceId, reason, req.user!.userId);

      res.status(200).json({
        success: true,
        data: voided,
        message: 'Sales invoice marked as void.',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'INVOICE_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: `Invoice ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (error.message === 'INVOICE_ALREADY_VOID') {
        res.status(422).json({
          success: false,
          error: { code: 'ALREADY_VOID', message: 'This invoice is already void.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/finance/invoices/balances
 * Outstanding Invoice Balances (v_invoice_balance)
 */
financeRouter.get(
  '/invoices/balances',
  authenticateJwt,
  requireRoles('accounts', 'admin', 'owner', 'sales', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const buyerId = req.query.buyerId ? parseInt(req.query.buyerId as string, 10) : undefined;
      const balances = await FinanceService.getInvoiceBalances(buyerId);

      res.status(200).json({
        success: true,
        data: balances,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/finance/invoices/:id
 * Retrieve full invoice details
 */
financeRouter.get(
  '/invoices/:id',
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const invoiceId = parseInt(req.params.id, 10);
      if (isNaN(invoiceId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Invoice ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const inv = await FinanceService.getInvoiceById(invoiceId);
      res.status(200).json({
        success: true,
        data: inv,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message === 'INVOICE_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: `Invoice ID ${req.params.id} was not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/finance/supplier-bills
 * Record Supplier Purchase Bill (WF-12)
 * Roles: accounts, admin, owner
 */
financeRouter.post(
  '/supplier-bills',
  authenticateJwt,
  requireRoles('accounts', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createSupplierBillSchema.parse(req.body);
      const result = await FinanceService.recordSupplierBill(validated, req.user!.userId);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Supplier bill recorded successfully.',
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
          error: { code: 'SUPPLIER_INACTIVE', message: 'Supplier account is deactivated.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/finance/supplier-bills/variances
 * Supplier Bill Rate and Quantity Variances (v_supplier_bill_variance)
 */
financeRouter.get(
  '/supplier-bills/variances',
  authenticateJwt,
  requireRoles('accounts', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const variances = await FinanceService.getSupplierBillVariances();
      res.status(200).json({
        success: true,
        data: variances,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/finance/payments
 * Record Customer Payment & Invoicing Allocations (WF-8)
 * Roles: accounts, admin, owner
 */
financeRouter.post(
  '/payments',
  authenticateJwt,
  requireRoles('accounts', 'admin', 'owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = recordBuyerPaymentSchema.parse(req.body);
      const result = await FinanceService.recordBuyerPayment(validated, req.user!.userId);

      res.status(result.isIdempotentRetry ? 200 : 201).json({
        success: true,
        data: result,
        message: result.isIdempotentRetry
          ? 'Payment was already recorded (idempotent response).'
          : 'Payment recorded and allocated successfully.',
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
      next(error);
    }
  }
);

/**
 * GET /api/v1/finance/buyers/:id/ledger
 * Real-time Buyer Account Running Balance Ledger (v_buyer_ledger)
 * Roles: accounts, admin, owner, sales, staff_readonly
 */
financeRouter.get(
  '/buyers/:id/ledger',
  authenticateJwt,
  requireRoles('accounts', 'admin', 'owner', 'sales', 'staff_readonly'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const buyerId = parseInt(req.params.id, 10);
      if (isNaN(buyerId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Buyer ID must be an integer.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const ledger = await FinanceService.getBuyerLedger(buyerId);
      res.status(200).json({
        success: true,
        data: ledger,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);
