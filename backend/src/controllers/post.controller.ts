import { Response, NextFunction } from 'express';
import {
  createPost,
  listPosts,
  listMyPosts,
  getPostBySlug,
  updatePost,
  deletePost,
  toPublicPost,
} from '../services/post.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { parsePagination } from '../utils/pagination';

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await createPost(req.user!.sub, req.body);
    const populated = await post.populate('author', 'name');
    res.status(201).json({ success: true, data: toPublicPost(populated) });
  } catch (err) {
    next(err);
  }
}

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req);
    const result = await listPosts(page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listMine(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req);
    const result = await listMyPosts(req.user!.sub, page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getBySlug(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await getPostBySlug(req.params.slug);
    res.status(200).json({ success: true, data: toPublicPost(post) });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await updatePost(req.params.id, req.user!.sub, req.user!.role, req.body);
    const populated = await post.populate('author', 'name');
    res.status(200).json({ success: true, data: toPublicPost(populated) });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deletePost(req.params.id, req.user!.sub, req.user!.role);
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
