import { Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { UserModel } from '../models/User.model';
import { AuthenticatedRequest, UserRole } from '../types/auth.types';

/**
 * Access tokens carry the role for up to 15 minutes. For admin-only routes, re-check
 * the database so a demoted or deleted admin loses access immediately.
 */
export async function confirmAdminInDb(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await UserModel.findById(req.user?.sub).select('role');
    if (!user || user.role !== 'admin') {
      next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
      return;
    }
    next();
  };
}
