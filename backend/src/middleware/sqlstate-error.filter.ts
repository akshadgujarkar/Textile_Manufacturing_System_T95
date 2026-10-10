import { Request, Response, NextFunction } from 'express';
import { SqlStateCode, ApiResponse } from '../types';

export function sqlStateErrorFilter(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const code = err.code || err.sqlState;
  const message = err.message || 'Internal server error occurred.';

  // 1. Custom Business Rule Violations (BR001–BR011)
  switch (code) {
    case SqlStateCode.BR_IMMUTABLE_OR_DELETED:
      res.status(403).json(buildErrorResponse('BR001_IMMUTABLE_RECORD', message, err.detail));
      return;

    case SqlStateCode.BR_ILLEGAL_STATUS_TRANSITION:
      res.status(422).json(buildErrorResponse('BR002_ILLEGAL_STATE_TRANSITION', message, err.detail));
      return;

    case SqlStateCode.BR_FIELD_LOCKED:
      res.status(400).json(buildErrorResponse('BR003_FIELD_LOCKED', message, err.detail));
      return;

    case SqlStateCode.BR_PERIOD_CLOSED:
      res.status(400).json(buildErrorResponse('BR004_ACCOUNTING_PERIOD_CLOSED', message, err.detail));
      return;

    case SqlStateCode.BR_ROLL_NOT_DISPATCHABLE:
      res.status(422).json(buildErrorResponse('BR005_ROLL_NOT_DISPATCHABLE', message, err.detail));
      return;

    case SqlStateCode.BR_ALLOCATION_VIOLATION:
      res.status(422).json(buildErrorResponse('BR006_ALLOCATION_VIOLATION', message, err.detail));
      return;

    case SqlStateCode.BR_DISPATCH_MISMATCH:
      res.status(409).json(buildErrorResponse('BR007_DISPATCH_RULE_VIOLATION', message, err.detail));
      return;

    case SqlStateCode.BR_INVOICE_RULE_ERROR:
      res.status(400).json(buildErrorResponse('BR008_INVOICE_RULE_ERROR', message, err.detail));
      return;

    case SqlStateCode.BR_QC_RULE_ERROR:
      res.status(422).json(buildErrorResponse('BR009_QC_RULE_ERROR', message, err.detail));
      return;

    case SqlStateCode.BR_PRODUCTION_LIFECYCLE_ERROR:
      res.status(400).json(buildErrorResponse('BR010_PRODUCTION_LIFECYCLE_ERROR', message, err.detail));
      return;

    case SqlStateCode.BR_REVERSAL_QUANTITY_ERROR:
      res.status(400).json(buildErrorResponse('BR011_REVERSAL_QUANTITY_ERROR', message, err.detail));
      return;

    // 2. Built-In PostgreSQL Violations
    case SqlStateCode.UNIQUE_VIOLATION:
      if (err.constraint === 'uq_dispatch_item_one_active_roll') {
        res.status(409).json(buildErrorResponse('DOUBLE_DISPATCH_DETECTED', 'This fabric roll is already active on another dispatch load.', err.detail));
        return;
      }
      if (err.constraint === 'uq_job_one_running_per_machine') {
        res.status(409).json(buildErrorResponse('MACHINE_ALREADY_RUNNING_JOB', 'This machine already has an active running job.', err.detail));
        return;
      }
      res.status(409).json(buildErrorResponse('DUPLICATE_KEY_VIOLATION', 'A record with this identifier already exists.', { constraint: err.constraint }));
      return;

    case SqlStateCode.CHECK_VIOLATION:
      if (err.constraint === 'ck_balance_not_negative') {
        res.status(400).json(buildErrorResponse('INSUFFICIENT_STOCK', 'Operation rejected: Raw material stock cannot be negative.', err.detail));
        return;
      }
      if (err.constraint === 'ck_reserved_within_on_hand') {
        res.status(400).json(buildErrorResponse('RESERVATION_EXCEEDS_STOCK', 'Operation rejected: Reserved quantity cannot exceed total on-hand stock.', err.detail));
        return;
      }
      res.status(400).json(buildErrorResponse('CHECK_CONSTRAINT_FAILED', message, { constraint: err.constraint }));
      return;

    case SqlStateCode.EXCLUSION_VIOLATION:
      res.status(409).json(buildErrorResponse('OVERLAPPING_TIME_RANGE', 'Operation rejected: Overlapping time period detected for this resource.', err.detail));
      return;

    case SqlStateCode.LOCK_NOT_AVAILABLE:
      res.status(503).json(buildErrorResponse('RESOURCE_BUSY_LOCK_TIMEOUT', 'The requested record is currently being modified by another transaction. Please retry in a few moments.', err.detail));
      return;

    case SqlStateCode.DEADLOCK_DETECTED:
    case SqlStateCode.SERIALIZATION_FAILURE:
      res.status(409).json(buildErrorResponse('TRANSACTION_CONFLICT_RETRY', 'Concurrent update conflict detected. Please retry the transaction.', err.detail));
      return;
  }

  // 3. Fallback for Generic / Unhandled Errors
  console.error('[UNHANDLED BACKEND ERROR]', err);
  res.status(err.status || 500).json(buildErrorResponse(
    err.name || 'INTERNAL_SERVER_ERROR',
    message,
    process.env.NODE_ENV === 'development' ? err.stack : undefined
  ));
}

function buildErrorResponse(code: string, message: string, details?: any): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };
}
