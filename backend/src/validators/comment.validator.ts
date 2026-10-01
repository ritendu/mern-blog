import { z } from 'zod';

const content = z.string().trim().min(1, 'Comment cannot be empty').max(2000, 'Comment must be at most 2000 characters');

export const commentSchema = z.object({ body: z.object({ content }) });
