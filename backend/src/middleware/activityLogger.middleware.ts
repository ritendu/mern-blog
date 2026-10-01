import { RequestHandler } from 'express';
import { ActivityLogModel } from '../models/ActivityLog.model';
import { AuthenticatedRequest } from '../types/auth.types';
import { env } from '../config/env';

/**
 * Records a successful (status < 400) action. The acting user comes from the JWT
 * (req.user) or, for login/register, from res.locals.userId set by the controller.
 */
export function logActivity(action: string): RequestHandler {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      const userId = (req as AuthenticatedRequest).user?.sub ?? (res.locals.userId as string | undefined);
      if (env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.log(`[activity] ${action} user=${userId ?? 'anonymous'} ${req.method} ${req.originalUrl}`);
      }
      ActivityLogModel.create({
        user: userId ?? null,
        action,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        ip: req.ip ?? '',
        statusCode: res.statusCode,
      }).catch(() => undefined);
    });
    next();
  };
}
