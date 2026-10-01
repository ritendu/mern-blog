import { Request } from 'express';

export const MAX_PAGE_SIZE = 50;

export function parsePagination(req: Request): { page: number; limit: number } {
  const page = parseInt(String(req.query.page ?? '1'), 10) || 1;
  const limit = parseInt(String(req.query.limit ?? '10'), 10) || 10;
  return { page, limit };
}

export function clampPagination(page: number, limit: number): { page: number; limit: number } {
  return { page: Math.max(page, 1), limit: Math.min(Math.max(limit, 1), MAX_PAGE_SIZE) };
}

export function buildPaginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: total === 0 ? 1 : Math.ceil(total / limit) };
}
