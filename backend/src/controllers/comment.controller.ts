import { Response, NextFunction } from 'express';
import { createComment, deleteComment, listComments, updateComment } from '../services/comment.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { parsePagination } from '../utils/pagination';

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req);
    res.status(200).json({ success: true, data: await listComments(req.params.postId, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const comment = await createComment(req.params.postId, req.user!.sub, req.body.content);
    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const comment = await updateComment(req.params.id, req.user!.sub, req.user!.role, req.body.content);
    res.status(200).json({ success: true, data: comment });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteComment(req.params.id, req.user!.sub, req.user!.role);
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
