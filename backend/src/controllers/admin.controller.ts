import { Response, NextFunction } from 'express';
import {
  deleteUser,
  getDashboardStats,
  listActivity,
  listAllComments,
  listAllPosts,
  listUsers,
  restorePost,
  updateUserRole,
} from '../services/admin.service';
import { deletePost } from '../services/post.service';
import { deleteComment } from '../services/comment.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { parsePagination } from '../utils/pagination';
import { POST_STATUS_FILTERS, PostStatusFilter } from '../validators/admin.validator';

type Handler = (req: AuthenticatedRequest, res: Response) => Promise<unknown>;

function wrap(handler: Handler) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await handler(req, res);
      res.status(200).json({ success: true, data: data ?? null });
    } catch (err) {
      next(err);
    }
  };
}

export const stats = wrap(() => getDashboardStats());

export const users = wrap((req) => {
  const { page, limit } = parsePagination(req);
  const search = typeof req.query.q === 'string' ? req.query.q : undefined;
  return listUsers(page, limit, search);
});

export const changeRole = wrap((req) => updateUserRole(req.params.id, req.body.role, req.user!.sub));

export const removeUser = wrap((req) => deleteUser(req.params.id, req.user!.sub));

export const posts = wrap((req) => {
  const { page, limit } = parsePagination(req);
  const raw = String(req.query.status ?? 'active');
  const status = (POST_STATUS_FILTERS as readonly string[]).includes(raw) ? (raw as PostStatusFilter) : 'active';
  return listAllPosts(page, limit, status);
});

export const removePost = wrap((req) => deletePost(req.params.id, req.user!.sub, req.user!.role));

export const restore = wrap((req) => restorePost(req.params.id));

export const comments = wrap((req) => {
  const { page, limit } = parsePagination(req);
  return listAllComments(page, limit);
});

export const removeComment = wrap((req) => deleteComment(req.params.id, req.user!.sub, req.user!.role));

export const activity = wrap((req) => {
  const { page, limit } = parsePagination(req);
  return listActivity(page, limit);
});
