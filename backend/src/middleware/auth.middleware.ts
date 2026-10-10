import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { CryptoUtil } from '../utils/crypto';

export function authenticateJwt(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED_MISSING_TOKEN',
        message: 'Authentication token is required.',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = CryptoUtil.verifyAccessToken(token);
    req.user = decoded;
    
    // Automatically initialize session context for database triggers
    req.sessionContext = {
      userId: decoded.userId,
      source: (req.headers['x-client-source'] as string) || `api:${req.method}:${req.path}`,
      reason: req.headers['x-audit-reason'] as string,
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Your session has expired. Please log in again.',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
