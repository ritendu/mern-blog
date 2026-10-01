import { Response, NextFunction } from 'express';
import { listNotifications, markAllRead, markRead } from '../services/notification.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { parsePagination } from '../utils/pagination';

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req);
    res.status(200).json({ success: true, data: await listNotifications(req.user!.sub, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function read(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await markRead(req.user!.sub, req.params.id);
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

export async function readAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await markAllRead(req.user!.sub);
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
