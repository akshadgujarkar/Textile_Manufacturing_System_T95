import { Request } from 'express';

// Domain Numeric Types
export type Qty = number;      // Corresponds to qty_t (numeric(14,3))
export type Money = number;    // Corresponds to money_t (numeric(14,2))
export type Rate = number;     // Corresponds to rate_t (numeric(12,4))

// Standard Business Roles
export type BusinessRole = 
  | 'admin'
  | 'owner'
  | 'accounts'
  | 'production_manager'
  | 'operator'
  | 'quality_checker'
  | 'gate_store'
  | 'dispatch'
  | 'sales'
  | 'staff_readonly';

// Authenticated User Context
export interface AuthUser {
  userId: number;
  username: string;
  employeeId?: number | null;
  roles: BusinessRole[];
}

export interface SessionContext {
  userId: number;
  source?: string;
  reason?: string;
}

// Custom Express Request with Authenticated Context
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  sessionContext?: SessionContext;
}

// Custom PostgreSQL Error Code Map (from Doc 04 §11)
export enum SqlStateCode {
  BR_IMMUTABLE_OR_DELETED = 'BR001',
  BR_ILLEGAL_STATUS_TRANSITION = 'BR002',
  BR_FIELD_LOCKED = 'BR003',
  BR_PERIOD_CLOSED = 'BR004',
  BR_ROLL_NOT_DISPATCHABLE = 'BR005',
  BR_ALLOCATION_VIOLATION = 'BR006',
  BR_DISPATCH_MISMATCH = 'BR007',
  BR_INVOICE_RULE_ERROR = 'BR008',
  BR_QC_RULE_ERROR = 'BR009',
  BR_PRODUCTION_LIFECYCLE_ERROR = 'BR010',
  BR_REVERSAL_QUANTITY_ERROR = 'BR011',
  
  // Built-in PostgreSQL Codes
  UNIQUE_VIOLATION = '23505',
  FOREIGN_KEY_VIOLATION = '23503',
  CHECK_VIOLATION = '23514',
  EXCLUSION_VIOLATION = '23P01',
  NOT_NULL_VIOLATION = '23502',
  LOCK_NOT_AVAILABLE = '55P03',
  DEADLOCK_DETECTED = '40P01',
  SERIALIZATION_FAILURE = '40001'
}

// Standard API Response Envelope
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
