import { z } from 'zod';

export const updateRoleSchema = z.object({
  body: z.object({ role: z.enum(['admin', 'user'], { message: 'Role must be admin or user' }) }),
});

export const POST_STATUS_FILTERS = ['active', 'deleted', 'all'] as const;
export type PostStatusFilter = (typeof POST_STATUS_FILTERS)[number];
