import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, BusinessRole } from '../types';

export function requireRoles(...allowedRoles: BusinessRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'User authentication is required for this operation.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Admin role automatically has superuser bypass on business operations
    if (req.user.roles.includes('admin')) {
      return next();
    }

    // Check if user has at least one of the allowed roles
    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
          message: `Access denied. Required roles: [${allowedRoles.join(', ')}].`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
