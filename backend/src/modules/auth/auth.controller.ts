import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.guard';
import { AuthenticatedRequest, BusinessRole } from '../../types';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  employeeId: z.number().optional(),
  roles: z.array(z.string()).min(1, 'At least one role is required'),
});

/**
 * POST /api/v1/auth/login
 * Public authentication route
 */
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const result = await AuthService.login(username, password);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error.message === 'USER_ACCOUNT_DEACTIVATED') {
      res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_DEACTIVATED', message: 'This user account has been deactivated. Please contact an administrator.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Returns authenticated profile & roles
 */
authRouter.get('/me', authenticateJwt, async (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: req.user,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/v1/auth/users
 * Admin endpoint for staff provisioning
 */
authRouter.post(
  '/users',
  authenticateJwt,
  requireRoles('admin'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = createUserSchema.parse(req.body);
      const newUser = await AuthService.createUser(
        {
          username: parsed.username,
          passwordPlain: parsed.password,
          employeeId: parsed.employeeId,
          roleNames: parsed.roles as BusinessRole[],
        },
        req.user!.userId
      );

      res.status(201).json({
        success: true,
        data: newUser,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);
